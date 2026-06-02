// Path: src/unified/unifiedSchema.js

export const UNIFIED_SCHEMA_VERSION = "v15.0";

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
  NO_AGREEMENT: "noAgreement",
};

export const AUDIT_STATUS_HE = {
  VALID: "תקין",
  INVALID: "חריג",
  EXCLUDED: "הוחרג",
  NO_AGREEMENT: "אין הסכם",
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

export const UNIFIED_ROW_GROUPS = {
  META: "meta",
  CLIENT: "client",
  PRODUCT: "product",
  FINANCIAL: "financial",
  AGREEMENT: "agreement",
  AUDIT: "audit",
  ACTION: "action",
  RAW: "raw",
};

export const UNIFIED_REQUIRED_FIELDS = [
  "schemaVersion",
  "brokerId",
  "brokerName",
  "batchId",
  "productType",
  "sourceRowNumber",
  "clientId",
  "clientName",
  "issuerOriginal",
  "issuerCanonical",
  "policyNumber",
  "fundName",
  "accumulation",
  "depositFee",
  "accumulationFee",
  "auditStatus",
  "issueCategory",
  "raw",
];

const NUMBER_FIELDS = new Set([
  "sourceRowNumber",
  "age",
  "childrenCount",
  "accumulation",
  "depositFee",
  "accumulationFee",
  "depositFeeAgreement",
  "accumulationFeeAgreement",
  "agreementOptionsCount",
  "auditReferenceDepositFee",
  "auditReferenceAccumulationFee",
]);

const BOOLEAN_FIELDS = new Set([
  "personalDetailsFound",
  "agreementIssuerFound",
  "isOperationOnly",
  "isExcludedFromFeeAudit",
  "hasTierModel",
  "eligibleTierModel",
  "actualInTierModel",
  "tierPotentialNotUsed",
  "personalMatched",
]);

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");

  if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.") return null;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (value === null || value === undefined || value === "") return false;
  return Boolean(value);
}

function toText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).replace(/\s+/g, " ").trim();
}

export function getProductConfig(productType) {
  return PRODUCT_CONFIGS[productType] || PRODUCT_CONFIGS[PRODUCT_TYPES.PENSION];
}

