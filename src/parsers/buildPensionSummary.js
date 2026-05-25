import { PRODUCT_TYPES } from "../unified/unifiedSchema.js";
import { DEFAULT_ISSUER_ALIASES } from "../unified/issuerAliases.js";
import { normalizeAgreementOptions } from "../unified/agreementEngine.js";
import { buildBaseUnifiedRows } from "../unified/rawToUnifiedRows.js";
import { evaluateUnifiedRows } from "../unified/auditEngine.js";
import { buildPensionAnalytics } from "../unified/analyticsEngine.js";

export function buildPensionSummary(pensionRows = [], agreements = [], options = {}) {
  const productType = options.productType || PRODUCT_TYPES.PENSION;

  const agreementOptionsByIssuer = normalizeAgreementOptions({
    agreements,
    aliases: options.aliases || DEFAULT_ISSUER_ALIASES,
    productType,
  });

  const baseUnifiedRows = buildBaseUnifiedRows({
    rows: pensionRows,
    aliases: options.aliases || DEFAULT_ISSUER_ALIASES,
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
  };
}

export default buildPensionSummary;
