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

export const AUDIT_STATUSES = {
  VALID: "VALID",
  VALID_BASELINE: "VALID_BASELINE",
  INVALID: "INVALID",
  EXCLUDED: "EXCLUDED",
};

export const AUDIT_MODELS = {
  STANDARD_MODEL: "STANDARD_MODEL",
  MODEL_A: "MODEL_A",
  MODEL_B: "MODEL_B",
  TIER_MODEL: "TIER_MODEL",
  BASELINE: "BASELINE",
  NONE: "NONE",
};

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
  auditReason: null,
  auditModel: null,

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
