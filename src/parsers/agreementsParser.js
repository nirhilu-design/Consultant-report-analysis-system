// Path: src/parsers/agreementsParser.js
// ─────────────────────────────────────────────────────────────────────────────
// AGREEMENTS PARSER — קריאה ונרמול קובץ הסכמי דמי ניהול
//
// V91 — Pension agreements multi-option hardening
//   1. תומך רוחבית בכמה אפשרויות הסכם לכל יצרן: מודל א / מודל ב.
//   2. לא מסווג אוטומטית את העמודות השלישית-רביעית כ"מודל צבירות גבוהות".
//   3. רק אם יש סימון מפורש של צבירה/מדרגה/מעל סכום — option B יסומן MIN_ACCUMULATION.
//   4. אם אין סימון מפורש — option B היא חלופה רגילה DEFAULT, ונבדקת לכל לקוח.
//   5. מתאים רוחבית לכל יצרני קרן הפנסיה, לא רק הראל/הפניקס.
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

function extractThresholdFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const matches = normalized.match(/(\d{1,3}(?:,\d{3})+|\d{6,9})/g) || [];
  const candidates = matches
    .map((match) => Number(String(match).replace(/,/g, "")))
    .filter((num) => Number.isFinite(num) && num >= 100_000 && num <= 999_999_999);

  if (!candidates.length) return null;
  return Math.min(...candidates);
}

function detectAccumulationThreshold(rows) {
  const fullText = rows
    .map((row) => asArray(row).map((cell) => String(cell ?? "")).join(" "))
    .join(" ");

  return extractThresholdFromText(fullText);
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

function collectContextText(rows, rowIndex, feeStartIndex) {
  const parts = [];

  // מסתכלים על הכותרות/הערות שסביב אותה שורה, בעיקר סביב עמודות האפשרות השנייה.
  // זה מונע מצב שבו סכום אקראי במקום אחר בגיליון מסווג את כל מודלי ב' כצבירות גבוהות.
  const startRow = Math.max(0, rowIndex - 4);
  const endRow = Math.min(rows.length - 1, rowIndex + 1);

  for (let i = startRow; i <= endRow; i += 1) {
    const row = asArray(rows[i]);
    for (let col = Math.max(0, feeStartIndex - 2); col <= feeStartIndex + 5; col += 1) {
      if (row[col] !== null && row[col] !== undefined && normalizeText(row[col]) !== "") {
        parts.push(row[col]);
      }
    }
  }

  return normalizeText(parts.join(" "));
}

function hasOptionBText(text) {
  const normalized = normalizeText(text);
  return (
    normalized.includes("אפשרות ב") ||
    normalized.includes("חלופה ב") ||
    normalized.includes("מסלול ב") ||
    normalized.includes("מודל ב") ||
    normalized.includes("אופציה ב") ||
    normalized.includes("option b")
  );
}

function hasTierText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  const hasAccumulationWord =
    normalized.includes("צבירה") ||
    normalized.includes("צבירות") ||
    normalized.includes("יתרה") ||
    normalized.includes("נכסים") ||
    normalized.includes("accumulation") ||
    normalized.includes("balance");

  const hasThresholdWord =
    normalized.includes("מעל") ||
    normalized.includes("מדרגה") ||
    normalized.includes("גבוה") ||
    normalized.includes("גבוהות") ||
    normalized.includes("לפחות") ||
    normalized.includes("מ-") ||
    normalized.includes("over") ||
    normalized.includes("above") ||
    normalized.includes("tier");

  return hasAccumulationWord && hasThresholdWord;
}

