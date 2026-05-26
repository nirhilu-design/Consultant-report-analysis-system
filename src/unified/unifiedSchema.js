// Path: src/unified/unifiedSchema.js

export const PRODUCT_TYPES = {
  PENSION: "pension",
  HISHTALMUT: "hishtalmut",
};

export const AUDIT_STATUS = {
  VALID: "valid",
  INVALID: "invalid",
  EXCLUDED: "excluded",
  VALID_BASELINE: "valid_baseline",
};

export const AUDIT_STATUS_HE = {
  VALID: "תקין",
  INVALID: "חריג",
  EXCLUDED: "הוחרג",
  VALID_BASELINE: "תקין לפי כלל בסיס",
};

export const AUDIT_MODELS = {
  MODEL_A: "MODEL_A",
  MODEL_B: "MODEL_B",
  TIER_MODEL: "TIER_MODEL",
  STANDARD_MODEL: "STANDARD_MODEL",
  BASELINE: "BASELINE",
  NONE: "NONE",
};

export const ISSUE_CATEGORY = {
  NONE: "NONE",
  MANAGEMENT_FEES: "MANAGEMENT_FEES",
  NO_AGREEMENT: "NO_AGREEMENT",
  UNKNOWN_ISSUER: "UNKNOWN_ISSUER",
  MISSING_DATA: "MISSING_DATA",
  OPERATIONAL_ONLY: "OPERATIONAL_ONLY",
};

export const PRODUCT_CONFIGS = {
  [PRODUCT_TYPES.PENSION]: {
    productType: PRODUCT_TYPES.PENSION,
    label: "קרן פנסיה",
    supportsDepositFees: true,
    supportsAccumulationFees: true,
    supportsInsuranceTracks: true,
    supportsRewardsTrack: true,
    supportsCompensationTrack: true,
    baselineDepositFee: 1,
    baselineAccumulationFee: 0.2,
  },

  [PRODUCT_TYPES.HISHTALMUT]: {
    productType: PRODUCT_TYPES.HISHTALMUT,
    label: "קרן השתלמות",
    supportsDepositFees: false,
    supportsAccumulationFees: true,
    supportsInsuranceTracks: false,
    supportsRewardsTrack: true,
    supportsCompensationTrack: false,
    baselineDepositFee: 0,
    baselineAccumulationFee: 0.2,
  },
};

export function getProductConfig(productType) {
  return (
    PRODUCT_CONFIGS[productType] ||
    PRODUCT_CONFIGS[PRODUCT_TYPES.PENSION]
  );
}

export function normalizeProductType(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (
    normalized === PRODUCT_TYPES.HISHTALMUT ||
    normalized.includes("השתלמות")
  ) {
    return PRODUCT_TYPES.HISHTALMUT;
  }

  return PRODUCT_TYPES.PENSION;
}

export function isValidAuditStatus(status) {
  return (
    status === AUDIT_STATUS.VALID ||
    status === AUDIT_STATUS.VALID_BASELINE
  );
}

export function isInvalidAuditStatus(status) {
  return status === AUDIT_STATUS.INVALID;
}

export function isExcludedAuditStatus(status) {
  return status === AUDIT_STATUS.EXCLUDED;
}
