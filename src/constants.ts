export const SERVER_NAME = "eight-sleep-mcp-server";
export const SERVER_VERSION = "0.2.0";
export const NPM_PACKAGE_NAME = "eight-sleep-mcp-unofficial";
export const PINNED_NPM_PACKAGE = `${NPM_PACKAGE_NAME}@${SERVER_VERSION}`;

// Eight Sleep does not publish a stable public API. These endpoints are the same
// ones the mobile app talks to; they may change without notice.
export const EIGHT_SLEEP_AUTH_URL = "https://auth-api.8slp.net/v1/tokens";
export const EIGHT_SLEEP_CLIENT_API_URL = "https://client-api.8slp.net/v1";
export const EIGHT_SLEEP_APP_API_URL = "https://app-api.8slp.net";

// Defaults extracted from the Android app — same constants used by pyEight,
// lukas-clarke/eight_sleep and steipete/eightctl. Override via env if you have
// your own.
export const DEFAULT_CLIENT_ID = "0894c7f33bb94800a03f1f4df13a4f38";
export const DEFAULT_CLIENT_SECRET =
  "f0954a3ed5763ba3d06834c73731a32f15f168f47d4f164751275def86db0c76";

export const DEFAULT_USER_AGENT = `${SERVER_NAME}/${SERVER_VERSION}`;
export const TOKEN_REFRESH_BUFFER_SECONDS = 120;

export const MIN_TEMP_LEVEL = -100;
export const MAX_TEMP_LEVEL = 100;
export const TEMP_DURATION_MIN_SECONDS = 0;
export const TEMP_DURATION_MAX_SECONDS = 60 * 60 * 12;
