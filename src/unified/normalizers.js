// Path: src/unified/normalizers.js
// Stability 05:
//   1. Header alias helpers for tolerant lookup in object rows.
//   2. Safer text normalization for Hebrew/English headers.
//   3. Canonical investment track normalization without changing existing UI schema.

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

export function normalizeLooseText(value) {
  return normalizeText(value)
    .replace(/[’'`]/g, "")
    .replace(/[־–—]/g, "-")
    .replace(/[_]+/g, " ")
    .replace(/[^\w\u0590-\u05FF\s/+.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHeader(value) {
  return normalizeLooseText(value)
    .toLowerCase()
    .replace(/[.:]/g, "")
    .replace(/\s*[-/]\s*/g, " ")
    .replace(/\s+/g, " ")
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
    if (value > 0 && value < 0.05) return Number((value * 100).toFixed(4));
    return Number(value.toFixed(4));
  }

  const raw = String(value)
    .replace("%", "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  if (parsed > 0 && parsed < 0.05) return Number((parsed * 100).toFixed(4));

  return Number(parsed.toFixed(4));
}

export function isNumericOnly(value) {
  const text = normalizeText(value);
  return /^\d+(\.\d+)?$/.test(text);
}

export function getRaw(row) {
  return row?.raw?.raw || row?.raw || row || {};
}

function buildNormalizedKeyMap(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map();

  const map = new Map();

  Object.keys(raw).forEach((key) => {
    const normalized = normalizeHeader(key);
    if (normalized && !map.has(normalized)) {
      map.set(normalized, key);
    }
  });

  return map;
}

export function getByKeys(raw, keys = []) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";

  for (const key of keys) {
    if (
      raw[key] !== undefined &&
      raw[key] !== null &&
      normalizeText(raw[key])
    ) {
      return raw[key];
    }
  }

  const normalizedMap = buildNormalizedKeyMap(raw);

  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    const actualKey = normalizedMap.get(normalizedKey);

    if (
      actualKey &&
      raw[actualKey] !== undefined &&
      raw[actualKey] !== null &&
      normalizeText(raw[actualKey])
    ) {
      return raw[actualKey];
    }
  }

  for (const [normalizedActualKey, actualKey] of normalizedMap.entries()) {
    const matchedAlias = keys.some((key) => {
      const normalizedAlias = normalizeHeader(key);
      if (!normalizedAlias || normalizedAlias.length < 3) return false;
      return normalizedActualKey.includes(normalizedAlias) || normalizedAlias.includes(normalizedActualKey);
    });

    if (
      matchedAlias &&
      raw[actualKey] !== undefined &&
      raw[actualKey] !== null &&
      normalizeText(raw[actualKey])
    ) {
      return raw[actualKey];
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

export function normalizeInvestmentTrackName(value, fallback = "ללא מסלול השקעה") {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (isNumericOnly(text)) return fallback;

  const loose = normalizeLooseText(text).toLowerCase();

  if (/s\s*&?\s*p\s*500|sp\s*500|snp\s*500|500\s*s\s*p|מדד.*500|מחקה.*500/.test(loose)) {
    return "S&P 500";
  }

  if (/כללי|כללית|מסלול כללי/.test(loose)) return "כללי";
  if (/הלכה|כשר/.test(loose)) return "הלכה";
  if (/מניות|מנייתי|מנייתית/.test(loose)) return "מניות";
  if (/אגח|אג\"ח|אגרות חוב/.test(loose)) return "אג״ח";
  if (/כספי|שקלי|מקמ|מק\"מ/.test(loose)) return "כספי / שקלי";

  return text;
}

export function normalizeTrackName(value, fallback = "ללא מסלול השקעה") {
  return normalizeInvestmentTrackName(value, fallback);
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
