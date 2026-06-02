// Path: src/parsers/executiveInsuranceAgreementsParser.js
// v66 — Executive Insurance agreements parser / הסכמי ביטוח מנהלים

import { normalizeExecutiveIssuer, normalizeFeePercent } from "./executiveInsuranceParser.js";

const PARSER_VERSION = "executive_insurance_agreements_v77";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) || [];
}

import * as XLSX from "xlsx";

function isNoAgreement(value) {
  const text = normalizeText(value);
  return !text || /אין\s*הסכם/.test(text);
}

function isOperatorOnlyAgreementValue(value) {
  const text = normalizeText(value);
  return (
    !text ||
    /^[-–—]+$/.test(text) ||
    /^\*+$/.test(text) ||
    /אין\s*הסכם/.test(text) ||
    /מתפעל|תפעול|ללא\s*דמי\s*ניהול/.test(text)
  );
}

function extractPercentCandidates(value) {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "number") {
    const normalized = normalizeFeePercent(value);
    return normalized === null ? [] : [normalized];
  }

  const text = normalizeText(value);
  if (!text) return [];

  const percentMatches = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((match) => Number(String(match[1]).replace(",", ".")))
    .filter((number) => Number.isFinite(number) && Math.abs(number) <= 20);

  if (percentMatches.length) return percentMatches;

  const normalized = normalizeFeePercent(text);
  return normalized === null ? [] : [normalized];
}

function parseAgreementFee(value) {
  if (isOperatorOnlyAgreementValue(value)) return null;
  const candidates = extractPercentCandidates(value);
  if (!candidates.length) return null;

  // When the agreement cell contains wording such as "1.25% יורד ל-1.06%",
  // the allowed ceiling for a compliance check is the highest explicit percent in that cell.
  // Large currency thresholds that appear without a percent sign are ignored.
  return Number(Math.max(...candidates).toFixed(4));
}

function getExecutivePeriodKeyFromYear(year) {
  const parsedYear = Number(year || 0);
  if (!parsedYear) return "unknown";
  if (parsedYear < 2004) return "before2004";
  if (parsedYear >= 2004 && parsedYear <= 2012) return "from2004To2013";
  return "from2013NoCoefficient";
}

function toAgreementPeriodKey(executivePeriodKey) {
  if (executivePeriodKey === "from2004To2013") return "legacy2004To2012";
  if (executivePeriodKey === "from2013NoCoefficient") return "from2013";
  return null;
}

function hasFeeValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function isOperatorOnlyAgreementPeriod(periodAgreement) {
  if (!periodAgreement) return false;
  return !hasFeeValue(periodAgreement.premiumFeePercent) && !hasFeeValue(periodAgreement.accumulationFeePercent);
}

function pickColumns(rows) {
  let issuerIndex = 0;
  let disabilityIndex = 5;
  const premiumByPeriod = {
    legacy2004To2012: 1,
    from2013: 3,
  };
  const accumulationByPeriod = {
    legacy2004To2012: 2,
    from2013: 4,
  };

  const headerRows = rows.slice(0, 8);

  headerRows.forEach((row) => {
    (row || []).forEach((cellValue, index) => {
      const textValue = normalizeText(cellValue);
      if (textValue.includes("חברת ביטוח")) issuerIndex = index;
      if (/אובדן|א\.כ\.ע|אכע/.test(textValue)) disabilityIndex = index;
    });
  });

  function findPeriodStart(pattern, fallbackIndex) {
    for (const row of headerRows) {
      const found = (row || []).findIndex((cellValue) => pattern.test(normalizeText(cellValue)));
      if (found >= 0) return found;
    }
    return fallbackIndex;
  }

  function findSubColumn(startIndex, keywords, fallbackIndex) {
    const candidates = [startIndex, startIndex + 1, startIndex + 2].filter((index) => index >= 0);
    for (const row of headerRows) {
      for (const index of candidates) {
        const textValue = normalizeText(row?.[index]);
        if (keywords.some((keyword) => textValue.includes(keyword))) return index;
      }
    }
    return fallbackIndex;
  }

  const legacyStart = findPeriodStart(/2004.*2012|2012.*2004/, 1);
  const from2013Start = findPeriodStart(/2013|לאחר\s*2013|החל\s*2013/, 3);

  premiumByPeriod.legacy2004To2012 = findSubColumn(legacyStart, ["הפקדה", "פרמיה"], legacyStart);
  accumulationByPeriod.legacy2004To2012 = findSubColumn(legacyStart, ["צבירה"], legacyStart + 1);
  premiumByPeriod.from2013 = findSubColumn(from2013Start, ["הפקדה", "פרמיה"], from2013Start);
  accumulationByPeriod.from2013 = findSubColumn(from2013Start, ["צבירה"], from2013Start + 1);

  return { issuerIndex, disabilityIndex, premiumByPeriod, accumulationByPeriod };
}