export function createEmptyUnifiedRow() {
  return {
    schemaVersion: UNIFIED_SCHEMA_VERSION,

    brokerId: "",
    brokerName: "",
    batchId: "",
    productType: PRODUCT_TYPES.PENSION,

    sourceRowNumber: null,
    sourceSheetName: "",
    sourceFileName: "",

    clientId: "",
    employeeCode: "",
    clientName: "",

    personal_fullName: "",
    personal_age: null,
    personal_maritalStatus: "לא צוין",
    personal_gender: "",
    personal_childrenCount: null,
    personalMatched: false,

    serviceStatus: "",
    sourceAuditStatus: "",
    age: null,
    ageBucket: "לא צוין",
    maritalStatus: "לא צוין",
    gender: "",
    childrenCount: null,
    personalDetailsFound: false,

    issuerOriginal: "",
    issuerCanonical: "",
    arrangementManager: "",
    arrangementManagerName: "",
    personal_arrangementManagerName: "",

    policyNumber: "",
    fundName: "",

    insuranceTrack: "מסלול ביטוח לא צוין",
    investmentTrackRewards: "ללא מסלול השקעה",
    investmentTrackCompensation: "ללא מסלול השקעה",

    accumulation: null,
    accumulationBucket: "לא צוין",

    depositFee: null,
    accumulationFee: null,
    depositFeeAgreement: null,
    accumulationFeeAgreement: null,

    agreementIssuerFound: false,
    agreementOptions: [],
    agreementOptionsCount: 0,

    isOperationOnly: false,
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

export const UNIFIED_ROW_FIELD_NAMES = Object.freeze(Object.keys(createEmptyUnifiedRow()));

export function ensureUnifiedRow(row = {}) {
  const base = createEmptyUnifiedRow();
  const merged = {
    ...base,
    ...(row && typeof row === "object" ? row : {}),
    schemaVersion: row?.schemaVersion || UNIFIED_SCHEMA_VERSION,
  };

  for (const field of NUMBER_FIELDS) {
    if (field in merged) merged[field] = toNullableNumber(merged[field]);
  }

  for (const field of BOOLEAN_FIELDS) {
    if (field in merged) merged[field] = toBoolean(merged[field]);
  }

  merged.productType = PRODUCT_CONFIGS[merged.productType]
    ? merged.productType
    : PRODUCT_TYPES.PENSION;

  merged.brokerId = toText(merged.brokerId);
  merged.brokerName = toText(merged.brokerName);
  merged.batchId = toText(merged.batchId);
  merged.sourceSheetName = toText(merged.sourceSheetName);
  merged.sourceFileName = toText(merged.sourceFileName);
  merged.clientId = toText(merged.clientId);
  merged.employeeCode = toText(merged.employeeCode || merged.clientId);
  merged.clientName = toText(merged.clientName);
  merged.personal_fullName = toText(merged.personal_fullName || merged.clientName);
  merged.serviceStatus = toText(merged.serviceStatus);
  merged.sourceAuditStatus = toText(merged.sourceAuditStatus);
  merged.ageBucket = toText(merged.ageBucket, "לא צוין") || "לא צוין";
  merged.maritalStatus = toText(merged.maritalStatus, "לא צוין") || "לא צוין";
  merged.gender = toText(merged.gender);
  merged.issuerOriginal = toText(merged.issuerOriginal);
  merged.issuerCanonical = toText(merged.issuerCanonical || merged.issuerOriginal);
  merged.arrangementManager = toText(merged.arrangementManager);
  merged.arrangementManagerName = toText(merged.arrangementManagerName || merged.arrangementManager);
  merged.personal_arrangementManagerName = toText(merged.personal_arrangementManagerName || merged.arrangementManagerName);
  merged.policyNumber = toText(merged.policyNumber);
  merged.fundName = toText(merged.fundName);
  merged.insuranceTrack = toText(merged.insuranceTrack, "מסלול ביטוח לא צוין") || "מסלול ביטוח לא צוין";
  merged.investmentTrackRewards = toText(merged.investmentTrackRewards, "ללא מסלול השקעה") || "ללא מסלול השקעה";
  merged.investmentTrackCompensation = toText(merged.investmentTrackCompensation, "ללא מסלול השקעה") || "ללא מסלול השקעה";
  merged.accumulationBucket = toText(merged.accumulationBucket, "לא צוין") || "לא צוין";
  merged.auditStatus = toText(merged.auditStatus);
  merged.auditStatusHe = toText(merged.auditStatusHe);
  merged.auditMatchResult = toText(merged.auditMatchResult);
  merged.auditMatchModelName = toText(merged.auditMatchModelName);
  merged.auditMatchRuleType = toText(merged.auditMatchRuleType);
  merged.auditReason = toText(merged.auditReason);
  merged.issueCategory = toText(merged.issueCategory, ISSUE_CATEGORY.NONE) || ISSUE_CATEGORY.NONE;
  merged.requiredAction = toText(merged.requiredAction);
  merged.priority = toText(merged.priority);

  if (!Array.isArray(merged.agreementOptions)) merged.agreementOptions = [];
  merged.agreementOptionsCount = merged.agreementOptionsCount ?? merged.agreementOptions.length;

  return merged;
}

export function ensureUnifiedRows(rows = []) {
  return Array.isArray(rows) ? rows.map(ensureUnifiedRow) : [];
}

export function validateUnifiedRowShape(row = {}) {
  const normalized = ensureUnifiedRow(row);
  const missingFields = UNIFIED_REQUIRED_FIELDS.filter((field) => !(field in normalized));

  return {
    isValid: missingFields.length === 0,
    schemaVersion: normalized.schemaVersion,
    missingFields,
  };
}
