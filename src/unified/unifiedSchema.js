export const UNIFIED_SCHEMA_VERSION = "1.0.0";

export const PRODUCT_TYPES = {
  PENSION: "pension",
  HISHTALMUT: "hishtalmut",
};

export const SOURCE_TYPES = {
  CONSULTANT_REPORT: "consultant_report",
  AGREEMENT_FILE: "agreement_file",
  PERSONAL_DETAILS: "personal_details",
};

/**
 * Backward-compatible audit status constants.
 * Some existing files import AUDIT_STATUS, while newer files may use AUDIT_STATUSES.
 * Keep both names exported to avoid build breaks during the refactor.
 */
export const AUDIT_STATUS = {
  VALID: "VALID",
  VALID_BASELINE: "VALID_BASELINE",
  INVALID: "INVALID",
  EXCLUDED: "EXCLUDED",
  NOT_AUDITED: "NOT_AUDITED",
  NO_AGREEMENT: "NO_AGREEMENT",
};

export const AUDIT_STATUSES = AUDIT_STATUS;

export const AUDIT_STATUS_HE = {
  VALID: "תקין",
  VALID_BASELINE: "תקין לפי ברירת מחדל",
  INVALID: "לא תקין",
  EXCLUDED: "לא נכלל בבדיקה",
  NOT_AUDITED: "לא נבדק",
  NO_AGREEMENT: "ללא הסכם",
};

export const AUDIT_MODELS = {
  STANDARD_MODEL: "STANDARD_MODEL",
  MODEL_A: "MODEL_A",
  MODEL_B: "MODEL_B",
  TIER_MODEL: "TIER_MODEL",
  BASELINE: "BASELINE",
  NONE: "NONE",
};

export const ISSUE_CATEGORY = {
  NONE: "NONE",
  MANAGEMENT_FEES: "MANAGEMENT_FEES",
  NO_AGREEMENT: "NO_AGREEMENT",
  UNKNOWN_ISSUER: "UNKNOWN_ISSUER",
  MISSING_DATA: "MISSING_DATA",
  INVESTMENT_TRACK: "INVESTMENT_TRACK",
  ACCUMULATION_TIER: "ACCUMULATION_TIER",
};

export const ISSUE_CATEGORY_HE = {
  NONE: "ללא בעיה",
  MANAGEMENT_FEES: "דמי ניהול",
  NO_AGREEMENT: "ללא הסכם",
  UNKNOWN_ISSUER: "יצרן לא מוכר",
  MISSING_DATA: "נתונים חסרים",
  INVESTMENT_TRACK: "מסלול השקעה",
  ACCUMULATION_TIER: "מדרגת צבירה",
};

export const PRODUCT_CONFIGS = {
  [PRODUCT_TYPES.PENSION]: {
    productType: PRODUCT_TYPES.PENSION,
    label: "קרן פנסיה",
    supportsInsuranceTracks: true,
    supportsDepositFees: true,
    supportsCompensationTrack: true,
    supportsRewardsTrack: true,
    baselineDepositFee: 1,
    baselineAccumulationFee: 0.2,
  },

  [PRODUCT_TYPES.HISHTALMUT]: {
    productType: PRODUCT_TYPES.HISHTALMUT,
    label: "קרן השתלמות",
    supportsInsuranceTracks: false,
    supportsDepositFees: false,
    supportsCompensationTrack: false,
    supportsRewardsTrack: true,
    baselineDepositFee: null,
    baselineAccumulationFee: 0.2,
  },
};

export function getProductConfig(productType) {
  return (
    PRODUCT_CONFIGS[productType] ||
    PRODUCT_CONFIGS[PRODUCT_TYPES.PENSION]
  );
}

export const DEFAULT_UNIFIED_ROW = {
  schemaVersion: UNIFIED_SCHEMA_VERSION,

  brokerId: "",
  brokerName: "",
  batchId: "",

  sourceType: SOURCE_TYPES.CONSULTANT_REPORT,
  productType: "",

  issuerOriginal: "",
  issuerCanonical: "",

  clientId: "",
  employeeId: "",
  fullName: "",

  policyNumber: "",

  accumulation: 0,
  monthlyDeposit: 0,

  accumulationFee: 0,
  depositFee: 0,

  investmentTrackRewards: "ללא מסלול השקעה",
  investmentTrackCompensation: "ללא מסלול השקעה",
  insuranceTrack: "",

  maritalStatus: "",
  age: 0,
  gender: "",
  childrenCount: 0,

  auditStatus: null,
  auditStatusHe: "",
  auditReason: null,
  auditModel: null,
  issueCategory: ISSUE_CATEGORY.NONE,

  raw: null,
};

export const DEFAULT_AGREEMENT_ROW = {
  schemaVersion: UNIFIED_SCHEMA_VERSION,

  brokerId: "",
  brokerName: "",
  batchId: "",

  sourceType: SOURCE_TYPES.AGREEMENT_FILE,
  productType: "",

  issuerOriginal: "",
  issuerCanonical: "",

  modelName: AUDIT_MODELS.STANDARD_MODEL,

  minAccumulation: 0,

  accumulationFee: 0,
  depositFee: 0,

  raw: null,
};

export function createUnifiedRow(overrides = {}) {
  return {
    ...DEFAULT_UNIFIED_ROW,
    ...overrides,
    schemaVersion: UNIFIED_SCHEMA_VERSION,
  };
}

export function createAgreementRow(overrides = {}) {
  return {
    ...DEFAULT_AGREEMENT_ROW,
    ...overrides,
    schemaVersion: UNIFIED_SCHEMA_VERSION,
  };
}

export function isPensionRow(row) {
  return row?.productType === PRODUCT_TYPES.PENSION;
}

export function isHishtalmutRow(row) {
  return row?.productType === PRODUCT_TYPES.HISHTALMUT;
}

export function isValidUnifiedRow(row) {
  if (!row) return false;
  if (!row.productType) return false;
  if (!row.issuerCanonical) return false;

  return true;
}
