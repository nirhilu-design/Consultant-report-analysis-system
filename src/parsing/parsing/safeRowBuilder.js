import { asArray } from "./parsingConfidence.js";

export function attachManagerToRows(rows = [], manager = {}) {
  return asArray(rows)
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      ...row,
      arrangementManager: manager.name,
      arrangementManagerName: manager.name,
      brokerId: manager.id,
      brokerName: manager.name,
      sourceManagerId: manager.id,
      sourceManagerName: manager.name,
      raw: {
        ...(row?.raw || {}),
        arrangementManager: manager.name,
        arrangementManagerName: manager.name,
        "מנהל הסדר": manager.name,
      },
    }));
}

export function ensureRowsArray(rows, errorCode) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(errorCode);
  }

  return rows.filter((row) => row && typeof row === "object");
}

export function hasAnyAgreement(row = {}) {
  return Boolean(
    row.agreementIssuerFound ||
      row.auditMatchRuleType === "INLINE_AGREEMENT" ||
      row.auditMatchResult === "MATCH_INLINE_AGREEMENT" ||
      row.auditMatchResult === "FAIL_INLINE_AGREEMENT" ||
      (row.depositFeeAgreement !== null && row.depositFeeAgreement !== undefined && row.depositFeeAgreement !== "") ||
      (row.accumulationFeeAgreement !== null && row.accumulationFeeAgreement !== undefined && row.accumulationFeeAgreement !== "") ||
      (row.auditReferenceDepositFee !== null && row.auditReferenceDepositFee !== undefined && row.auditReferenceDepositFee !== "") ||
      (row.auditReferenceAccumulationFee !== null && row.auditReferenceAccumulationFee !== undefined && row.auditReferenceAccumulationFee !== "")
  );
}
