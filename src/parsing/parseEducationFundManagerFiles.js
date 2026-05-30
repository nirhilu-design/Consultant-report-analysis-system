// Path: src/parsing/parseEducationFundManagerFiles.js
// CORE HARDENING v26B
// Education Fund Integration Layer
//
// Purpose:
// Orchestrate parsing of קרן השתלמות files as a parallel product flow.
// This file does NOT replace parseManagerFile.js and does NOT touch pension flow.

import * as XLSX from "xlsx";
import { parseEducationFund } from "../parsers/educationFundParser.js";
import { parseEducationFundAgreements } from "../parsers/educationFundAgreementsParser.js";
import {
  buildParsingConfidenceReport,
  asArray,
  safeNumber,
} from "./parsingConfidence.js";

const PRODUCT_TYPE = "hishtalmut";
const PRODUCT_LABEL = "קרן השתלמות";
const PARSER_VERSION = "education_fund_integration_v31_multi_manager";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIssuer(value) {
  return normalizeText(value)
    .replace(/בע"מ/g, "")
    .replace(/בעמ/g, "")
    .replace(/חברה מנהלת/g, "")
    .replace(/גמל ופנסיה/g, "")
    .replace(/קופות גמל/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isExcelFile(file) {
  if (!file?.name) return false;
  const lower = String(file.name).toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm");
}

async function readWorkbook(file) {
  if (!file) return null;

  if (!isExcelFile(file)) {
    throw new Error(`קובץ לא נתמך: ${file.name || "ללא שם"}`);
  }

  const buffer = await file.arrayBuffer();

  return XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
}

function getAgreementCandidates(row, agreements) {
  const rowIssuer = normalizeIssuer(row.issuerOriginal || row.manager);
  const rowAccumulation = safeNumber(row.accumulation);

  return asArray(agreements)
    .filter((agreement) => {
      const agreementIssuer = normalizeIssuer(agreement.issuerOriginal || agreement.issuer);
      if (!rowIssuer || !agreementIssuer) return false;

      return (
        rowIssuer === agreementIssuer ||
        rowIssuer.includes(agreementIssuer) ||
        agreementIssuer.includes(rowIssuer)
      );
    })
    .filter((agreement) => {
      if (!agreement.conditionType || agreement.conditionType === "DEFAULT") return true;

      if (agreement.conditionType === "MAX_ACCUMULATION") {
        return rowAccumulation <= safeNumber(agreement.conditionValue);
      }

      if (agreement.conditionType === "MIN_ACCUMULATION") {
        return rowAccumulation > safeNumber(agreement.conditionValue);
      }

      return true;
    });
}

function pickBestAgreement(row, agreements) {
  const candidates = getAgreementCandidates(row, agreements);

  if (!candidates.length) return null;

  const minMatches = candidates.filter((item) => item.conditionType === "MIN_ACCUMULATION");
  if (minMatches.length) {
    return minMatches.sort((a, b) => safeNumber(b.conditionValue) - safeNumber(a.conditionValue))[0];
  }

  const maxMatches = candidates.filter((item) => item.conditionType === "MAX_ACCUMULATION");
  if (maxMatches.length) {
    return maxMatches.sort((a, b) => safeNumber(a.conditionValue) - safeNumber(b.conditionValue))[0];
  }

  return candidates.find((item) => item.isDefault) || candidates[0];
}

function calculateFeeGap(actualFee, agreementFee) {
  if (actualFee === null || actualFee === undefined) return null;
  if (agreementFee === null || agreementFee === undefined) return null;

  const gap = Number(actualFee) - Number(agreementFee);
  if (!Number.isFinite(gap)) return null;

  return Number(gap.toFixed(4));
}

function getFeeStatus(actualFee, agreementFee, sourceStatus) {
  const normalizedSource = normalizeText(sourceStatus);

  if (normalizedSource) {
    if (normalizedSource.includes("תקין")) return "ok";
    if (normalizedSource.includes("חריג") || normalizedSource.includes("לא תקין")) return "warning";
  }

  const gap = calculateFeeGap(actualFee, agreementFee);
  if (gap === null) return "unknown";
  if (gap <= 0.0001) return "ok";
  return "warning";
}

function getManagerIdentity(manager = {}) {
  const index = Number.isFinite(Number(manager.index)) ? Number(manager.index) : 0;
  return {
    id: manager?.id || `manager_${index + 1}`,
    name: manager?.name || `מנהל הסדר ${index + 1}`,
    index,
  };
}

function toUnifiedEducationFundRow(row, agreement, manager = {}, sourceFileName = "") {
  const actualAccumulationFee = row.accumulationFee ?? null;
  const agreementAccumulationFee =
    row.accumulationFeeAgreement ??
    agreement?.accumulationFee ??
    null;

  const feeGap = calculateFeeGap(actualAccumulationFee, agreementAccumulationFee);

  const managerIdentity = getManagerIdentity(manager);

  return {
    sourceProduct: PRODUCT_TYPE,
    productType: PRODUCT_TYPE,
    productLabel: PRODUCT_LABEL,
    productFamily: "savings",

    parserVersion: PARSER_VERSION,
    sourceRowIndex: row.sourceRowIndex,
    sourceSheetName: row.sheetName,

    managerId: managerIdentity.id,
    uploadManagerName: managerIdentity.name,
    arrangementManagerId: managerIdentity.id,
    arrangementManagerName: managerIdentity.name,
    arrangementManagerIndex: managerIdentity.index,
    sourceFileName,
    issuer: row.manager || row.issuerOriginal || "",
    issuerOriginal: row.issuerOriginal || row.manager || "",
    arrangementManager: row.arrangementManager || managerIdentity.name,

    memberKey: row.employeeCode || row.idNumber || "",
    employeeCode: row.employeeCode || "",
    idNumber: row.idNumber || "",
    clientName: row.clientName || "",

    policyNumber: row.policyNumber || "",
    fundName: row.fundName || "",
    productName: row.fundName || PRODUCT_LABEL,

    policyStatus: row.policyStatus || "",
    auditStatus: row.auditStatus || "",
    feeAuditStatus: row.feeAuditStatus || "",

    investmentTrack: row.investmentTrackRewards || row.investmentTrackCompensation || "",
    investmentTrackRewards: row.investmentTrackRewards || "",
    investmentTrackCompensation: row.investmentTrackCompensation || "",

    currentBalance: safeNumber(row.accumulation),
    accumulation: safeNumber(row.accumulation),
    monthlyDeposit: safeNumber(row.lastPremium),
    lastPremium: safeNumber(row.lastPremium),

    depositFee: null,
    accumulationFee: actualAccumulationFee,
    depositFeeAgreement: null,
    accumulationFeeAgreement: agreementAccumulationFee,
    accumulationFeeGap: feeGap,
    feeStatus: getFeeStatus(actualAccumulationFee, agreementAccumulationFee, row.feeAuditStatus),

    agreementMatched: Boolean(agreement),
    agreementOptionName: agreement?.optionName || "",
    agreementConditionType: agreement?.conditionType || "",
    agreementConditionValue: agreement?.conditionValue ?? null,

    joinDate: row.joinDate || null,
    insuranceStartDate: row.insuranceStartDate || null,
    validityMonth: row.validityMonth || "",

    employerGroupId: row.employerGroupId || "",
    employerSpecificId: row.employerSpecificId || "",
    linkedEmployerId: row.linkedEmployerId || "",
    isArrangementAgent: row.isArrangementAgent,

    rawProductRow: row,
    rawAgreementRow: agreement || null,
  };
}

function buildEducationFundSummary({ rowsRaw, agreements, unifiedRows, manager = {} }) {
  const rows = asArray(unifiedRows);
  const raw = asArray(rowsRaw);
  const agreementsList = asArray(agreements);

  const issuers = [...new Set(rows.map((row) => row.issuerOriginal || row.issuer).filter(Boolean))];
  const funds = [...new Set(rows.map((row) => row.fundName).filter(Boolean))];
  const tracks = [...new Set(rows.map((row) => row.investmentTrack).filter(Boolean))];

  const totalAccumulation = rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);
  const totalMonthlyDeposits = rows.reduce((sum, row) => sum + safeNumber(row.monthlyDeposit), 0);

  const matchedAgreements = rows.filter((row) => row.agreementMatched).length;
  const feeWarnings = rows.filter((row) => row.feeStatus === "warning").length;
  const missingFees = rows.filter((row) => row.accumulationFee === null || row.accumulationFee === undefined).length;

  const agreementCoverage = rows.length
    ? Math.round((matchedAgreements / rows.length) * 100)
    : 0;

  const managerIdentity = getManagerIdentity(manager);

  return {
    productType: PRODUCT_TYPE,
    productLabel: PRODUCT_LABEL,
    parserVersion: PARSER_VERSION,
    managerId: managerIdentity.id,
    managerName: managerIdentity.name,
    arrangementManagerId: managerIdentity.id,
    arrangementManagerName: managerIdentity.name,
    rawRowCount: raw.length,
    unifiedRowCount: rows.length,
    agreementCount: agreementsList.length,
    issuerCount: issuers.length,
    fundCount: funds.length,
    trackCount: tracks.length,
    issuers,
    funds,
    tracks,
    totalAccumulation: Number(totalAccumulation.toFixed(2)),
    totalMonthlyDeposits: Number(totalMonthlyDeposits.toFixed(2)),
    matchedAgreements,
    agreementCoverage,
    feeWarnings,
    missingFees,
  };
}

function buildEducationFundWarnings({ dataFile, agreementsFile, rowsRaw, agreements, unifiedRows, summary }) {
  const warnings = [];

  if (!dataFile) warnings.push("לא הועלה קובץ מידע לקרן השתלמות.");
  if (!agreementsFile) warnings.push("לא הועלה קובץ הסכמים לקרן השתלמות.");

  if (dataFile && !asArray(rowsRaw).length) {
    warnings.push("קובץ המידע נטען, אך לא זוהו שורות קרן השתלמות.");
  }

  if (agreementsFile && !asArray(agreements).length) {
    warnings.push("קובץ ההסכמים נטען, אך לא זוהו הסכמי דמי ניהול.");
  }

  if (asArray(unifiedRows).length && summary.agreementCoverage < 80) {
    warnings.push(`כיסוי הסכמים נמוך: ${summary.agreementCoverage}% מהשורות קיבלו התאמה להסכם.`);
  }

  if (summary.feeWarnings > 0) {
    warnings.push(`נמצאו ${summary.feeWarnings} שורות שבהן דמי הניהול בפועל גבוהים מההסכם או דורשים בדיקה.`);
  }

  if (summary.missingFees > 0) {
    warnings.push(`נמצאו ${summary.missingFees} שורות ללא דמי ניהול מצבירה.`);
  }

  return [...new Set(warnings)];
}

export async function parseEducationFundManagerFiles({
  dataFile,
  agreementsFile,
  personalDetailsFile = null,
  manager = {},
} = {}) {
  const warnings = [];

  const dataWorkbook = dataFile ? await readWorkbook(dataFile) : null;
  const agreementsWorkbook = agreementsFile ? await readWorkbook(agreementsFile) : null;

  const rowsRaw = dataWorkbook ? parseEducationFund(dataWorkbook) : [];
  const agreements = agreementsWorkbook ? parseEducationFundAgreements(agreementsWorkbook) : [];

  const sourceFileName = dataFile?.name || "";
  const unifiedRows = asArray(rowsRaw).map((row) => {
    const agreement = pickBestAgreement(row, agreements);
    return toUnifiedEducationFundRow(row, agreement, manager, sourceFileName);
  });

  const summary = buildEducationFundSummary({
    rowsRaw,
    agreements,
    unifiedRows,
    manager,
  });

  warnings.push(
    ...buildEducationFundWarnings({
      dataFile,
      agreementsFile,
      rowsRaw,
      agreements,
      unifiedRows,
      summary,
    })
  );

  const parsingConfidence = buildParsingConfidenceReport({
    rawRows: rowsRaw,
    unifiedRows,
    detectedHeaders: [
      "employeeCode",
      "issuer",
      "fundName",
      "policyNumber",
      "currentBalance",
      "monthlyDeposit",
      "accumulationFee",
      "accumulationFeeAgreement",
    ],
    requiredHeaders: [
      "employeeCode",
      "issuer",
      "fundName",
      "policyNumber",
      "currentBalance",
    ],
    customWarnings: warnings,
    managerName: manager?.name || "",
    fileName: dataFile?.name || "",
  });

  const managerIdentity = getManagerIdentity(manager);

  return {
    productType: PRODUCT_TYPE,
    productLabel: PRODUCT_LABEL,
    parserVersion: PARSER_VERSION,
    managerId: getManagerIdentity(manager).id,
    managerName: getManagerIdentity(manager).name,
    arrangementManagerId: getManagerIdentity(manager).id,
    arrangementManagerName: getManagerIdentity(manager).name,

    dataFileName: dataFile?.name || "",
    agreementsFileName: agreementsFile?.name || "",
    personalDetailsFileName: personalDetailsFile?.name || "",

    rowsRaw,
    educationFundRowsRaw: rowsRaw,
    agreements,
    educationFundAgreements: agreements,
    unifiedRows,
    parsingConfidence,
    summary,
    warnings: [...new Set(warnings)],
  };
}

export default parseEducationFundManagerFiles;
