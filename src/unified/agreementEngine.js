import {
  createAgreementRow,
  PRODUCT_TYPES,
  AUDIT_MODELS,
} from "./unifiedSchema.js";

import {
  normalizeIssuerName,
} from "./issuerAliases.js";

export function normalizeAgreementRows({
  rows = [],
  productType = PRODUCT_TYPES.PENSION,
  brokerId = "",
  brokerName = "",
  batchId = "",
}) {
  return rows.map((row) =>
    normalizeAgreementRow({
      row,
      productType,
      brokerId,
      brokerName,
      batchId,
    })
  );
}

export function normalizeAgreementRow({
  row = {},
  productType = PRODUCT_TYPES.PENSION,
  brokerId = "",
  brokerName = "",
  batchId = "",
}) {
  const issuerOriginal =
    row.issuer ||
    row.company ||
    row.יצרן ||
    row["יצרן"] ||
    row["חברה מנהלת"] ||
    "";

  return createAgreementRow({
    brokerId,
    brokerName,
    batchId,

    productType,

    issuerOriginal,

    issuerCanonical:
      normalizeIssuerName(
        issuerOriginal
      ),

    modelName: normalizeModelName(
      row.modelName ||
        row.model ||
        row["מודל"] ||
        row["שם מודל"]
    ),

    minAccumulation:
      normalizeNumber(
        row.minAccumulation ||
          row.minimumAccumulation ||
          row["צבירה מינימלית"] ||
          row["מינימום צבירה"]
      ),

    accumulationFee:
      normalizeNumber(
        row.accumulationFee ||
          row.feeFromAccumulation ||
          row["דמי ניהול מצבירה"] ||
          row["דמי ניהול מצבירה %"]
      ),

    depositFee:
      productType ===
      PRODUCT_TYPES.HISHTALMUT
        ? null
        : normalizeNumber(
            row.depositFee ||
              row.feeFromDeposit ||
              row["דמי ניהול מהפקדה"] ||
              row["דמי ניהול מהפקדה %"]
          ),

    raw: row,
  });
}

/**
 * Used by auditEngine.
 * Returns true when an agreement option can be considered for the row.
 *
 * Main rule:
 * - Same product type, when provided.
 * - Same canonical issuer, when provided.
 * - Row accumulation must be at or above option minimum accumulation.
 *
 * This function intentionally does NOT validate fee pass/fail.
 * Fee comparison belongs inside auditEngine.
 */
export function isEligibleOption(row = {}, option = {}) {
  if (!row || !option) return false;

  const rowProductType =
    row.productType || "";

  const optionProductType =
    option.productType || "";

  if (
    optionProductType &&
    rowProductType &&
    optionProductType !== rowProductType
  ) {
    return false;
  }

  const rowIssuer =
    row.issuerCanonical ||
    normalizeIssuerName(
      row.issuerOriginal ||
        row.issuer ||
        row.company ||
        ""
    );

  const optionIssuer =
    option.issuerCanonical ||
    normalizeIssuerName(
      option.issuerOriginal ||
        option.issuer ||
        option.company ||
        ""
    );

  if (
    optionIssuer &&
    rowIssuer &&
    optionIssuer !== rowIssuer
  ) {
    return false;
  }

  const rowAccumulation = normalizeNumber(
    row.accumulation
  );

  const minAccumulation = normalizeNumber(
    option.minAccumulation
  );

  if (
    minAccumulation > 0 &&
    rowAccumulation < minAccumulation
  ) {
    return false;
  }

  return true;
}

export function getEligibleAgreementOptions(
  row = {},
  agreementRows = []
) {
  return agreementRows.filter((option) =>
    isEligibleOption(row, option)
  );
}

export function groupAgreementsByIssuer(
  agreementRows = []
) {
  return agreementRows.reduce(
    (acc, agreement) => {
      const issuer =
        agreement.issuerCanonical ||
        "יצרן לא מוכר";

      if (!acc[issuer]) {
        acc[issuer] = [];
      }

      acc[issuer].push(agreement);
      return acc;
    },
    {}
  );
}

function normalizeModelName(modelName) {
  const value = String(
    modelName || ""
  ).trim();

  if (!value) {
    return AUDIT_MODELS.STANDARD_MODEL;
  }

  if (/מודל א/i.test(value)) {
    return AUDIT_MODELS.MODEL_A;
  }

  if (/מודל ב/i.test(value)) {
    return AUDIT_MODELS.MODEL_B;
  }

  if (/tier/i.test(value)) {
    return AUDIT_MODELS.TIER_MODEL;
  }

  if (/מדרג/i.test(value)) {
    return AUDIT_MODELS.TIER_MODEL;
  }

  return value;
}

function normalizeNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const parsed = Number(normalized);

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}
