// url_matchers.js - URLのパターンを判定するだけの職人
import { LMS_BASE_URL } from "../../../lms/constants.js";

const LMS_HOSTNAME = (() => {
	try {
		return new URL(LMS_BASE_URL).hostname;
	} catch {
		return "wonder-gym.jp";
	}
})();

export function isWonderGymUrl(url) {
	try {
		return new URL(url).hostname === LMS_HOSTNAME;
	} catch {
		return false;
	}
}

export function isChatGPTUrl(url) {
	try {
		const u = new URL(url);
		return u.hostname === "chatgpt.com";
	} catch {
		return false;
	}
}

export function isP5TargetUrl(href) {
	if (!href) return false;
	// Wonder Gym または Google Docs を P5 で開く
	return isWonderGymUrl(href) || href.includes("docs.google.com");
}
