#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR="${CHROME_PROFILE_DIR:-Default}"
SLACK_URL="${SLACK_WORKSPACE_URL:-https://wonder-gym.slack.com}"

open -na "Google Chrome" --args --profile-directory="${PROFILE_DIR}" "${SLACK_URL}"