export function resolveExecutiveInsuranceAgreement(row, agreements) {
  const issuer = normalizeExecutiveIssuer(row?.issuerOriginal || row?.issuer || row?.companyName);
  const executivePeriod = getExecutivePeriodKeyFromYear(row?.insuranceStartYear);
  const agreementPeriod = toAgreementPeriodKey(executivePeriod);

  if (!agreementPeriod) return null;

  const candidates = (agreements || []).filter((agreement) => {
    const agreementIssuer = normalizeExecutiveIssuer(agreement.issuerOriginal || agreement.issuer);
    return issuer && agreementIssuer && (issuer === agreementIssuer || issuer.includes(agreementIssuer) || agreementIssuer.includes(issuer));
  });

  if (!candidates.length) return null;

  const candidate = candidates[0];
  const periodAgreement = candidate.periods?.[agreementPeriod] || null;
  if (!periodAgreement) return null;

  return {
    issuer: candidate.issuer,
    executivePeriod,
    period: agreementPeriod,
    premiumFeePercent: periodAgreement.premiumFeePercent ?? null,
    accumulationFeePercent: periodAgreement.accumulationFeePercent ?? null,
    disabilityCoverCostPercent: candidate.disabilityCoverCostPercent ?? null,
    rawPremiumAgreement: periodAgreement.rawPremiumAgreement || "",
    rawAccumulationAgreement: periodAgreement.rawAccumulationAgreement || "",
    operatorOnly: isOperatorOnlyAgreementPeriod(periodAgreement),
  };
}

export function parseExecutiveInsuranceAgreements(workbook) {
  const sheetName = workbook?.SheetNames?.[0];
  if (!sheetName) return { agreements: [], warnings: ["לא נמצאו גיליונות בקובץ ההסכמים של ביטוח מנהלים."], metadata: { parserVersion: PARSER_VERSION } };

  const rows = readSheetRows(workbook, sheetName);
  const columns = pickColumns(rows);
  const agreements = [];

  rows.slice(2).forEach((row, index) => {
    const issuerOriginal = normalizeText(row?.[columns.issuerIndex]);
    if (!issuerOriginal || issuerOriginal.includes("חברת ביטוח")) return;

    const legacyPremiumRaw = row?.[columns.premiumByPeriod.legacy2004To2012];
    const legacyAccumulationRaw = row?.[columns.accumulationByPeriod.legacy2004To2012];
    const from2013PremiumRaw = row?.[columns.premiumByPeriod.from2013];
    const from2013AccumulationRaw = row?.[columns.accumulationByPeriod.from2013];

    const legacyPeriod = {
      premiumFeePercent: parseAgreementFee(legacyPremiumRaw),
      accumulationFeePercent: parseAgreementFee(legacyAccumulationRaw),
      rawPremiumAgreement: normalizeText(legacyPremiumRaw),
      rawAccumulationAgreement: normalizeText(legacyAccumulationRaw),
    };

    const from2013Period = {
      premiumFeePercent: parseAgreementFee(from2013PremiumRaw),
      accumulationFeePercent: parseAgreementFee(from2013AccumulationRaw),
      rawPremiumAgreement: normalizeText(from2013PremiumRaw),
      rawAccumulationAgreement: normalizeText(from2013AccumulationRaw),
    };

    agreements.push({
      productType: "executiveInsurance",
      sourceRowNumber: index + 3,
      issuerOriginal,
      issuer: normalizeExecutiveIssuer(issuerOriginal) || issuerOriginal,
      disabilityCoverCostPercent: parseAgreementFee(row?.[columns.disabilityIndex]),
      periods: {
        legacy2004To2012: {
          ...legacyPeriod,
          operatorOnly: isOperatorOnlyAgreementPeriod(legacyPeriod),
        },
        from2013: {
          ...from2013Period,
          operatorOnly: isOperatorOnlyAgreementPeriod(from2013Period),
        },
      },
    });
  });

  return {
    agreements,
    warnings: agreements.length ? [] : ["קובץ הסכמים נטען, אך לא זוהו הסכמי ביטוח מנהלים."],
    metadata: {
      parserVersion: PARSER_VERSION,
      sheetName,
      agreementCount: agreements.length,
      columns,
    },
  };
}
