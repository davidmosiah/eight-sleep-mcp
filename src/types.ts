export type ResponseFormat = "markdown" | "json";
export type PrivacyMode = "summary" | "structured" | "raw";

export interface EightSleepTokenSet {
  access_token: string;
  expires_at?: number;
  user_id?: string;
}

export interface EightSleepConfig {
  email: string;
  password: string;
  clientId: string;
  clientSecret: string;
  tokenPath: string;
  privacyMode: PrivacyMode;
  cacheEnabled: boolean;
  cachePath: string;
  allowMutations: boolean;
}

export interface ToolResponse<T> extends Record<string, unknown> {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: T;
  isError?: boolean;
}
