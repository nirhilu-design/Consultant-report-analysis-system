// Path: src/parsers/agreementsParser.js
// ─────────────────────────────────────────────────────────────────────────────
// AGREEMENTS PARSER — קריאה ונרמול קובץ הסכמי דמי ניהול
//
// מבנה הקובץ (verified 2025-10):
//   גיליון: "קרנות פנסיה"
//   שורה 5: כותרות קבוצות (מודל א / מודל לבעלי צבירות גבוהות)
//   שורה 6: כותרות עמודות (דמי ניהול מפרמיה / מצבירה × 2)
//   שורות 7+: נתוני יצרנים
//
//   מבנה עמודות בשורות נתון:
//     col 0: ריק
//     col 1: שם יצרן
//     col 2: מודל א — הפקדה    (דצימלי: 0.01 = 1%)
//     col 3: מודל א — צבירה    (דצימלי: 0.0015 = 0.15%)
//     col 4: מודל גבוה — הפקדה (דצימלי: 0.0175 = 1.75%)
//     col 5: מודל גבוה — צבירה (דצימלי: 0.0005 = 0.05%)
//     col 6: הערות
//
// תיקונים לעומת הגרסה הקודמת:
//   1. המרת דמי ניהול מדצימלי ל-% — הקובץ שומר 0.01, המערכת עובדת עם 1.0
//   2. זיהוי threshold צבירה גבוהה מהטקסט (300,000)
//   3. תמיכה ב-null בעמודות מודל גבוה (יצרן "מור" — אין מודל גבוה)
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

// דמי ניהול בהסכמים — הקובץ שומר דצימלי (0.01 = 1%, 0.0015 = 0.15%).
// מחזירים תמיד כאחוז (1.0, 0.15) לעקביות עם שאר המערכת.
function normalizeFeePercent(value) {
  if (value === null || value === undefined || value === "") return null;

  const num = typeof value === "number" ? value : Number(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(num)) return null;

  // ערכים מעל 20 הם לא דמי ניהול — רעש
  if (Math.abs(num) > 20) return null;

  // ערכים בין 0 ל-0.1 הם דצימלי — ממירים ל-%
  if (num !== 0 && Math.abs(num) < 0.1) return Number((num * 100).toFixed(4));

  return Number(num.toFixed(4));
}

// ─── Issuer canonical name ────────────────────────────────────────────────────

const ISSUER_MAP = {
  "הפניקס": ["הפניקס", "פניקס", "אקסלנס"],
  "הראל":   ["הראל"],
  "כלל":    ["כלל"],
  "מגדל":   ["מגדל", "מקפת"],
  "מנורה מבטחים": ["מנורה", "מבטחים"],
  "מיטב":   ["מיטב", "דש"],
  "אלטשולר שחם": ["אלטשולר"],
  "מור":    ["מור"],
  "ילין לפידות": ["ילין"],
  "אנליסט": ["אנליסט"],
  "איילון": ["איילון"],
};

function canonicalIssuer(raw) {
  const text = normalizeText(raw);
  if (!text) return null;

  for (const [canonical, aliases] of Object.entries(ISSUER_MAP)) {
    if (text === canonical) return canonical;
    if (aliases.some((alias) => text.includes(alias))) return canonical;
  }

  return text; // החזר כמו שהוא אם לא זוהה
}

// ─── Threshold detection ──────────────────────────────────────────────────────
// מחפש את סכום הצבירה המינימלי להפעלת מודל גבוה מתוך הטקסט של הגיליון

function detectAccumulationThreshold(rows) {
  const fullText = rows.map((r) => r.map((c) => String(c ?? "")).join(" ")).join(" ");

  // מחפש מספרים בסדר גודל 100,000–999,999 (כגון 300,000)
  const matches = fullText.match(/(\d{1,3}(?:,\d{3})+)/g) || [];
  const candidates = matches
    .map((m) => Number(m.replace(/,/g, "")))
    .filter((n) => n >= 100_000 && n <= 999_999);

  if (!candidates.length) return null;

  return Math.min(...candidates); // לוקחים את הקטן ביותר (= ה-threshold)
}

// ─── Row validator ────────────────────────────────────────────────────────────

function isAgreementRow(row) {
  // שורת נתון תקפה: col 1 = שם יצרן, ולפחות ערך אחד של דמי ניהול
  const issuer = normalizeText(row[1]);
  if (!issuer || issuer.startsWith("*")) return false;

  // מקור הנתון: מספרים קטנים (< 1) שמייצגים דמי ניהול דצימליים
  const hasFee = [2, 3, 4, 5].some(
    (i) => row[i] !== null && row[i] !== undefined && typeof row[i] === "number"
  );

  return Boolean(issuer) && hasFee;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseAgreements(workbook) {
  if (!workbook) return [];

  const agreements = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    if (!rows.length) return;

    // זיהוי threshold הצבירה הגבוהה מהגיליון כולו
    const accumulationThreshold = detectAccumulationThreshold(rows);

    rows.forEach((row) => {
      if (!isAgreementRow(row)) return;

      const issuerRaw = normalizeText(row[1]);
      const issuer    = canonicalIssuer(issuerRaw) || issuerRaw;

      // מודל א — כולם זכאים
      const modelADepositFee      = normalizeFeePercent(row[2]);
      const modelAAccumulationFee = normalizeFeePercent(row[3]);

      if (modelADepositFee !== null || modelAAccumulationFee !== null) {
        agreements.push({
          sheetName,
          issuer,
          issuerOriginal: issuerRaw,
          optionName:     "מודל א",
          depositFee:     modelADepositFee,
          accumulationFee: modelAAccumulationFee,
          conditionType:  "DEFAULT",
          conditionValue: null,
          isDefault:      true,
        });
      }

      // מודל צבירות גבוהות — רק אם יש ערכים
      const highDepositFee      = normalizeFeePercent(row[4]);
      const highAccumulationFee = normalizeFeePercent(row[5]);

      if (
        (highDepositFee !== null || highAccumulationFee !== null) &&
        accumulationThreshold
      ) {
        agreements.push({
          sheetName,
          issuer,
          issuerOriginal: issuerRaw,
          optionName:     "מודל צבירות גבוהות",
          depositFee:     highDepositFee,
          accumulationFee: highAccumulationFee,
          conditionType:  "MIN_ACCUMULATION",
          conditionValue: accumulationThreshold,
          isDefault:      false,
        });
      }
    });
  });

  console.log("parseAgreements result:", {
    total: agreements.length,
    issuers: [...new Set(agreements.map((a) => a.issuer))],
    threshold: agreements.find((a) => a.conditionType === "MIN_ACCUMULATION")?.conditionValue,
    sample: agreements.map((a) => ({
      issuer: a.issuer,
      model: a.optionName,
      depositFee: a.depositFee,
      accumulationFee: a.accumulationFee,
    })),
  });

  return agreements;
}
