#!/usr/bin/env python3
"""Sync schedules data into Google Calendar.

- Expects OAuth client secret at credentials.json (or GCAL_CREDENTIALS env)
- Stores/uses OAuth tokens at token.json (or GCAL_TOKEN env)
- Default input: data/schedules_enriched.json (can override with --data-file)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/calendar"]
DEFAULT_TZ = os.getenv("TZ", "Asia/Tokyo")
DEFAULT_DURATION_MIN = int(os.getenv("DEFAULT_DURATION_MIN", 60))


@dataclass
class EventMeta:
    date: str
    time: str
    key: str
    label: str


def load_credentials(creds_path: Path, token_path: Path) -> Credentials:
    """Load or refresh OAuth credentials."""
    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json())
    return creds


def parse_schedule(item: dict, tz: str, default_duration_min: int) -> Optional[dict]:
    try:
        date_str = item["date"]
        time_str = item["time"]
    except KeyError:
        return None

    try:
        start_local = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M").replace(
            tzinfo=ZoneInfo(tz)
        )
    except ValueError:
        return None

    end_local = start_local + timedelta(minutes=default_duration_min)

    def to_int(value) -> Optional[int]:
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
        return None

    count = item.get("count", {})
    count_raw = count.get("raw") or ""
    count_current = to_int(count.get("current"))
    count_total = to_int(count.get("total"))

    area = item.get("area", "")
    course = item.get("course", "")
    lms_url = item.get("lmsUrl") or item.get("pageUrl")

    summary = f"{course} ({area})"
    if count_current and count_total:
        summary += f" 第{count_current}/{count_total}回"

    description_lines = []
    if count_raw:
        description_lines.append(f"進捗: {count_raw}")
    if lms_url:
        description_lines.append(f"LMS: {lms_url}")
    description = "\n".join(description_lines)

    meta = EventMeta(
        date=date_str,
        time=time_str,
        key=f"{date_str}-{time_str}-{course}-{area}",
        label=summary,
    )

    body = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_local.isoformat(), "timeZone": tz},
        "end": {"dateTime": end_local.isoformat(), "timeZone": tz},
        "location": area or None,
        "extendedProperties": {
            "private": {
                "schedule_key": meta.key,
                "source": "schedules_json",
            }
        },
    }
    return {"meta": meta, "event": body}


def load_raw_items(raw_text: str, source_format: str) -> list[dict]:
    if source_format != "schedules_json":
        raise ValueError(f"Unsupported source format: {source_format}")
    parsed = json.loads(raw_text)
    if not isinstance(parsed, list):
        raise ValueError("Input must be a list")
    return parsed


def load_events(items: list[dict], source_format: str, tz: str, default_duration_min: int) -> List[dict]:
    if source_format != "schedules_json":
        raise ValueError(f"Unsupported source format: {source_format}")
    events: List[dict] = []
    for raw in items:
        parsed = parse_schedule(raw, tz, default_duration_min)
        if parsed:
            events.append(parsed)
    return events


def fetch_existing_events_by_start(
    service,
    calendar_id: str,
    time_min: datetime,
    time_max: datetime,
) -> Tuple[dict, List[dict]]:
    """Fetch existing events within window. Returns (start_iso_set, raw_list)."""
    events = []
    page_token = None
    start_set = set()
    while True:
        resp = (
            service.events()
            .list(
                calendarId=calendar_id,
                timeMin=time_min.isoformat(),
                timeMax=time_max.isoformat(),
                singleEvents=True,
                orderBy="startTime",
                pageToken=page_token,
                maxResults=2500,
            )
            .execute()
        )
        batch = resp.get("items", [])
        events.extend(batch)
        for ev in batch:
            start = ev.get("start", {})
            start_dt = start.get("dateTime")
            if start_dt:
                start_set.add(start_dt)
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return start_set, events


def find_existing_event(service, calendar_id: str, key: str):
    try:
        resp = (
            service.events()
            .list(
                calendarId=calendar_id,
                privateExtendedProperty=[f"schedule_key={key}"],
                maxResults=1,
                singleEvents=True,
                showDeleted=False,
            )
            .execute()
        )
        items = resp.get("items", [])
        return items[0] if items else None
    except HttpError as e:
        print(f"[warn] list failed for key={key}: {e}", file=sys.stderr)
        return None


def upsert_event(
    service,
    calendar_id: str,
    event_body: dict,
    sched: EventMeta,
    dry_run: bool,
    allow_update: bool,
    existing: dict | None = None,
) -> str:
    existing = existing or find_existing_event(service, calendar_id, sched.key)
    if existing:
        if not allow_update:
            return "skip"
        if dry_run:
            return "update(dry-run)"
        event_id = existing["id"]
        service.events().update(calendarId=calendar_id, eventId=event_id, body=event_body).execute()
        return "update"
    else:
        if dry_run:
            return "create(dry-run)"
        service.events().insert(calendarId=calendar_id, body=event_body).execute()
        return "create"


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync schedules data to Google Calendar")
    parser.add_argument("--calendar-id", dest="calendar_id", default=os.getenv("CALENDAR_ID"), help="Target calendar ID (required)")
    parser.add_argument(
        "--data-file",
        dest="data_file",
        default=None,
        help="Path to source data file",
    )
    parser.add_argument(
        "--source-format",
        dest="source_format",
        choices=["schedules_json"],
        default="schedules_json",
        help="Input format",
    )
    parser.add_argument("--credentials", dest="creds", default=os.getenv("GCAL_CREDENTIALS", "credentials.json"))
    parser.add_argument("--token", dest="token", default=os.getenv("GCAL_TOKEN", "token.json"))
    parser.add_argument("--timezone", dest="timezone", default=DEFAULT_TZ)
    parser.add_argument(
        "--duration",
        dest="duration",
        type=int,
        default=None,
        help="Duration minutes (default: 60)",
    )
    parser.add_argument("--dry-run", dest="dry_run", action="store_true", help="Do not write to calendar")
    parser.add_argument(
        "--update-existing",
        dest="update_existing",
        action="store_true",
        help="Update existing events instead of skipping",
    )
    parser.add_argument(
        "--no-confirm",
        dest="no_confirm",
        action="store_true",
        help="Do not ask for confirmation before writing",
    )
    parser.add_argument("--date-from", dest="date_from", help="Only sync events on/after this date (YYYY-MM-DD)")
    parser.add_argument("--date-to", dest="date_to", help="Only sync events on/before this date (YYYY-MM-DD)")

    args = parser.parse_args(argv)

    if not args.calendar_id:
        parser.error("--calendar-id or CALENDAR_ID env is required")

    base_dir = Path(__file__).resolve().parents[2]
    if args.data_file:
        data_path = Path(args.data_file)
    else:
        data_path = base_dir / "data" / "schedules_enriched.json"
    if not data_path.exists():
        print(f"[error] data file not found: {data_path}", file=sys.stderr)
        return 1

    creds_path = Path(args.creds)
    token_path = Path(args.token)

    try:
        raw_text = data_path.read_text()
        source_format = args.source_format
        default_duration = DEFAULT_DURATION_MIN
        duration = args.duration if args.duration is not None else default_duration
        raw_items = load_raw_items(raw_text, source_format)
        events = load_events(raw_items, source_format, args.timezone, duration)
    except (json.JSONDecodeError, ValueError) as e:
        print(f"[error] failed to parse input data: {e}", file=sys.stderr)
        return 1

    # Optional date filtering
    if args.date_from or args.date_to:
        date_from = datetime.strptime(args.date_from, "%Y-%m-%d").date() if args.date_from else None
        date_to = datetime.strptime(args.date_to, "%Y-%m-%d").date() if args.date_to else None

        def in_range(meta: EventMeta) -> bool:
            d = datetime.strptime(meta.date, "%Y-%m-%d").date()
            if date_from and d < date_from:
                return False
            if date_to and d > date_to:
                return False
            return True

        events = [e for e in events if in_range(e["meta"])]

    if not events:
        print("[info] no valid events to sync")
        return 0

    creds = load_credentials(creds_path, token_path)
    service = build("calendar", "v3", credentials=creds)

    # Calculate time window for existing events fetch
    def meta_start(meta: EventMeta) -> datetime:
        return datetime.strptime(f"{meta.date} {meta.time}", "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo(args.timezone))

    starts = [meta_start(ev["meta"]) for ev in events]
    window_start = min(starts) - timedelta(days=1)
    window_end = max(starts) + timedelta(days=1)

    existing_start_set, _existing_events = fetch_existing_events_by_start(
        service, args.calendar_id, window_start, window_end
    )

    # Plan actions first (so we can show a preview and ask confirmation)
    planned = []
    for item in events:
        existing = find_existing_event(service, args.calendar_id, item["meta"].key)
        start_iso = item["event"]["start"]["dateTime"]
        if existing:
            action = "update" if args.update_existing else "skip"
            skip_reason = "has_key"
        elif start_iso in existing_start_set:
            action = "skip"
            skip_reason = "same_start"
        else:
            action = "create"
            skip_reason = None
        planned.append({"action": action, "item": item, "existing": existing, "skip_reason": skip_reason})

    # Preview
    summary_counts = {"create": 0, "update": 0, "skip": 0}
    for p in planned:
        summary_counts[p["action"]] += 1
    print("Planned actions:")
    for k in ["create", "update", "skip"]:
        print(f"  {k}: {summary_counts[k]}")

    show_max = 20
    print(f"Preview (up to {show_max} non-skip items):")
    shown = 0
    for p in planned:
        if p["action"] == "skip":
            continue
        if shown >= show_max:
            break
        meta = p["item"]["meta"]
        print(f"[{p['action']}] {meta.date} {meta.time} {meta.label}")
        shown += 1
    if summary_counts["create"] + summary_counts["update"] == 0:
        print("No changes to apply.")
        return 0

    # Confirmation (unless --no-confirm or dry-run)
    if not args.dry_run and not args.no_confirm:
        resp = input("Proceed with the above actions? [Enter=yes / n=no]: ").strip().lower()
        if resp in {"n", "no"}:
            print("Aborted by user.")
            return 0

    stats = {"create": 0, "update": 0, "skip": 0, "create(dry-run)": 0, "update(dry-run)": 0}
    for p in planned:
        if p["action"] == "skip":
            stats["skip"] += 1
            meta = p["item"]["meta"]
            reason = p.get("skip_reason") or "skip"
            print(f"[skip:{reason}] {meta.key} -> {meta.label}")
            continue

        result = upsert_event(
            service,
            args.calendar_id,
            p["item"]["event"],
            p["item"]["meta"],
            args.dry_run,
            args.update_existing,
            existing=p["existing"],
        )
        stats[result] = stats.get(result, 0) + 1
        print(f"[{result}] {p['item']['meta'].key} -> {p['item']['event']['summary']}")

    print("-- done --")
    for k, v in stats.items():
        if v:
            print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
