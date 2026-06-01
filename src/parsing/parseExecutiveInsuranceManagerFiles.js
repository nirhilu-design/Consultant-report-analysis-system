// Path: src/parsing/parseExecutiveInsuranceManagerFiles.js
// v66 — Executive Insurance integration layer

import * as XLSX from "xlsx";
import { parseExecutiveInsurance } from "../parsers/executiveInsuranceParser.js";
import {
  parseExecutiveInsuranceAgreements,
  resolveExecutiveInsuranceAgreement,
} from "../parsers/executiveInsuranceAgreementsParser.js";

const PRODUCT_TYPE = "executiveInsurance";
const PRODUCT_LABEL = "ביטוח מנהלים";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/[״"]/g, "")
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
  if (!isExcelFile(file)) throw new Error(`קובץ לא נתמך: ${file.name || "ללא שם"}`);

  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
}

function compareFee(actual, allowed) {
  if (actual === null || actual === undefined) return false;
  if (allowed === null || allowed === undefined) return false;
  return safeNumber(actual) <= safeNumber(allowed) + 0.0001;
}

function getFeeStatus(row, agreement) {
  if (!agreement) return "לא תקין";

  const premiumOk = compareFee(row.actualPremiumFeePercent, agreement.premiumFeePercent);
  const accumulationOk = compareFee(row.actualAccumulationFeePercent, agreement.accumulationFeePercent);

  if (premiumOk && accumulationOk) return "תקין";
  return "לא תקין";
}

function buildSummary(rows, agreements) {
  const issuers = [...new Set(rows.map((row) => normalizeText(row.issuer || row.companyName)).filter(Boolean))];
  const activeRows = rows.filter((row) => !/מסולק|לא פעיל/.test(normalizeText(row.activeStatus || row.policyStatus)));
  const feeOk = rows.filter((row) => row.feeStatus === "תקין").length;
  const feeNotOk = rows.filter((row) => row.feeStatus !== "תקין").length;

  return {
    productType: PRODUCT_TYPE,
    productLabel: PRODUCT_LABEL,
    rawRowCount: rows.length,
    unifiedRowCount: rows.length,
    issuerCount: issuers.length,
    issuers,
    agreementCount: agreements.length,
    activePolicyCount: activeRows.length,
    inactivePolicyCount: Math.max(rows.length - activeRows.length, 0),
    totalAccumulation: rows.reduce((sum, row) => sum + safeNumber(row.totalAccumulation), 0),
    totalDeathCover: rows.reduce((sum, row) => sum + safeNumber(row.deathCoverAmount), 0),
    feeOk,
    feeNotOk,
    feeWarnings: feeNotOk,
    feeComplianceRate: rows.length ? Math.round((feeOk / rows.length) * 100) : 0,
  };
}

export async function parseExecutiveInsuranceManagerFiles({ dataFile, agreementsFile, manager = {} }) {
  const warnings = [];

  const dataWorkbook = await readWorkbook(dataFile);
  const agreementWorkbook = await readWorkbook(agreementsFile);

  const parsedData = parseExecutiveInsurance(dataWorkbook);
  const parsedAgreements = parseExecutiveInsuranceAgreements(agreementWorkbook);

  warnings.push(...asArray(parsedData.warnings), ...asArray(parsedAgreements.warnings));

  const agreements = asArray(parsedAgreements.agreements);
  const rows = asArray(parsedData.rows).map((row) => {
    const agreement = resolveExecutiveInsuranceAgreement(row, agreements);
    const feeStatus = getFeeStatus(row, agreement);

    return {
      ...row,
      arrangementManagerId: manager?.id || "",
      arrangementManagerName: manager?.name || row.arrangementManagerName || "מנהל הסדר",
      uploadManagerName: manager?.name || "מנהל הסדר",
      agreementPremiumFeePercent: agreement?.premiumFeePercent ?? null,
      agreementAccumulationFeePercent: agreement?.accumulationFeePercent ?? null,
      agreementPeriod: agreement?.period || "",
      feeStatus,
      feeStatusLabel: feeStatus,
      feeIssue: feeStatus === "תקין" ? "" : "דמי ניהול בפועל אינם עומדים בהסכם או חסר הסכם/נתון",
    };
  });

  const summary = buildSummary(rows, agreements);

  return {
    productMode: PRODUCT_TYPE,
    productType: PRODUCT_TYPE,
    productLabel: PRODUCT_LABEL,
    manager,
    unifiedRows: rows,
    rawRows: rows,
    executiveInsuranceRows: rows,
    agreements,
    executiveInsuranceAgreements: agreements,
    summary,
    warnings,
    counts: {
      rawRows: rows.length,
      unifiedRows: rows.length,
      agreements: agreements.length,
    },
    metadata: {
      data: parsedData.metadata,
      agreements: parsedAgreements.metadata,
    },
  };
}
