import type { EightSleepConfig, PrivacyMode } from "../types.js";

const SENSITIVE_KEYS = new Set([
  "email",
  "phone",
  "phoneNumber",
  "address",
  "shippingAddress",
  "lastFour",
  "lastFourDigits",
  "stripeCustomerId",
  "creditCardLast4",
  "deviceId",
  "podSerial",
  "macAddress",
  "leftUserId",
  "rightUserId"
]);

const SUMMARY_KEEPERS = new Set([
  "userId",
  "firstName",
  "id",
  "currentLevel",
  "currentDeviceLevel",
  "smartTemperatures",
  "isOn",
  "alarmId",
  "enabled",
  "nextTimestamp",
  "presenceStart",
  "presenceEnd",
  "sleepStart",
  "sleepEnd",
  "score",
  "fitnessScore",
  "tnt",
  "stages"
]);

export function resolvePrivacyMode(config: EightSleepConfig, override?: PrivacyMode): PrivacyMode {
  return override ?? config.privacyMode;
}

export function applyPrivacy(endpoint: string, payload: unknown, mode: PrivacyMode): unknown {
  if (mode === "raw") return payload;
  return walk(payload, mode);
}

function walk(value: unknown, mode: PrivacyMode): unknown {
  if (Array.isArray(value)) return value.map((item) => walk(item, mode));
  if (!isObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (mode === "summary" && !SUMMARY_KEEPERS.has(key) && !isObject(nested) && !Array.isArray(nested)) {
      continue;
    }
    out[key] = walk(nested, mode);
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
