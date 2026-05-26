import { PRODUCT_TYPES } from "../unified/unifiedSchema.js";
import { DEFAULT_ISSUER_ALIASES } from "../unified/issuerAliases.js";
import { normalizeAgreementOptions } from "../unified/agreementEngine.js";
import { buildBaseUnifiedRows } from "../unified/rawToUnifiedRows.js";
import { evaluateUnifiedRows } from "../unified/auditEngine.js";
import { buildPensionAnalytics } from "../unified/analyticsEngine.js";

export function buildPensionSummary(pensionRows = [], agreements = [], options = {}) {
  const productType = options.productType || PRODUCT_TYPES.PENSION;
  const issuerAliases = options.aliases || options.issuerAliases || DEFAULT_ISSUER_ALIASES;

  const agreementNormalization = normalizeAgreementOptions({
    agreements,
    issuerAliases,
    productType,
  });

  const agreementOptionsByIssuer =
    agreementNormalization?.optionsByIssuer || agreementNormalization || {};

  const baseUnifiedRows = buildBaseUnifiedRows({
    rows: pensionRows,
    issuerAliases,
    productType,
    broker: options.broker,
    batchId: options.batchId,
  });

  const unifiedRows = evaluateUnifiedRows({
    unifiedRows: baseUnifiedRows,
    agreementOptionsByIssuer,
    productType,
  });

  const analytics = buildPensionAnalytics(unifiedRows);

  return {
    ...analytics,
    unifiedRows,
    agreementOptionsByIssuer,
    noAgreementPolicies: unifiedRows.filter((row) => !row.agreementIssuerFound).length,

    // Backward-compatible aliases for Dashboard variants that use older names.
    managementFeesAudit: analytics.managementAudit,
    actionCenter: analytics.actionDrilldown,
  };
}

export default buildPensionSummary;
