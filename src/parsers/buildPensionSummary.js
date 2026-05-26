// Path: src/parsers/buildPensionSummary.js
// ─────────────────────────────────────────────────────────────────────────────
// BUILD PENSION SUMMARY — מחבר את כל השכבות לתוצאה מלאה
//
// סדר עבודה:
//   1. normalizeAgreementOptions  → agreementOptionsByIssuer
//   2. buildBaseUnifiedRows       → unified rows עם issuerCanonical
//   3. evaluateUnifiedRows        → audit per row
//   4. buildPensionAnalytics      → KPI, matrices, action center
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeAgreementOptions } from "../unified/agreementEngine.js";
import { buildBaseUnifiedRows }      from "../unified/rawToUnifiedRows.js";
import { evaluateUnifiedRows }       from "../unified/auditEngine.js";
import { buildPensionAnalytics }     from "../unified/analyticsEngine.js";
import { DEFAULT_ISSUER_ALIASES }    from "../unified/issuerAliases.js";
import { PRODUCT_TYPES }             from "../unified/unifiedSchema.js";

export function buildPensionSummary(pensionRows = [], agreements = [], options = {}) {
  const productType   = options.productType   || PRODUCT_TYPES.PENSION;
  const issuerAliases = options.issuerAliases || DEFAULT_ISSUER_ALIASES;
  const broker        = options.broker        || {};

  // שלב 1: נרמול הסכמים
  const { optionsByIssuer: agreementOptionsByIssuer } = normalizeAgreementOptions({
    agreements,
    issuerAliases,
    productType,
  });

  // שלב 2: בנה unified rows (issuerCanonical, normalization)
  const baseRows = buildBaseUnifiedRows({
    rows:           pensionRows,
    issuerAliases,
    productType,
    broker,
    batchId:        options.batchId || "",
  });

  // שלב 3: הרץ audit
  const unifiedRows = evaluateUnifiedRows({
    unifiedRows: baseRows,
    agreementOptionsByIssuer,
    productType,
  });

  // שלב 4: analytics
  const analytics = buildPensionAnalytics(unifiedRows);

  return {
    ...analytics,
    unifiedRows,
    agreementOptionsByIssuer,

    // שדות תאימות לאחור עבור Dashboard
    managementFeesAudit: analytics.managementAudit,
    actionCenter:        analytics.actionDrilldown,

    // סיכום עליון
    summary: {
      total:       unifiedRows.length,
      valid:       unifiedRows.filter((r) => r.auditStatus === "valid").length,
      invalid:     unifiedRows.filter((r) => r.auditStatus === "invalid").length,
      excluded:    unifiedRows.filter((r) => r.auditStatus === "excluded").length,
      tierPotential: unifiedRows.filter((r) => r.tierPotentialNotUsed).length,
      noAgreement: unifiedRows.filter((r) => !r.agreementIssuerFound && r.auditStatus !== "excluded").length,
    },
  };
}

export default buildPensionSummary;
