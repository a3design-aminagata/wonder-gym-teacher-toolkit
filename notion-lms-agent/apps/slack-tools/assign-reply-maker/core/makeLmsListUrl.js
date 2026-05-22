import { LMS_USER_GROUPS_URL } from "../../../modules/lms/constants.js";

export function makeLmsListUrl({ month, area }) {
  return `${LMS_USER_GROUPS_URL}?prefecture=${encodeURIComponent(area)}&year=&month=${month}`;
}
