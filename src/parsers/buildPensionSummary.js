// Path: src/parsers/buildPensionSummary.js
// ─────────────────────────────────────────────────────────────────────────────
// BUILD PENSION SUMMARY — מחבר את כל השכבות לתוצאה מלאה
//
// V93
//   1. שימוש ב-AUDIT_STATUS הרשמי במקום מחרוזות ידניות.
//   2. תמיכה ב-NO_AGREEMENT כסטטוס אמיתי מהמנוע.
//   3. noAgreement נספר לפי auditStatus בלבד, לא לפי היעדר reference.
//   4. agreementOptionsByIssuer מועבר כפי שהוא ל-auditEngine לצורך בדיקה מול כל המודלים.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeAgreementOptions } from "../unified/agreementEngine.js";
import { buildBaseUnifiedRows } from "../unified/rawToUnifiedRows.js";
import { evaluateUnifiedRows } from "../unified/auditEngine.js";
import { buildPensionAnalytics } from "../unified/analyticsEngine.js";
import { buildDataQuality } from "../unified/dataQualityEngine.js";
import { DEFAULT_ISSUER_ALIASES } from "../unified/issuerAliases.js";
import { AUDIT_STATUS, PRODUCT_TYPES } from "../unified/unifiedSchema.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
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

function getAuditStatus(row) {
  return row?.auditStatus || "";
}

function isExcluded(row) {
  return getAuditStatus(row) === AUDIT_STATUS.EXCLUDED;
}

function isNoAgreement(row) {
  return getAuditStatus(row) === AUDIT_STATUS.NO_AGREEMENT;
}

function isValid(row) {
  return getAuditStatus(row) === AUDIT_STATUS.VALID;
}

function isInvalid(row) {
  return getAuditStatus(row) === AUDIT_STATUS.INVALID;
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
  const auditedRows = unifiedRows.filter((row) => !isExcluded(row) && !isNoAgreement(row));

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
      valid: unifiedRows.filter(isValid).length,
      invalid: unifiedRows.filter(isInvalid).length,
      excluded: unifiedRows.filter(isExcluded).length,
      noAgreement: unifiedRows.filter(isNoAgreement).length,
      tierPotential: unifiedRows.filter((row) => row.tierPotentialNotUsed).length,
      dataQualityIssues: dataQuality.summary.issueCount,
      dataQualityHighIssues: dataQuality.summary.highIssues,
    },
  };
}

export default buildPensionSummary;
