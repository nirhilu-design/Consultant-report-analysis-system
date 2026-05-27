// Path: src/parsers/agreementsParser.js
// ─────────────────────────────────────────────────────────────────────────────
// AGREEMENTS PARSER — קריאה ונרמול קובץ הסכמי דמי ניהול
//
// Stability 04:
//   1. הגנות סביב workbook / SheetNames / Sheets
//   2. הגנות סביב sheet_to_json
//   3. הגנות על row שאינו Array
//   4. שמירה על אותו schema עסקי קיים
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
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

const ISSUER_MAP = {
  "הפניקס": ["הפניקס", "פניקס", "אקסלנס"],
  "הראל": ["הראל"],
  "כלל": ["כלל"],
  "מגדל": ["מגדל", "מקפת"],
  "מנורה מבטחים": ["מנורה", "מבטחים"],
  "מיטב": ["מיטב", "דש"],
  "אלטשולר שחם": ["אלטשולר"],
  "מור": ["מור"],
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

  return text;
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

    const feeIndexes = [0, 1, 2, 3].map((offset) => layout.feeStartIndex + offset);
    const hasFee = feeIndexes.some((index) => normalizeFeePercent(row[index]) !== null);

    if (hasFee) return { ...layout, issuer };
  }

  return null;
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

      const issuerRaw = layout.issuer;
      const issuer = canonicalIssuer(issuerRaw) || issuerRaw;
      const feeStart = layout.feeStartIndex;

      const modelADepositFee = normalizeFeePercent(row[feeStart]);
      const modelAAccumulationFee = normalizeFeePercent(row[feeStart + 1]);

      if (modelADepositFee !== null || modelAAccumulationFee !== null) {
        agreements.push({
          sheetName,
          issuer,
          issuerOriginal: issuerRaw,
          optionName: "מודל א",
          depositFee: modelADepositFee,
          accumulationFee: modelAAccumulationFee,
          conditionType: "DEFAULT",
          conditionValue: null,
          isDefault: true,
        });
      }

      const highDepositFee = normalizeFeePercent(row[feeStart + 2]);
      const highAccumulationFee = normalizeFeePercent(row[feeStart + 3]);

      if ((highDepositFee !== null || highAccumulationFee !== null) && accumulationThreshold) {
        agreements.push({
          sheetName,
          issuer,
          issuerOriginal: issuerRaw,
          optionName: "מודל צבירות גבוהות",
          depositFee: highDepositFee,
          accumulationFee: highAccumulationFee,
          conditionType: "MIN_ACCUMULATION",
          conditionValue: accumulationThreshold,
          isDefault: false,
        });
      }
    });
  });

  console.log("parseAgreements result:", {
    total: agreements.length,
    issuers: [...new Set(agreements.map((agreement) => agreement.issuer))],
    threshold: agreements.find((agreement) => agreement.conditionType === "MIN_ACCUMULATION")?.conditionValue,
    sample: agreements.map((agreement) => ({
      issuer: agreement.issuer,
      model: agreement.optionName,
      depositFee: agreement.depositFee,
      accumulationFee: agreement.accumulationFee,
    })),
  });

  return agreements;
}
