/**
 * Shared query params for GET /users/{id}/trends.
 *
 * Eight Sleep rejects requests that send both `include-main` and
 * `include-all-sessions`. Keep only `include-all-sessions` so `days[]`
 * includes per-session payloads.
 */
export interface TrendsQueryWindow {
  timezone: string;
  from: string;
  to: string;
}

export function buildTrendsQueryParams(window: TrendsQueryWindow): Record<string, string | boolean> {
  return {
    tz: window.timezone,
    from: window.from,
    to: window.to,
    "include-all-sessions": true,
    "model-version": "v2"
  };
}

export function trendsQueryHasConflictingIncludes(params: Record<string, unknown> | undefined): boolean {
  if (!params) return false;
  return isRequestedFlag(params["include-main"]) && isRequestedFlag(params["include-all-sessions"]);
}

function isRequestedFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}
