// Path: src/parsers/buildPensionSummary.js
// ─────────────────────────────────────────────────────────────────────────────
// BUILD PENSION SUMMARY — מחבר את כל השכבות לתוצאה מלאה
//
// סדר עבודה:
//   1. normalizeAgreementOptions  → agreementOptionsByIssuer
//   2. buildBaseUnifiedRows       → unified rows עם issuerCanonical + personalRows
//   3. evaluateUnifiedRows        → audit per row
//   4. buildPensionAnalytics      → KPI, matrices, action center
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeAgreementOptions } from "../unified/agreementEngine.js";
import { buildBaseUnifiedRows }      from "../unified/rawToUnifiedRows.js";
import { evaluateUnifiedRows }       from "../unified/auditEngine.js";
import { buildPensionAnalytics }     from "../unified/analyticsEngine.js";
import { DEFAULT_ISSUER_ALIASES }    from "../unified/issuerAliases.js";
import { PRODUCT_TYPES }             from "../unified/unifiedSchema.js";

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

function hasAnyAgreement(row) {
  return Boolean(
    row.agreementIssuerFound ||
    row.auditMatchRuleType === "INLINE_AGREEMENT" ||
    row.auditMatchResult === "MATCH_INLINE_AGREEMENT" ||
    row.auditMatchResult === "FAIL_INLINE_AGREEMENT" ||
    isPresent(row.depositFeeAgreement) ||
    isPresent(row.accumulationFeeAgreement) ||
    isPresent(row.auditReferenceDepositFee) ||
    isPresent(row.auditReferenceAccumulationFee)
  );
}

export function buildPensionSummary(
  pensionRows = [],
  agreements = [],
  options = {}
) {
  const productType   = options.productType   || PRODUCT_TYPES.PENSION;
  const issuerAliases = options.issuerAliases || DEFAULT_ISSUER_ALIASES;
  const broker        = options.broker        || {};
  const personalRows  = options.personalRows  || [];

  // שלב 1: נרמול הסכמים
  const { optionsByIssuer: agreementOptionsByIssuer } =
    normalizeAgreementOptions({
      agreements,
      issuerAliases,
      productType,
    });

  // שלב 2: בנה unified rows
  const baseRows = buildBaseUnifiedRows({
    rows: pensionRows,
    personalRows,
    issuerAliases,
    productType,
    broker,
    batchId: options.batchId || "",
  });

  // שלב 3: הרץ audit
  const unifiedRows = evaluateUnifiedRows({
    unifiedRows: baseRows,
    agreementOptionsByIssuer,
    productType,
  });

  // שלב 4: analytics
  const analytics = buildPensionAnalytics(unifiedRows);

  const auditedRows = unifiedRows.filter((r) => r.auditStatus !== "excluded");

  return {
    ...analytics,

    unifiedRows,
    agreementOptionsByIssuer,

    // תאימות לאחור עבור Dashboard
    managementFeesAudit: analytics.managementAudit,
    actionCenter: analytics.actionDrilldown,

    // סיכום עליון
    summary: {
      total: unifiedRows.length,
      audited: auditedRows.length,
      valid: unifiedRows.filter((r) => r.auditStatus === "valid").length,
      invalid: unifiedRows.filter((r) => r.auditStatus === "invalid").length,
      excluded: unifiedRows.filter((r) => r.auditStatus === "excluded").length,
      tierPotential: unifiedRows.filter((r) => r.tierPotentialNotUsed).length,
      noAgreement: auditedRows.filter((r) => !hasAnyAgreement(r)).length,
    },
  };
}

export default buildPensionSummary;
