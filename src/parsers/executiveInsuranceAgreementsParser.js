// Path: src/parsers/executiveInsuranceAgreementsParser.js
// v66 — Executive Insurance agreements parser / הסכמי ביטוח מנהלים

import { normalizeExecutiveIssuer, normalizeFeePercent } from "./executiveInsuranceParser.js";

const PARSER_VERSION = "executive_insurance_agreements_v66";

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

function parseAgreementFee(value) {
  if (isNoAgreement(value)) return null;
  return normalizeFeePercent(value);
}

function pickColumns(rows) {
  let issuerIndex = 1;
  let disabilityIndex = 2;
  const premiumByPeriod = {
    legacy2004To2012: 3,
    from2013: 5,
    default: 7,
  };
  const accumulationByPeriod = {
    legacy2004To2012: 4,
    from2013: 6,
    default: 8,
  };

  rows.slice(0, 8).forEach((row) => {
    (row || []).forEach((cell, index) => {
      const text = normalizeText(cell);
      if (text.includes("חברת ביטוח")) issuerIndex = index;
      if (text.includes("א.כ.ע") || text.includes("אכע")) disabilityIndex = index;
    });
  });

  return { issuerIndex, disabilityIndex, premiumByPeriod, accumulationByPeriod };
}

export function resolveExecutiveInsuranceAgreement(row, agreements) {
  const issuer = normalizeExecutiveIssuer(row?.issuerOriginal || row?.issuer || row?.companyName);
  const year = Number(row?.insuranceStartYear || 0);
  const candidates = (agreements || []).filter((agreement) => {
    const agreementIssuer = normalizeExecutiveIssuer(agreement.issuerOriginal || agreement.issuer);
    return issuer && agreementIssuer && (issuer === agreementIssuer || issuer.includes(agreementIssuer) || agreementIssuer.includes(issuer));
  });

  if (!candidates.length) return null;

  let period = "default";
  if (year >= 2004 && year <= 2012) period = "legacy2004To2012";
  if (year >= 2013) period = "from2013";

  const candidate = candidates[0];
  const periodAgreement = candidate.periods?.[period] || candidate.periods?.default || null;

  return {
    issuer: candidate.issuer,
    period,
    premiumFeePercent: periodAgreement?.premiumFeePercent ?? null,
    accumulationFeePercent: periodAgreement?.accumulationFeePercent ?? null,
    disabilityCoverCostPercent: candidate.disabilityCoverCostPercent ?? null,
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

    agreements.push({
      productType: "executiveInsurance",
      sourceRowNumber: index + 3,
      issuerOriginal,
      issuer: normalizeExecutiveIssuer(issuerOriginal) || issuerOriginal,
      disabilityCoverCostPercent: parseAgreementFee(row?.[columns.disabilityIndex]),
      periods: {
        legacy2004To2012: {
          premiumFeePercent: parseAgreementFee(row?.[columns.premiumByPeriod.legacy2004To2012]),
          accumulationFeePercent: parseAgreementFee(row?.[columns.accumulationByPeriod.legacy2004To2012]),
        },
        from2013: {
          premiumFeePercent: parseAgreementFee(row?.[columns.premiumByPeriod.from2013]),
          accumulationFeePercent: parseAgreementFee(row?.[columns.accumulationByPeriod.from2013]),
        },
        default: {
          premiumFeePercent: parseAgreementFee(row?.[columns.premiumByPeriod.default]),
          accumulationFeePercent: parseAgreementFee(row?.[columns.accumulationByPeriod.default]),
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
    },
  };
}
