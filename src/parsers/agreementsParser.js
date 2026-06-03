// Path: src/parsers/agreementsParser.js
// ─────────────────────────────────────────────────────────────────────────────
// AGREEMENTS PARSER — קריאה ונרמול קובץ הסכמי דמי ניהול
//
// V93 — Dynamic multi-option agreements parser
//   1. קורא דינמית זוגות עמודות של דמי ניהול לכל יצרן: הפקדה + צבירה.
//   2. תומך ביותר משתי אפשרויות: מודל א, מודל ב, מודל ג, מודל ד וכו'.
//   3. ברירת מחדל: כל זוג דמי ניהול הוא DEFAULT, כלומר חלופה רגילה לבדיקה.
//   4. רק אם יש סימון מפורש של מדרגת צבירה / צבירות גבוהות / סף צבירה,
//      האפשרות תסווג כ-MIN_ACCUMULATION.
//   5. אין דריסה של מודלים קיימים — כל האפשרויות נשמרות במערך תחת אותו יצרן.
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";
import { buildIssuerAliasLookup, canonicalIssuer as canonicalIssuerFromAliases } from "../unified/issuerAliases.js";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function normalizeForSearch(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[־–—_-]/g, " ")
    .replace(/[.:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFeePercent(value) {
  if (value === null || value === undefined || value === "") return null;

  const num =
    typeof value === "number"
      ? value
      : Number(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));

  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) > 20) return null;
  if (num !== 0 && Math.abs(num) < 0.1) return Number((num * 100).toFixed(4));

  return Number(num.toFixed(4));
}

const ISSUER_ALIAS_LOOKUP = buildIssuerAliasLookup();

function canonicalIssuer(raw) {
  const text = normalizeText(raw);
  if (!text) return null;

  return canonicalIssuerFromAliases(text, ISSUER_ALIAS_LOOKUP);
}

function asArray(row) {
  return Array.isArray(row) ? row : [];
}

function getSheetNames(workbook) {
  return Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) return [];

  try {
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn("parseAgreements: failed reading sheet", {
      sheetName,
      error: error?.message || String(error),
    });
    return [];
  }
}

function detectAccumulationThreshold(rows) {
  const fullText = rows
    .map((row) => asArray(row).map((cell) => String(cell ?? "")).join(" "))
    .join(" ");

  const matches = fullText.match(/(\d{1,3}(?:,\d{3})+)/g) || [];
  const candidates = matches
    .map((match) => Number(match.replace(/,/g, "")))
    .filter((num) => num >= 100_000 && num <= 999_999);

  if (!candidates.length) return null;
  return Math.min(...candidates);
}

function detectAgreementLayout(rawRow) {
  const row = asArray(rawRow);
  if (!row.length) return null;

  const candidates = [
    { issuerIndex: 0, feeStartIndex: 1 },
    { issuerIndex: 1, feeStartIndex: 2 },
  ];

  for (const layout of candidates) {
    const issuer = normalizeText(row[layout.issuerIndex]);
    if (!issuer || issuer.startsWith("*") || /^\d+(?:\.\d+)?$/.test(issuer)) continue;

    const feeIndexes = [];
    for (let index = layout.feeStartIndex; index < row.length; index += 1) {
      feeIndexes.push(index);
    }

    const hasFee = feeIndexes.some((index) => normalizeFeePercent(row[index]) !== null);

    if (hasFee) return { ...layout, issuer };
  }

  return null;
}

function hasExplicitTierText(value) {
  const text = normalizeForSearch(value);
  if (!text) return false;

  return (
    text.includes("צבירות גבוהות") ||
    text.includes("צבירה גבוהה") ||
    text.includes("מדרגת צבירה") ||
    text.includes("סף צבירה") ||
    text.includes("מעל צבירה") ||
    text.includes("מעל") && text.includes("צבירה") ||
    text.includes("min accumulation") ||
    text.includes("min_accumulation")
  );
}

function hasDefaultOptionText(value) {
  const text = normalizeForSearch(value);
  if (!text) return false;

  return (
    text.includes("אפשרות") ||
    text.includes("חלופה") ||
    text.includes("מודל") ||
    text.includes("option") ||
    text.includes("model")
  );
}

