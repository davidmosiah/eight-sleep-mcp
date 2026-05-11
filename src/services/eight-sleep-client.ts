import { URL } from "node:url";
import {
  DEFAULT_USER_AGENT,
  EIGHT_SLEEP_APP_API_URL,
  EIGHT_SLEEP_AUTH_URL,
  EIGHT_SLEEP_CLIENT_API_URL,
  TOKEN_REFRESH_BUFFER_SECONDS
} from "../constants.js";
import type { EightSleepConfig, EightSleepTokenSet } from "../types.js";
import { EightSleepCache, disabledCacheStatus, type CacheStatus } from "./cache.js";
import { redactErrorMessage } from "./redaction.js";
import { TokenStore } from "./token-store.js";

export type ApiBase = "client" | "app";
export type HttpMethod = "GET" | "PUT" | "POST" | "DELETE";

export interface RequestOptions {
  base?: ApiBase;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

interface AuthResponse {
  access_token?: string;
  expires_in?: number;
  userId?: string;
}

export class EightSleepClient {
  private readonly tokenStore: TokenStore;
  private cache?: EightSleepCache;

  constructor(private readonly config: EightSleepConfig) {
    this.tokenStore = new TokenStore(config.tokenPath);
  }

  cacheStatus(): CacheStatus {
    if (!this.config.cacheEnabled) return disabledCacheStatus(this.config.cachePath);
    return this.getCache().status();
  }

  async ensureLogin(): Promise<EightSleepTokenSet> {
    return this.getValidToken(true);
  }

  async logout(): Promise<{ ok: true; token_path: string; local_tokens_cleared: boolean }> {
    await this.tokenStore.withLock(async () => this.tokenStore.clear());
    return { ok: true, token_path: this.config.tokenPath, local_tokens_cleared: true };
  }

  async get(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<unknown> {
    return this.request("GET", path, options);
  }

  async put(path: string, body: unknown, options: Omit<RequestOptions, "body"> = {}): Promise<unknown> {
    return this.request("PUT", path, { ...options, body });
  }

  async post(path: string, body: unknown, options: Omit<RequestOptions, "body"> = {}): Promise<unknown> {
    return this.request("POST", path, { ...options, body });
  }

  async delete(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<unknown> {
    return this.request("DELETE", path, options);
  }

  private async request(method: HttpMethod, path: string, options: RequestOptions): Promise<unknown> {
    const token = await this.getValidToken(false);
    const url = this.buildUrl(path, options);
    const response = await this.fetchWithRetry(url, this.requestInit(method, token, options));

    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      const retry = await this.fetchWithRetry(url, this.requestInit(method, refreshed, options));
      return this.parseAndCache(method, url, retry);
    }

    return this.parseAndCache(method, url, response);
  }

  private requestInit(method: HttpMethod, token: EightSleepTokenSet, options: RequestOptions): RequestInit {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": DEFAULT_USER_AGENT
    };
    return {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    };
  }

  private buildUrl(path: string, options: RequestOptions): string {
    const base = options.base === "client" ? EIGHT_SLEEP_CLIENT_API_URL : EIGHT_SLEEP_APP_API_URL;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${base}${cleanPath}`);
    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async getValidToken(force: boolean): Promise<EightSleepTokenSet> {
    const tokens = await this.tokenStore.read<EightSleepTokenSet>();
    const now = Math.floor(Date.now() / 1000);
    const fresh = tokens?.access_token && tokens.expires_at && tokens.expires_at - now > TOKEN_REFRESH_BUFFER_SECONDS;
    if (!force && fresh) return tokens as EightSleepTokenSet;
    return this.refreshToken();
  }

  private async refreshToken(): Promise<EightSleepTokenSet> {
    return this.tokenStore.withLock(async () => {
      const current = await this.tokenStore.read<EightSleepTokenSet>();
      const now = Math.floor(Date.now() / 1000);
      if (current?.access_token && current.expires_at && current.expires_at - now > TOKEN_REFRESH_BUFFER_SECONDS) {
        return current;
      }
      const refreshed = await this.login();
      await this.tokenStore.write(refreshed);
      return refreshed;
    });
  }

  private async login(): Promise<EightSleepTokenSet> {
    if (!this.config.email || !this.config.password) {
      throw new Error(
        "Eight Sleep credentials are missing. Easiest fix: run `npx -y eight-sleep-mcp-unofficial setup` and paste your Eight Sleep app email/password. Or set EIGHT_SLEEP_EMAIL and EIGHT_SLEEP_PASSWORD in your environment."
      );
    }
    const body = {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "password",
      username: this.config.email,
      password: this.config.password
    };
    const response = await this.fetchWithRetry(EIGHT_SLEEP_AUTH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": DEFAULT_USER_AGENT
      },
      body: JSON.stringify(body)
    });
    const data = (await this.parseResponse(response)) as AuthResponse;
    if (!data.access_token) {
      throw new Error("Eight Sleep auth response did not include an access_token.");
    }
    return {
      access_token: data.access_token,
      expires_at: typeof data.expires_in === "number"
        ? Math.floor(Date.now() / 1000) + data.expires_in
        : undefined,
      user_id: data.userId
    };
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    const payload = text ? safeJson(text) : null;
    if (!response.ok) {
      const details = payload && typeof payload === "object" ? JSON.stringify(payload) : text;
      throw new Error(
        `Eight Sleep API HTTP ${response.status}: ${redactErrorMessage(details || response.statusText)}`
      );
    }
    return payload ?? {};
  }

  private async parseAndCache(method: HttpMethod, url: string, response: Response): Promise<unknown> {
    try {
      const payload = await this.parseResponse(response);
      if (this.config.cacheEnabled && method === "GET") {
        this.getCache().set(method, url, payload);
      }
      return payload;
    } catch (error) {
      if (this.config.cacheEnabled && method === "GET") {
        const cached = this.getCache().get(method, url);
        if (cached !== undefined) return cached;
      }
      throw error;
    }
  }

  private getCache(): EightSleepCache {
    this.cache ??= new EightSleepCache(this.config.cachePath);
    return this.cache;
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, init);
      if (response.status !== 429 && response.status < 500) return response;
      if (attempt === 2) return response;
      const retryAfter = response.headers.get("retry-after");
      const delaySeconds = retryAfter ? Math.min(Math.max(Number(retryAfter), 1), 60) : 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
    throw new Error("Unreachable retry loop state");
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
