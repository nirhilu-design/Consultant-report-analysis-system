// Path: src/unified/auditEngine.js

import {
  AUDIT_STATUS as SCHEMA_AUDIT_STATUS,
  AUDIT_STATUS_HE as SCHEMA_AUDIT_STATUS_HE,
  ISSUE_CATEGORY as SCHEMA_ISSUE_CATEGORY,
  PRODUCT_TYPES,
  ensureUnifiedRow,
  ensureUnifiedRows,
  getProductConfig,
} from "./unifiedSchema.js";

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT ENGINE — מנוע בדיקת דמי ניהול
//
// סדר בדיקה:
//   1. תפעול בלבד / ללא שיווק → excluded
//   2. הסכם פנימי מתוך דוח היועץ → INLINE_AGREEMENT
//   3. קרנות ברירת מחדל → DEFAULT_PENSION_FUND
//      כלל עסקי:
//        - ברירת מחדל רגילה: עד 1% מהפקדה ועד 0.22% מצבירה
//        - מור: עד 1% מהפקדה ועד 0.15% מצבירה
//   4. קובץ הסכמים חיצוני → EXTERNAL_AGREEMENT
//   5. כלל בסיס fallback → BASELINE
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIT_STATUS = SCHEMA_AUDIT_STATUS;

export const AUDIT_STATUS_HE = {
  valid: SCHEMA_AUDIT_STATUS_HE.VALID || "תקין",
  invalid: SCHEMA_AUDIT_STATUS_HE.INVALID || "לא תקין",
  excluded: SCHEMA_AUDIT_STATUS_HE.EXCLUDED || "תפעול בלבד",
};

export const ISSUE_CATEGORY = {
  ...SCHEMA_ISSUE_CATEGORY,
  TIER_POTENTIAL_NOT_USED: "TIER_POTENTIAL_NOT_USED",
};

export const PRIORITY = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  NONE: "",
};

const BASELINE = {
  depositFee: 1.0,
  accumulationFee: 0.5,
};

const DEFAULT_PENSION_FUND_LIMITS = {
  depositFee: 1.0,
  accumulationFee: 0.22,
};

