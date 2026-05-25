// NEW FILE
// Path: src/unified/unifiedSchema.js

export const PRODUCT_TYPES = {
  PENSION: "pension",
  HISHTALMUT: "hishtalmut",
};

export const PRODUCT_LABELS = {
  [PRODUCT_TYPES.PENSION]: "קרן פנסיה",
  [PRODUCT_TYPES.HISHTALMUT]: "קרן השתלמות",
};

export const DEFAULT_BROKER = {
  brokerId: "broker_001",
  brokerName: "מנהל הסדר 1",
};

export const AUDIT_STATUS = {
  VALID: "valid",
  INVALID: "invalid",
  EXCLUDED: "excluded",
};

export const AUDIT_STATUS_HE = {
  VALID: "תקין",
  INVALID: "חריג",
  EXCLUDED: "הוחרג",
};

export const ISSUE_CATEGORY = {
  NONE: "NONE",
  FEE_MISMATCH: "FEE_MISMATCH",
  MISSING_AGREEMENT: "MISSING_AGREEMENT",
  LARGE_BALANCE_NOT_OPTIMIZED: "LARGE_BALANCE_NOT_OPTIMIZED",
  MISSING_DATA: "MISSING_DATA",
};

export const PRODUCT_CONFIGS = {
  [PRODUCT_TYPES.PENSION]: {
    label: "קרן פנסיה",
    hasDepositFee: true,
    hasAccumulationFee: true,
    hasInsuranceTrack: true,
    hasInvestmentTracks: true,
    hasRewardsTrack: true,
    hasCompensationTrack: true,

    excludeOperationOnlyFromFeeAudit: true,

    withoutAgreementBaseline: {
      depositFee: 1,
      accumulationFee: 0.2,
    },
  },

  [PRODUCT_TYPES.HISHTALMUT]: {
    label: "קרן השתלמות",
    hasDepositFee: false,
    hasAccumulationFee: true,
    hasInsuranceTrack: false,
    hasInvestmentTracks: true,
    hasRewardsTrack: true,
    hasCompensationTrack: false,

    excludeOperationOnlyFromFeeAudit: false,

    withoutAgreementBaseline: {
      depositFee: null,
      accumulationFee: 0.8,
    },
  },
};

export function getProductConfig(productType) {
  return PRODUCT_CONFIGS[productType] || PRODUCT_CONFIGS[PRODUCT_TYPES.PENSION];
}

export function createEmptyUnifiedRow() {
  return {
    brokerId: "",
    brokerName: "",
    batchId: "",
    productType: "",

    sourceRowNumber: null,
    sourceSheetName: "",
    sourceFileName: "",

    clientId: "",
    clientName: "",

    serviceStatus: "",
    age: null,
    ageBucket: "לא צוין",
    maritalStatus: "לא צוין",
    gender: "",
    childrenCount: null,
    personalDetailsFound: false,

    issuerOriginal: "",
    issuerCanonical: "",

    policyNumber: "",
    fundName: "",

    insuranceTrack: "מסלול ביטוח לא צוין",

    investmentTrackRewards: "ללא מסלול השקעה",
    investmentTrackCompensation: "ללא מסלול השקעה",

    accumulation: null,
    accumulationBucket: "לא צוין",

    depositFee: null,
    accumulationFee: null,

    agreementIssuerFound: false,
    agreementOptions: [],
    agreementOptionsCount: 0,

    isExcludedFromFeeAudit: false,

    auditStatus: "",
    auditStatusHe: "",

    auditMatchResult: "",
    auditMatchModelName: "",
    auditMatchRuleType: "",

    auditReferenceDepositFee: null,
    auditReferenceAccumulationFee: null,

    auditReason: "",

    hasTierModel: false,
    eligibleTierModel: false,
    actualInTierModel: false,
    tierPotentialNotUsed: false,

    issueCategory: ISSUE_CATEGORY.NONE,
    requiredAction: "",
    priority: "",

    raw: null,
  };
}