function buildOptionName(index, markerText = "") {
  const marker = normalizeText(markerText);
  if (marker && hasDefaultOptionText(marker)) return marker;

  const hebrewLetters = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י"];
  const suffix = hebrewLetters[index] || String(index + 1);
  return `מודל ${suffix}`;
}

function detectOptionMarker(row, feeIndex) {
  // מחפש טקסט קרוב לזוג העמודות שמסביר את סוג המודל.
  // ברוב הקבצים הכותרת/סימון יושבים באחת העמודות של הזוג או מעט לפניהן.
  const candidateIndexes = [feeIndex - 1, feeIndex, feeIndex + 1].filter((index) => index >= 0);
  const markers = candidateIndexes
    .map((index) => normalizeText(row[index]))
    .filter((value) => value && normalizeFeePercent(value) === null);

  return markers.join(" ");
}

function buildAgreementOption({
  sheetName,
  issuer,
  issuerRaw,
  optionIndex,
  depositFee,
  accumulationFee,
  markerText,
  accumulationThreshold,
}) {
  const explicitTier = hasExplicitTierText(markerText);

  return {
    sheetName,
    issuer,
    issuerOriginal: issuerRaw,
    parserVersion: "stability_06_v93_dynamic_options",
    optionName: explicitTier ? normalizeText(markerText) || "מודל צבירות גבוהות" : buildOptionName(optionIndex, markerText),
    depositFee,
    accumulationFee,
    conditionType: explicitTier && accumulationThreshold ? "MIN_ACCUMULATION" : "DEFAULT",
    conditionValue: explicitTier && accumulationThreshold ? accumulationThreshold : null,
    isDefault: !explicitTier,
  };
}

function extractAgreementOptionsFromRow({ row, layout, sheetName, accumulationThreshold }) {
  const issuerRaw = layout.issuer;
  const issuer = canonicalIssuer(issuerRaw) || issuerRaw;
  const options = [];
  let optionIndex = 0;

  // כל option הוא זוג עמודות: דמי ניהול מהפקדה + דמי ניהול מצבירה.
  // ממשיכים עד סוף השורה, ומדלגים על זוגות ריקים.
  for (let feeIndex = layout.feeStartIndex; feeIndex < row.length; feeIndex += 2) {
    const depositFee = normalizeFeePercent(row[feeIndex]);
    const accumulationFee = normalizeFeePercent(row[feeIndex + 1]);

    if (depositFee === null && accumulationFee === null) continue;

    const markerText = detectOptionMarker(row, feeIndex);

    options.push(
      buildAgreementOption({
        sheetName,
        issuer,
        issuerRaw,
        optionIndex,
        depositFee,
        accumulationFee,
        markerText,
        accumulationThreshold,
      })
    );

    optionIndex += 1;
  }

  return options;
}

export function parseAgreements(workbook) {
  const sheetNames = getSheetNames(workbook);
  if (!sheetNames.length) return [];

  const agreements = [];

  sheetNames.forEach((sheetName) => {
    const rows = readSheetRows(workbook, sheetName);
    if (!rows.length) return;

    const accumulationThreshold = detectAccumulationThreshold(rows);

    rows.forEach((rawRow) => {
      const row = asArray(rawRow);
      const layout = detectAgreementLayout(row);
      if (!layout) return;

      agreements.push(
        ...extractAgreementOptionsFromRow({
          row,
          layout,
          sheetName,
          accumulationThreshold,
        })
      );
    });
  });

  console.log("parseAgreements result:", {
    version: "stability_06_v93_dynamic_options",
    total: agreements.length,
    issuers: [...new Set(agreements.map((agreement) => agreement.issuer))],
    countsByIssuer: agreements.reduce((acc, agreement) => {
      const key = agreement.issuer || "לא מזוהה";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    sample: agreements.map((agreement) => ({
      issuer: agreement.issuer,
      model: agreement.optionName,
      depositFee: agreement.depositFee,
      accumulationFee: agreement.accumulationFee,
      conditionType: agreement.conditionType,
      conditionValue: agreement.conditionValue,
    })),
  });

  return agreements;
}