const MOR_DEFAULT_PENSION_FUND_LIMITS = {
  depositFee: 1.0,
  accumulationFee: 0.15,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeRows(rows) {
  return ensureUnifiedRows(Array.isArray(rows) ? rows.filter(Boolean) : []);
}

function safeRow(row) {
  return ensureUnifiedRow(row && typeof row === "object" ? row : {});
}

function getProductType(row) {
  return getProductConfig(row?.productType) ? row.productType : PRODUCT_TYPES.PENSION;
}

function productSupports(row, flag) {
  return Boolean(getProductConfig(getProductType(row))?.[flag]);
}

function getBaseline(row) {
  const config = getProductConfig(getProductType(row));
  return {
    depositFee: config?.withoutAgreementBaseline?.depositFee ?? BASELINE.depositFee,
    accumulationFee: config?.withoutAgreementBaseline?.accumulationFee ?? BASELINE.accumulationFee,
  };
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

function toNumber(value) {
  if (!isPresent(value)) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  if (!cleaned) return null;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function issuerText(row) {
  return normalizeText(
    [
      row.issuerCanonical,
      row.issuerOriginal,
      row.issuer,
      row.manager,
      row.fundName,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(word));
}

function feeOk(actual, approved) {
  const actualNum = toNumber(actual);
  const approvedNum = toNumber(approved);

  if (actualNum === null) return true;
  if (approvedNum === null) return true;

  return actualNum <= approvedNum + 0.00001;
}

function feeMismatch(actual, approved) {
  const actualNum = toNumber(actual);
  const approvedNum = toNumber(approved);

  if (actualNum === null || approvedNum === null) return false;

  return actualNum > approvedNum + 0.00001;
}

function isOperationOnly(row) {
  const text = normalizeText(
    [
      row.serviceStatus,
      row.sourceAuditStatus,
      row.marketingStatus,
      row.auditStatusHe,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    Boolean(row.isOperationOnly) ||
    Boolean(row.isExcludedFromFeeAudit) ||
    text.includes("תפעול בלבד") ||
    text.includes("ללא שיווק")
  );
}

function isOptionEligible(option, accumulation) {
  if (!option) return false;

  if (option.conditionType === "MIN_ACCUMULATION") {
    return !option.conditionValue || (toNumber(accumulation) || 0) >= option.conditionValue;
  }

  return true;
}

function hasInlineAgreement(row) {
  return isPresent(row.depositFeeAgreement) || isPresent(row.accumulationFeeAgreement);
}

function getOptionsForIssuer(row, agreementOptionsByIssuer = {}) {
  const issuer = row.issuerCanonical || row.issuerOriginal || "לא מזוהה";

  return (
    agreementOptionsByIssuer[issuer] ||
    agreementOptionsByIssuer[row.issuerCanonical] ||
    agreementOptionsByIssuer[row.issuerOriginal] ||
    []
  );
}

function getDefaultPensionFundLimits(row) {
  const text = issuerText(row);

  if (includesAny(text, ["מור"])) {
    return MOR_DEFAULT_PENSION_FUND_LIMITS;
  }

  return DEFAULT_PENSION_FUND_LIMITS;
}

function isDefaultPensionFundCandidate(row) {
  const text = issuerText(row);

  // כלל רחב וזהיר:
  // אם מדובר בקרן פנסיה ויש דמי ניהול בגבולות ברירת מחדל,
  // אין לסמן חריגה גם אם קובץ ההסכמים מציג מודל אחר.
  return (
    getProductType(row) === PRODUCT_TYPES.PENSION ||
    text.includes("פנסיה") ||
    text.includes("מקפת") ||
    text.includes("מבטחים") ||
    text.includes("מור")
  );
}

function evaluateDefaultPensionFundRule(row) {
  if (!isDefaultPensionFundCandidate(row)) return null;

  const limits = getDefaultPensionFundLimits(row);

  const depositOk = feeOk(row.depositFee, limits.depositFee);
  const accumulationOk = feeOk(row.accumulationFee, limits.accumulationFee);

  if (!depositOk || !accumulationOk) return null;

  return {
    auditStatus: AUDIT_STATUS.VALID,
    auditStatusHe: AUDIT_STATUS_HE.valid,
    auditMatchResult: "MATCH_DEFAULT_PENSION_FUND",
    auditMatchModelName: includesAny(issuerText(row), ["מור"])
      ? "קרן ברירת מחדל — מור"
      : "קרן ברירת מחדל",
    auditMatchRuleType: "DEFAULT_PENSION_FUND",
    auditReason: includesAny(issuerText(row), ["מור"])
      ? "דמי הניהול עומדים בתקרת קרן ברירת מחדל של מור: עד 1% מהפקדה ועד 0.15% מצבירה"
      : "דמי הניהול עומדים בתקרת קרן ברירת מחדל: עד 1% מהפקדה ועד 0.22% מצבירה",
    auditReferenceDepositFee: limits.depositFee,
    auditReferenceAccumulationFee: limits.accumulationFee,
    agreementIssuerFound: true,
    issueCategory: ISSUE_CATEGORY.NONE,
    requiredAction: "",
    priority: PRIORITY.NONE,
  };
}

// ─── Inline agreement: cols 42-43 from pension report ─────────────────────────

function evaluateInlineAgreement(row) {
  if (!hasInlineAgreement(row)) return null;

  const approvedDepositFee = isPresent(row.depositFeeAgreement)
    ? row.depositFeeAgreement
    : null;

  const approvedAccumulationFee = isPresent(row.accumulationFeeAgreement)
    ? row.accumulationFeeAgreement
    : null;

  const depositOk = productSupports(row, "hasDepositFee")
    ? feeOk(row.depositFee, approvedDepositFee)
    : true;
  const accumulationOk = productSupports(row, "hasAccumulationFee")
    ? feeOk(row.accumulationFee, approvedAccumulationFee)
    : true;
  const pass = depositOk && accumulationOk;

  return {
    auditStatus: pass ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe: pass ? AUDIT_STATUS_HE.valid : AUDIT_STATUS_HE.invalid,
    auditMatchResult: pass ? "MATCH_INLINE_AGREEMENT" : "FAIL_INLINE_AGREEMENT",
    auditMatchModelName: "הסכם מנהל הסדר",
    auditMatchRuleType: "INLINE_AGREEMENT",
    auditReason: pass
      ? "דמי הניהול עומדים בהסכם מנהל ההסדר מתוך דוח היועץ"
      : `חריגה מול הסכם מנהל ההסדר: הפקדה ${row.depositFee ?? "—"}% מול מאושר ${approvedDepositFee ?? "—"}% | צבירה ${row.accumulationFee ?? "—"}% מול מאושר ${approvedAccumulationFee ?? "—"}%`,
    auditReferenceDepositFee: approvedDepositFee,
    auditReferenceAccumulationFee: approvedAccumulationFee,
    agreementIssuerFound: true,
    issueCategory: pass ? ISSUE_CATEGORY.NONE : ISSUE_CATEGORY.FEE_MISMATCH,
    requiredAction: pass ? "" : "בדיקת דמי ניהול מול מנהל ההסדר",
    priority: pass ? PRIORITY.NONE : PRIORITY.HIGH,
  };
}

// ─── External agreements file ─────────────────────────────────────────────────

function evaluateExternalAgreement(row, options = []) {
  if (!options.length) return null;

  const eligibleOptions = options.filter((option) =>
    isOptionEligible(option, row.accumulation)
  );

  const fullMatch = eligibleOptions.find((option) => {
    const depositOk = productSupports(row, "hasDepositFee")
      ? feeOk(row.depositFee, option.depositFee)
      : true;
    const accumulationOk = productSupports(row, "hasAccumulationFee")
      ? feeOk(row.accumulationFee, option.accumulationFee)
      : true;
    return depositOk && accumulationOk;
  });

  if (fullMatch) {
    return {
      auditStatus: AUDIT_STATUS.VALID,
      auditStatusHe: AUDIT_STATUS_HE.valid,
      auditMatchResult: `MATCH_${fullMatch.optionName || "EXTERNAL_AGREEMENT"}`,
      auditMatchModelName: fullMatch.optionName || "הסכם חיצוני",
      auditMatchRuleType: fullMatch.conditionType || "EXTERNAL_AGREEMENT",
      auditReason: `דמי הניהול עומדים ב${fullMatch.optionName || "הסכם החיצוני"}`,
      auditReferenceDepositFee: fullMatch.depositFee ?? null,
      auditReferenceAccumulationFee: fullMatch.accumulationFee ?? null,
      agreementIssuerFound: true,
      issueCategory: ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority: PRIORITY.NONE,
      hasTierModel: options.some((o) => o.conditionType === "MIN_ACCUMULATION"),
      eligibleForTier: eligibleOptions.some((o) => o.conditionType === "MIN_ACCUMULATION"),
      inTierModel: fullMatch.conditionType === "MIN_ACCUMULATION",
      tierPotentialNotUsed: false,
    };
  }

  const tierOptions = options.filter((option) => option.conditionType === "MIN_ACCUMULATION");
  const eligibleTier = tierOptions.find((option) =>
    isOptionEligible(option, row.accumulation)
  );

  const defaultOption =
    options.find((option) => option.isDefault) ||
    options.find((option) => option.conditionType === "DEFAULT") ||
    options[0];

  const bestReference = eligibleTier || defaultOption;

  const hasTierModel = tierOptions.length > 0;
  const eligibleForTier = Boolean(eligibleTier);

  const tierPotentialNotUsed = Boolean(
    eligibleTier &&
    (
      (productSupports(row, "hasDepositFee") && feeMismatch(row.depositFee, eligibleTier.depositFee)) ||
      (productSupports(row, "hasAccumulationFee") && feeMismatch(row.accumulationFee, eligibleTier.accumulationFee))
    )
  );

  return {
    auditStatus: AUDIT_STATUS.INVALID,
    auditStatusHe: AUDIT_STATUS_HE.invalid,
    auditMatchResult: tierPotentialNotUsed
      ? "FAIL_TIER_POTENTIAL"
      : "FAIL_EXTERNAL_AGREEMENT",
    auditMatchModelName: bestReference?.optionName || "הסכם חיצוני",
    auditMatchRuleType: bestReference?.conditionType || "EXTERNAL_AGREEMENT",
    auditReason: tierPotentialNotUsed
      ? `זכאי למודל צבירה גבוה אך אינו עומד בדמי הניהול של המודל: הפקדה ${row.depositFee ?? "—"}% מול ${eligibleTier.depositFee ?? "—"}% | צבירה ${row.accumulationFee ?? "—"}% מול ${eligibleTier.accumulationFee ?? "—"}%`
      : `דמי הניהול אינם עומדים בהסכם: הפקדה ${row.depositFee ?? "—"}% מול ${bestReference?.depositFee ?? "—"}% | צבירה ${row.accumulationFee ?? "—"}% מול ${bestReference?.accumulationFee ?? "—"}%`,
    auditReferenceDepositFee: bestReference?.depositFee ?? null,
    auditReferenceAccumulationFee: bestReference?.accumulationFee ?? null,
    agreementIssuerFound: true,
    issueCategory: tierPotentialNotUsed
      ? ISSUE_CATEGORY.TIER_POTENTIAL_NOT_USED
      : ISSUE_CATEGORY.FEE_MISMATCH,
    requiredAction: tierPotentialNotUsed
      ? "בדיקת מעבר למודל צבירות גבוהות"
      : "בדיקת חריגת דמי ניהול מול ההסכם",
    priority: tierPotentialNotUsed ? PRIORITY.MEDIUM : PRIORITY.HIGH,
    hasTierModel,
    eligibleForTier,
    inTierModel: false,
    tierPotentialNotUsed,
  };
}

// ─── Baseline fallback ────────────────────────────────────────────────────────

function evaluateBaseline(row) {
  const baseline = getBaseline(row);
  const depositOk = productSupports(row, "hasDepositFee")
    ? feeOk(row.depositFee, baseline.depositFee)
    : true;
  const accumulationOk = productSupports(row, "hasAccumulationFee")
    ? feeOk(row.accumulationFee, baseline.accumulationFee)
    : true;
  const pass = depositOk && accumulationOk;

  return {
    auditStatus: pass ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe: pass ? AUDIT_STATUS_HE.valid : AUDIT_STATUS_HE.invalid,
    auditMatchResult: pass ? "MATCH_BASELINE" : "FAIL_BASELINE",
    auditMatchModelName: "כלל בסיס",
    auditMatchRuleType: "BASELINE",
    auditReason: pass
      ? "דמי הניהול עומדים בכלל הבסיס"
      : `חריגה מכלל בסיס: הפקדה ${row.depositFee ?? "—"}% מול ${baseline.depositFee ?? "—"}% | צבירה ${row.accumulationFee ?? "—"}% מול ${baseline.accumulationFee ?? "—"}%`,
    auditReferenceDepositFee: productSupports(row, "hasDepositFee") ? baseline.depositFee : null,
    auditReferenceAccumulationFee: productSupports(row, "hasAccumulationFee") ? baseline.accumulationFee : null,
    agreementIssuerFound: false,
    issueCategory: pass ? ISSUE_CATEGORY.NONE : ISSUE_CATEGORY.MISSING_AGREEMENT,
    requiredAction: pass
      ? ""
      : "לא נמצא הסכם מתאים — יש לבדוק מול קובץ הסכמים / מנהל הסדר",
    priority: pass ? PRIORITY.NONE : PRIORITY.MEDIUM,
  };
}

// ─── Main row evaluation ──────────────────────────────────────────────────────

export function evaluateUnifiedRow(row, agreementOptionsByIssuer = {}) {
  row = safeRow(row);
  agreementOptionsByIssuer = agreementOptionsByIssuer && typeof agreementOptionsByIssuer === "object" ? agreementOptionsByIssuer : {};
  if (isOperationOnly(row)) {
    return {
      ...row,
      auditStatus: AUDIT_STATUS.EXCLUDED,
      auditStatusHe: AUDIT_STATUS_HE.excluded,
      auditMatchResult: "EXCLUDED_OPERATION_ONLY",
      auditMatchModelName: "תפעול בלבד",
      auditMatchRuleType: "EXCLUDED",
      auditReason: "תפעול בלבד / ללא שיווק — הוחרג מבדיקת דמי ניהול",
      auditReferenceDepositFee: null,
      auditReferenceAccumulationFee: null,
      agreementIssuerFound: false,
      issueCategory: ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority: PRIORITY.NONE,
      hasTierModel: false,
      eligibleForTier: false,
      inTierModel: false,
      tierPotentialNotUsed: false,
    };
  }

  const options = getOptionsForIssuer(row, agreementOptionsByIssuer);

  const externalTierMetadata = {
    hasTierModel: options.some((o) => o.conditionType === "MIN_ACCUMULATION"),
    eligibleForTier: options.some(
      (o) => o.conditionType === "MIN_ACCUMULATION" && isOptionEligible(o, row.accumulation)
    ),
  };

  // חשוב:
  // כלל ברירת המחדל צריך למנוע false positive גם אם ההסכם הפנימי/חיצוני מחמיר יותר.
  // לכן בודקים אותו לפני סימון invalid סופי.
  const inlineResult = evaluateInlineAgreement(row);
  const defaultFundResult = evaluateDefaultPensionFundRule(row);

  if (inlineResult?.auditStatus === AUDIT_STATUS.VALID) {
    return {
      ...row,
      ...inlineResult,
      ...externalTierMetadata,
      inTierModel: false,
      tierPotentialNotUsed: false,
    };
  }

  if (defaultFundResult) {
    return {
      ...row,
      ...defaultFundResult,
      ...externalTierMetadata,
      inTierModel: false,
      tierPotentialNotUsed: false,
    };
  }

  if (inlineResult) {
    return {
      ...row,
      ...inlineResult,
      ...externalTierMetadata,
      inTierModel: false,
      tierPotentialNotUsed: false,
    };
  }

  const externalResult = evaluateExternalAgreement(row, options);

  if (externalResult) {
    return {
      ...row,
      ...externalResult,
    };
  }

  const baselineResult = evaluateBaseline(row);

  return {
    ...row,
    ...baselineResult,
    ...externalTierMetadata,
    inTierModel: false,
    tierPotentialNotUsed: false,
  };
}

export function evaluateUnifiedRows({
  unifiedRows = [],
  agreementOptionsByIssuer = {},
} = {}) {
  unifiedRows = safeRows(unifiedRows);
  return unifiedRows.map((row) =>
    evaluateUnifiedRow(row, agreementOptionsByIssuer)
  );
}

export default evaluateUnifiedRows;
