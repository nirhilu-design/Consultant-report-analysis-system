// NEW FILE
// Path: src/unified/normalizers.js

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

export function normalizeLooseText(value) {
  return normalizeText(value)
    .replace(/[^\w\u0590-\u05FF\s/+.-]/g, "")
    .trim();
}

export function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePercent(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;

    // 0.0015 means 0.15%, while 0.15 means 0.15%.
    if (value > 0 && value < 0.05) return value * 100;

    return value;
  }

  const raw = String(value)
    .replace("%", "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  if (parsed > 0 && parsed < 0.05) return parsed * 100;

  return parsed;
}

export function isNumericOnly(value) {
  const text = normalizeText(value);
  return /^\d+(\.\d+)?$/.test(text);
}

export function getRaw(row) {
  return row?.raw?.raw || row?.raw || row || {};
}

export function getByKeys(raw, keys = []) {
  for (const key of keys) {
    if (
      raw[key] !== undefined &&
      raw[key] !== null &&
      normalizeText(raw[key])
    ) {
      return raw[key];
    }
  }

  return "";
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (normalizeText(value)) return value;
  }

  return "";
}

export function normalizeTrackName(value, fallback = "ללא מסלול השקעה") {
  const text = normalizeText(value);

  if (!text) return fallback;

  // A numeric-only value is usually a track code, not a track name.
  if (isNumericOnly(text)) return fallback;

  return text;
}

export function ageBucket(age) {
  const value = normalizeNumber(age);

  if (value === null) return "לא צוין";
  if (value < 30) return "עד 30";
  if (value < 40) return "30-39";
  if (value < 50) return "40-49";
  if (value < 60) return "50-59";

  return "60+";
}

export function accumulationBucket(accumulation) {
  const value = normalizeNumber(accumulation);

  if (value === null) return "לא צוין";
  if (value < 50000) return "0-50K";
  if (value < 100000) return "50K-100K";
  if (value < 300000) return "100K-300K";
  if (value < 500000) return "300K-500K";

  return "500K+";
}
