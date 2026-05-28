// Path: src/parsers/educationFundAgreementsParser.js
// CORE HARDENING v26
// EDUCATION FUND AGREEMENTS PARSER — הסכמי קרנות השתלמות
//
// Purpose:
// Parse "קרנות השתלמות - הסכמים.xlsx" into normalized agreement rows.
// Supports:
// - simple accumulation-fee rows
// - tier rows such as "עד 100K צבירה - 0.65%" / "מעל 100K צבירה - 0.5%"

import * as XLSX from "xlsx";
import {
  buildIssuerAliasLookup,
  canonicalIssuer as canonicalIssuerFromAliases,
} from "../unified/issuerAliases.js";

const EDUCATION_FUND_AGREEMENTS_PARSER_VERSION = "education_fund_agreements_v1";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/,/g, ".")
    .replace(/%/g, "")
    .replace(/[^\d.-]/g, "");

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFeePercent(value) {
  const num = normalizeNumber(value);
  if (num === null) return null;
  if (Math.abs(num) > 20) return null;

  // Excel stores 0.0065 for 0.65%.
  if (num !== 0 && Math.abs(num) < 0.1) {
    return Number((num * 100).toFixed(4));
  }

  return Number(num.toFixed(4));
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
    console.warn("parseEducationFundAgreements: failed reading sheet", {
      sheetName,
      error: error?.message || String(error),
    });
    return [];
  }
}

function asArray(row) {
  return Array.isArray(row) ? row : [];
}

const ISSUER_ALIAS_LOOKUP = buildIssuerAliasLookup();

function canonicalIssuer(raw) {
  const text = normalizeText(raw);
  if (!text) return null;
  return canonicalIssuerFromAliases(text, ISSUER_ALIAS_LOOKUP) || text;
}

function looksLikeHeader(text) {
  const normalized = normalizeText(text);
  return (
    !normalized ||
    normalized.includes("שם החברה") ||
    normalized.includes("דמי ניהול") ||
    normalized.includes("קרנות השתלמות") ||
    normalized.includes("קופות גמל")
  );
}

function parseKNumber(text) {
  const normalized = normalizeText(text);
  const kMatch = normalized.match(/(\d+(?:\.\d+)?)\s*K/i);
  if (kMatch) return Number(kMatch[1]) * 1000;

  const plainMatch = normalized.match(/(\d{2,3}(?:,\d{3})+|\d{5,7})/);
  if (plainMatch) return Number(plainMatch[1].replace(/,/g, ""));

  return null;
}

function parseFeeFromText(text) {
  const normalized = normalizeText(text);
  const percentMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*%/);

  if (percentMatch) {
    return normalizeFeePercent(percentMatch[1]);
  }

  return normalizeFeePercent(text);
}

function parseTierCondition(text) {
  const normalized = normalizeText(text);
  const threshold = parseKNumber(normalized);

  if (!threshold) {
    return {
      conditionType: "DEFAULT",
      conditionValue: null,
      optionName: "מודל ברירת מחדל",
      isDefault: true,
    };
  }

  if (/מעל|יותר|גדול/.test(normalized)) {
    return {
      conditionType: "MIN_ACCUMULATION",
      conditionValue: threshold,
      optionName: `צבירה מעל ${threshold.toLocaleString("he-IL")} ₪`,
      isDefault: false,
    };
  }

  if (/עד|מתחת|פחות/.test(normalized)) {
    return {
      conditionType: "MAX_ACCUMULATION",
      conditionValue: threshold,
      optionName: `צבירה עד ${threshold.toLocaleString("he-IL")} ₪`,
      isDefault: true,
    };
  }

  return {
    conditionType: "THRESHOLD",
    conditionValue: threshold,
    optionName: `מודל צבירה ${threshold.toLocaleString("he-IL")} ₪`,
    isDefault: false,
  };
}

function detectIssuerAndFeeColumns(rows) {
  let best = null;

  rows.slice(0, 15).forEach((rawRow) => {
    const row = asArray(rawRow);

    row.forEach((cell, index) => {
      const text = normalizeText(cell);
      if (!text) return;

      const isIssuerHeader = text.includes("שם החברה");
      const isFeeHeader = text.includes("דמי ניהול") || text.includes("מצבירה");

      if (isIssuerHeader) {
        best = {
          issuerIndex: index,
          feeIndex: index + 1,
        };
      }

      if (isFeeHeader && best) {
        best.feeIndex = index;
      }
    });
  });

  return best || { issuerIndex: 2, feeIndex: 3 };
}

export function parseEducationFundAgreements(workbook) {
  const sheetNames = getSheetNames(workbook);
  if (!sheetNames.length) return [];

  const agreements = [];

  sheetNames.forEach((sheetName) => {
    const rows = readSheetRows(workbook, sheetName);
    if (!rows.length) return;

    const layout = detectIssuerAndFeeColumns(rows);
    let activeIssuerOriginal = "";
    let activeIssuer = "";

    rows.forEach((rawRow, rowIndex) => {
      const row = asArray(rawRow);

      const issuerCell = normalizeText(row[layout.issuerIndex]);
      const feeCell = row[layout.feeIndex];

      if (looksLikeHeader(issuerCell) && looksLikeHeader(feeCell)) return;

      if (issuerCell) {
        activeIssuerOriginal = issuerCell;
        activeIssuer = canonicalIssuer(issuerCell) || issuerCell;
      }

      if (!activeIssuerOriginal) return;

      const feeText = normalizeText(feeCell);
      if (!feeText) return;

      const directFee = normalizeFeePercent(feeCell);
      const textualFee = parseFeeFromText(feeText);
      const accumulationFee = directFee !== null ? directFee : textualFee;

      if (accumulationFee === null) return;

      const tier = typeof feeCell === "string"
        ? parseTierCondition(feeCell)
        : {
            conditionType: "DEFAULT",
            conditionValue: null,
            optionName: "מודל ברירת מחדל",
            isDefault: true,
          };

      agreements.push({
        sheetName,
        sourceRowIndex: rowIndex + 1,
        parserVersion: EDUCATION_FUND_AGREEMENTS_PARSER_VERSION,

        productType: "hishtalmut",
        productLabel: "קרן השתלמות",

        issuer: activeIssuer,
        issuerOriginal: activeIssuerOriginal,

        optionName: tier.optionName,
        depositFee: null,
        accumulationFee,

        conditionType: tier.conditionType,
        conditionValue: tier.conditionValue,
        isDefault: Boolean(tier.isDefault),

        raw: row,
      });
    });
  });

  console.log("parseEducationFundAgreements:", {
    version: EDUCATION_FUND_AGREEMENTS_PARSER_VERSION,
    total: agreements.length,
    issuers: [...new Set(agreements.map((agreement) => agreement.issuerOriginal).filter(Boolean))],
    sample: agreements.slice(0, 8).map((agreement) => ({
      issuer: agreement.issuerOriginal,
      model: agreement.optionName,
      accumulationFee: agreement.accumulationFee,
      conditionType: agreement.conditionType,
      conditionValue: agreement.conditionValue,
    })),
  });

  return agreements;
}

export default parseEducationFundAgreements;
