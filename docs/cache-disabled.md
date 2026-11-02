# Authenticated response caching is disabled

The connector no longer reads or writes authenticated API response caches.
`EIGHT_SLEEP_CACHE` is retained as a legacy configuration key but is ignored;
cache status explicitly returns `enabled:false`. Successful
reads return only the current provider response. Authorization failures, failed
refreshes, transient HTTP failures and network errors never return old cache data.

Existing SQLite files are left untouched for user-controlled retention/removal.
No legacy data is migrated or replayed, including after account changes, logout,
concurrent in-flight requests or provider reuse of an access token. This removes
offline fallback intentionally instead of treating a local payload as current
authorization. No secure deletion or automatic cleanup is claimed.

The isolated regression invokes the actual client with fake fetch responses and
temporary synthetic token files. Its legacy-cache sentinel is not a database:
any accidental attempt to open it should fail the test. No real accounts, network
provider calls or user data are used. Existing provider endpoints and other
authorization behavior are unchanged.
