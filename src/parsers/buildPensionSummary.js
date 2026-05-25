import { PRODUCT_TYPES } from "../unified/unifiedSchema.js";
import { DEFAULT_ISSUER_ALIASES } from "../unified/issuerAliases.js";
import { normalizeAgreementOptions } from "../unified/agreementEngine.js";
import { buildBaseUnifiedRows } from "../unified/rawToUnifiedRows.js";
import { evaluateUnifiedRows } from "../unified/auditEngine.js";
import { buildPensionAnalytics } from "../unified/analyticsEngine.js";

/**
 * Builds the pension dashboard summary from parsed source rows and agreement rows.
 *
 * Important architecture rule:
 * UI components should consume this summary only. They should not parse raw rows,
 * recalculate fee compliance, or rebuild analytics directly.
 */
export function buildPensionSummary(
  pensionRows = [],
  agreements = [],
  options = {}
) {
  const {
    personalRows = [],
    broker,
    productType = PRODUCT_TYPES.PENSION,
    issuerAliases = DEFAULT_ISSUER_ALIASES,
  } = options || {};

  const { optionsByIssuer } = normalizeAgreementOptions({
    agreements,
    issuerAliases,
  });

  const baseUnifiedRows = buildBaseUnifiedRows({
    rows: pensionRows,
    personalRows,
    broker,
    productType,
    issuerAliases,
  });

  const unifiedRows = evaluateUnifiedRows({
    unifiedRows: baseUnifiedRows,
    agreementOptionsByIssuer: optionsByIssuer,
    productType,
  });

  const analytics = buildPensionAnalytics(unifiedRows);

  return {
    ...analytics,
    unifiedRows,
    agreementOptionsByIssuer: optionsByIssuer,
    sourceCounts: {
      pensionRows: pensionRows.length,
      agreements: agreements.length,
      unifiedRows: unifiedRows.length,
    },
  };
}

export default buildPensionSummary;
