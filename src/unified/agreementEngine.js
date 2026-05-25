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

function normalizeAgreementRow({
  row,
  productType,
  brokerId,
  brokerName,
  batchId,
}) {
  const issuerOriginal =
    row.issuer ||
    row.company ||
    row.יצרן ||
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
        row["מודל"]
    ),

    minAccumulation:
      normalizeNumber(
        row.minAccumulation ||
          row["צבירה מינימלית"]
      ),

    accumulationFee:
      normalizeNumber(
        row.accumulationFee ||
          row["דמי ניהול מצבירה"]
      ),

    depositFee:
      productType ===
      PRODUCT_TYPES.HISHTALMUT
        ? null
        : normalizeNumber(
            row.depositFee ||
              row["דמי ניהול מהפקדה"]
          ),

    raw: row,
  });
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
