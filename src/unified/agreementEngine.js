export function auditUnifiedRows({
  unifiedRows = [],
  agreements = [],
}) {
  return unifiedRows.map((row) => {
    const issuer = row.issuerCanonical;

    const issuerAgreements = agreements.filter(
      (agreement) =>
        agreement.issuerCanonical === issuer &&
        agreement.productType === row.productType
    );

    if (!issuerAgreements.length) {
      return applyBaselineAudit(row);
    }

    const matchedAgreement = findMatchingAgreement(
      row,
      issuerAgreements
    );

    if (matchedAgreement) {
      return {
        ...row,
        auditStatus: "VALID",
        auditReason: matchedAgreement.reason,
        auditModel: matchedAgreement.model,
      };
    }

    return {
      ...row,
      auditStatus: "INVALID",
      auditReason: "Fees exceed approved agreement",
      auditModel: "NONE",
    };
  });
}

function findMatchingAgreement(row, agreements) {
  const accumulationFee = Number(
    row.accumulationFee || 0
  );

  const depositFee = Number(
    row.depositFee || 0
  );

  const accumulation = Number(
    row.accumulation || 0
  );

  for (const agreement of agreements) {
    const agreementAccumulationFee = Number(
      agreement.accumulationFee || 0
    );

    const agreementDepositFee = Number(
      agreement.depositFee || 0
    );

    const minAccumulation = Number(
      agreement.minAccumulation || 0
    );

    const supportsTier =
      accumulation >= minAccumulation;

    const accumulationPass =
      accumulationFee <= agreementAccumulationFee;

    const depositPass =
      row.productType === "hishtalmut"
        ? true
        : depositFee <= agreementDepositFee;

    if (
      accumulationPass &&
      depositPass &&
      supportsTier
    ) {
      return {
        model:
          minAccumulation > 0
            ? "TIER_MODEL"
            : agreement.modelName || "STANDARD_MODEL",

        reason:
          accumulationFee <
          agreementAccumulationFee
            ? "Valid via accumulation fee rule"
            : "Valid via agreement",
      };
    }
  }

  return null;
}

function applyBaselineAudit(row) {
  const accumulationFee = Number(
    row.accumulationFee || 0
  );

  const depositFee = Number(
    row.depositFee || 0
  );

  const accumulationPass =
    accumulationFee <= 0.2;

  const depositPass =
    row.productType === "hishtalmut"
      ? true
      : depositFee <= 1;

  if (accumulationPass && depositPass) {
    return {
      ...row,
      auditStatus: "VALID_BASELINE",
      auditReason:
        "Valid via baseline rule",
      auditModel: "BASELINE",
    };
  }

  return {
    ...row,
    auditStatus: "INVALID",
    auditReason:
      "Failed baseline validation",
    auditModel: "BASELINE",
  };
}