function detectSecondOptionCondition({ rows, rowIndex, feeStartIndex, sheetThreshold }) {
  const contextText = collectContextText(rows, rowIndex, feeStartIndex);
  const localThreshold = extractThresholdFromText(contextText);

  // אם כתוב במפורש אפשרות/חלופה/מודל ב' — זו חלופה רגילה, גם אם יש מספרים בגיליון.
  if (hasOptionBText(contextText)) {
    return {
      conditionType: "DEFAULT",
      conditionValue: null,
      optionName: "מודל ב",
      isDefault: false,
      detectionReason: "OPTION_B_TEXT",
    };
  }

  // רק סימון מפורש של צבירה/מדרגה/מעל סכום הופך את המודל השני למדרגת צבירה.
  if (hasTierText(contextText) && (localThreshold || sheetThreshold)) {
    return {
      conditionType: "MIN_ACCUMULATION",
      conditionValue: localThreshold || sheetThreshold,
      optionName: "מודל צבירות גבוהות",
      isDefault: false,
      detectionReason: "EXPLICIT_TIER_TEXT",
    };
  }

  // ברירת המחדל החדשה: שתי האפשרויות הן חלופות רגילות ליצרן.
  return {
    conditionType: "DEFAULT",
    conditionValue: null,
    optionName: "מודל ב",
    isDefault: false,
    detectionReason: "FALLBACK_SECOND_DEFAULT_OPTION",
  };
}

function pushAgreement(agreements, payload) {
  if (payload.depositFee === null && payload.accumulationFee === null) return;
  agreements.push(payload);
}

export function parseAgreements(workbook) {
  const sheetNames = getSheetNames(workbook);
  if (!sheetNames.length) return [];

  const agreements = [];

  sheetNames.forEach((sheetName) => {
    const rows = readSheetRows(workbook, sheetName);
    if (!rows.length) return;

    const accumulationThreshold = detectAccumulationThreshold(rows);

    rows.forEach((rawRow, rowIndex) => {
      const row = asArray(rawRow);
      const layout = detectAgreementLayout(row);
      if (!layout) return;

      const issuerRaw = layout.issuer;
      const issuer = canonicalIssuer(issuerRaw) || issuerRaw;
      const feeStart = layout.feeStartIndex;

      const modelADepositFee = normalizeFeePercent(row[feeStart]);
      const modelAAccumulationFee = normalizeFeePercent(row[feeStart + 1]);

      pushAgreement(agreements, {
        sheetName,
        issuer,
        issuerOriginal: issuerRaw,
        parserVersion: "stability_06_v91_multi_options",
        optionName: "מודל א",
        depositFee: modelADepositFee,
        accumulationFee: modelAAccumulationFee,
        conditionType: "DEFAULT",
        conditionValue: null,
        isDefault: true,
      });

      const modelBDepositFee = normalizeFeePercent(row[feeStart + 2]);
      const modelBAccumulationFee = normalizeFeePercent(row[feeStart + 3]);

      if (modelBDepositFee !== null || modelBAccumulationFee !== null) {
        const secondOptionCondition = detectSecondOptionCondition({
          rows,
          rowIndex,
          feeStartIndex: feeStart,
          sheetThreshold: accumulationThreshold,
        });

        pushAgreement(agreements, {
          sheetName,
          issuer,
          issuerOriginal: issuerRaw,
          parserVersion: "stability_06_v91_multi_options",
          optionName: secondOptionCondition.optionName,
          depositFee: modelBDepositFee,
          accumulationFee: modelBAccumulationFee,
          conditionType: secondOptionCondition.conditionType,
          conditionValue: secondOptionCondition.conditionValue,
          isDefault: secondOptionCondition.isDefault,
          detectionReason: secondOptionCondition.detectionReason,
        });
      }
    });
  });

  console.log("parseAgreements result:", {
    version: "stability_06_v91_multi_options",
    total: agreements.length,
    issuers: [...new Set(agreements.map((agreement) => agreement.issuer))],
    byIssuer: agreements.reduce((acc, agreement) => {
      const key = agreement.issuer || "לא מזוהה";
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        model: agreement.optionName,
        conditionType: agreement.conditionType,
        conditionValue: agreement.conditionValue,
        depositFee: agreement.depositFee,
        accumulationFee: agreement.accumulationFee,
        detectionReason: agreement.detectionReason || "MODEL_A",
      });
      return acc;
    }, {}),
  });

  return agreements;
}
