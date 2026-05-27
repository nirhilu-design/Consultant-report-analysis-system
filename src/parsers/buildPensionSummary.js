// Path: src/parsers/buildPensionSummary.js
// ─────────────────────────────────────────────────────────────────────────────
// BUILD PENSION SUMMARY — מחבר את כל השכבות לתוצאה מלאה
//
// Stability 04:
//   1. הגנות על קלטים שאינם Array
//   2. fallback בטוח ל-dataQuality.summary
//   3. שמירה על אותו output schema כדי לא לשבור Dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeAgreementOptions } from "../unified/agreementEngine.js";
import { buildBaseUnifiedRows } from "../unified/rawToUnifiedRows.js";
import { evaluateUnifiedRows } from "../unified/auditEngine.js";
import { buildPensionAnalytics } from "../unified/analyticsEngine.js";
import { buildDataQuality } from "../unified/dataQualityEngine.js";
import { DEFAULT_ISSUER_ALIASES } from "../unified/issuerAliases.js";
import { PRODUCT_TYPES } from "../unified/unifiedSchema.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

function hasAnyAgreement(row) {
  const safeRow = asObject(row);

  return Boolean(
    safeRow.agreementIssuerFound ||
      safeRow.auditMatchRuleType === "INLINE_AGREEMENT" ||
      safeRow.auditMatchResult === "MATCH_INLINE_AGREEMENT" ||
      safeRow.auditMatchResult === "FAIL_INLINE_AGREEMENT" ||
      isPresent(safeRow.depositFeeAgreement) ||
      isPresent(safeRow.accumulationFeeAgreement) ||
      isPresent(safeRow.auditReferenceDepositFee) ||
      isPresent(safeRow.auditReferenceAccumulationFee)
  );
}

function normalizeDataQuality(dataQuality) {
  const safeDataQuality = asObject(dataQuality);
  const summary = asObject(safeDataQuality.summary);

  return {
    ...safeDataQuality,
    summary: {
      issueCount: Number.isFinite(summary.issueCount) ? summary.issueCount : 0,
      highIssues: Number.isFinite(summary.highIssues) ? summary.highIssues : 0,
      ...summary,
    },
  };
}

function emptyAnalyticsFallback() {
  return {
    managementAudit: [],
    actionDrilldown: [],
  };
}

export function buildPensionSummary(pensionRows = [], agreements = [], options = {}) {
  const safePensionRows = asArray(pensionRows);
  const safeAgreements = asArray(agreements);
  const safeOptions = asObject(options);

  const productType = safeOptions.productType || PRODUCT_TYPES.PENSION;
  const issuerAliases = safeOptions.issuerAliases || DEFAULT_ISSUER_ALIASES;
  const broker = asObject(safeOptions.broker);
  const personalRows = asArray(safeOptions.personalRows);

  const { optionsByIssuer: agreementOptionsByIssuer = {} } = normalizeAgreementOptions({
    agreements: safeAgreements,
    issuerAliases,
    productType,
  });

  const baseRows = buildBaseUnifiedRows({
    rows: safePensionRows,
    personalRows,
    issuerAliases,
    productType,
    broker,
    batchId: safeOptions.batchId || "",
  });

  const unifiedRows = asArray(
    evaluateUnifiedRows({
      unifiedRows: asArray(baseRows),
      agreementOptionsByIssuer,
      productType,
    })
  );

  const analytics = {
    ...emptyAnalyticsFallback(),
    ...asObject(buildPensionAnalytics(unifiedRows)),
  };

  const dataQuality = normalizeDataQuality(buildDataQuality(unifiedRows));
  const auditedRows = unifiedRows.filter((row) => row.auditStatus !== "excluded");

  return {
    ...analytics,

    unifiedRows,
    agreementOptionsByIssuer,
    dataQuality,

    managementFeesAudit: analytics.managementAudit,
    actionCenter: analytics.actionDrilldown,

    summary: {
      total: unifiedRows.length,
      audited: auditedRows.length,
      valid: unifiedRows.filter((row) => row.auditStatus === "valid").length,
      invalid: unifiedRows.filter((row) => row.auditStatus === "invalid").length,
      excluded: unifiedRows.filter((row) => row.auditStatus === "excluded").length,
      tierPotential: unifiedRows.filter((row) => row.tierPotentialNotUsed).length,
      noAgreement: auditedRows.filter((row) => !hasAnyAgreement(row)).length,
      dataQualityIssues: dataQuality.summary.issueCount,
      dataQualityHighIssues: dataQuality.summary.highIssues,
    },
  };
}

export default buildPensionSummary;
