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
//   1. תפעול בלבד לפי העמודה "האם מנהל ההסדר סוכן בפוליסה" = לא → excluded
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
  valid: "תקין",
  invalid: "לא תקין",
  excluded: "תפעול בלבד",
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

const DEFAULT_PENSION_FUND_MODELS = [
  { name: "ברירת מחדל 0.22% + 1%", depositFee: 1.0, accumulationFee: 0.22 },
  { name: "ברירת מחדל 0.01% + 1.45%", depositFee: 1.45, accumulationFee: 0.01 },
];

const MOR_DEFAULT_PENSION_FUND_MODELS = [
  ...DEFAULT_PENSION_FUND_MODELS,
  { name: "חריג מור 0.15% + 1%", depositFee: 1.0, accumulationFee: 0.15 },
];

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

function nearlyEqual(a, b, epsilon = 0.00001) {
  const left = toNumber(a);
  const right = toNumber(b);
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= epsilon;
}

function feeScore({ depositFee, accumulationFee } = {}) {
  const deposit = toNumber(depositFee);
  const accumulation = toNumber(accumulationFee);

  if (deposit === null && accumulation === null) return null;

  return (accumulation || 0) + ((deposit || 0) / 2);
}

function compareFeesByScore(row, reference) {
  const actualScore = feeScore({
    depositFee: row.depositFee,
    accumulationFee: row.accumulationFee,
  });

  const referenceScore = feeScore({
    depositFee: reference?.depositFee,
    accumulationFee: reference?.accumulationFee,
  });

  if (actualScore === null || referenceScore === null) return null;

  return {
    actualScore,
    referenceScore,
    pass: actualScore <= referenceScore + 0.00001,
  };
}

function hasFeesInfo(row) {
  return isPresent(row.depositFee) || isPresent(row.accumulationFee);
}

function isArrangementAgentNo(value) {
  const text = normalizeText(value).toLowerCase();
  return text === "לא" || text === "no" || text === "false" || text === "0";
}

function isOperationOnly(row) {
  // V82: קדימות מוחלטת לעמודת "האם מנהל ההסדר סוכן בפוליסה".
  // אם הערך הוא "לא" — השורה היא תפעול בלבד ולא עוברת לבדיקת דמי ניהול.
  // לא משתמשים בעמודות סטטוס כלליות ולא מסיקים תפעול מדמי ניהול.
  return (
    Boolean(row.isOperationOnly) ||
    isArrangementAgentNo(row.arrangementAgentStatus) ||
    isArrangementAgentNo(row.isArrangementAgentRaw) ||
    isArrangementAgentNo(row.isArrangementAgent)
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

function isDefaultPensionIssuer(row) {
  const text = issuerText(row);

  return includesAny(text, [
    "מור",
    "אלטשולר",
    "אלטש",
    "אינפיניטי",
    "איילון",
  ]);
}

function isPensionFeeAuditEligible(row) {
  if (getProductType(row) !== PRODUCT_TYPES.PENSION) return true;

  const text = normalizeText([row.planType, row.fundName, row.issuerOriginal, row.issuerCanonical].filter(Boolean).join(" "));

  // כלל עסקי: בודקים מקיפה וכללית, לא בודקים קרן פנסיה ותיקה.
  if (text.includes("ותיק") || text.includes("ותיקה")) return false;

  return true;
}

function getDefaultPensionFundModels(row) {
  return includesAny(issuerText(row), ["מור"])
    ? MOR_DEFAULT_PENSION_FUND_MODELS
    : DEFAULT_PENSION_FUND_MODELS;
}

function evaluateDefaultPensionFundRule(row) {
  if (getProductType(row) !== PRODUCT_TYPES.PENSION || !isDefaultPensionIssuer(row)) return null;

  const models = getDefaultPensionFundModels(row);
  const matchedModel = models.find((model) =>
    nearlyEqual(row.depositFee, model.depositFee) && nearlyEqual(row.accumulationFee, model.accumulationFee)
  );

  if (!matchedModel) return null;

  return {
    auditStatus: AUDIT_STATUS.VALID,
    auditStatusHe: AUDIT_STATUS_HE.valid,
    auditMatchResult: "MATCH_DEFAULT_PENSION_FUND",
    auditMatchModelName: matchedModel.name,
    auditMatchRuleType: "DEFAULT_PENSION_FUND",
    auditReason: `קרן פנסיה ברירת מחדל — דמי הניהול תואמים למודל ${matchedModel.name}`,
    auditReferenceDepositFee: matchedModel.depositFee,
    auditReferenceAccumulationFee: matchedModel.accumulationFee,
    agreementIssuerFound: true,
    issueCategory: ISSUE_CATEGORY.NONE,
    requiredAction: "",
    priority: PRIORITY.NONE,
  };
}

function evaluateNoInformation(row) {
  return {
    auditStatus: AUDIT_STATUS.EXCLUDED,
    auditStatusHe: AUDIT_STATUS_HE.excluded,
    auditMatchResult: "EXCLUDED_OPERATION_ONLY",
    auditMatchModelName: "תפעול בלבד",
    auditMatchRuleType: "EXCLUDED",
    auditReason: hasFeesInfo(row)
      ? "לא נמצא מידע הסכם מתאים לבדיקת דמי ניהול — מסומן כמתפעל בלבד"
      : "אין מידע דמי ניהול/הסכם לבדיקה — מסומן כמתפעל בלבד",
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

// ─── Inline agreement: cols 42-43 from pension report ─────────────────────────

function evaluateInlineAgreement(row) {
  if (!hasInlineAgreement(row)) return null;

  const approvedDepositFee = isPresent(row.depositFeeAgreement)
    ? row.depositFeeAgreement
    : null;

  const approvedAccumulationFee = isPresent(row.accumulationFeeAgreement)
    ? row.accumulationFeeAgreement
    : null;

  const exactMatch =
    (!productSupports(row, "hasDepositFee") || nearlyEqual(row.depositFee, approvedDepositFee)) &&
    (!productSupports(row, "hasAccumulationFee") || nearlyEqual(row.accumulationFee, approvedAccumulationFee));

  const scoreComparison = compareFeesByScore(row, {
    depositFee: approvedDepositFee,
    accumulationFee: approvedAccumulationFee,
  });

  const pass = exactMatch || Boolean(scoreComparison?.pass);

  return {
    auditStatus: pass ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe: pass ? AUDIT_STATUS_HE.valid : AUDIT_STATUS_HE.invalid,
    auditMatchResult: pass ? "MATCH_INLINE_AGREEMENT" : "FAIL_INLINE_AGREEMENT",
    auditMatchModelName: "הסכם מנהל הסדר",
    auditMatchRuleType: "INLINE_AGREEMENT",
    auditReason: exactMatch
      ? "דמי הניהול זהים להסכם מנהל ההסדר מתוך דוח היועץ"
      : pass
        ? `דמי הניהול אינם זהים להסכם, אך הציון המשוקלל נמוך/שווה להסכם: בפועל ${scoreComparison?.actualScore?.toFixed?.(4)} מול הסכם ${scoreComparison?.referenceScore?.toFixed?.(4)}`
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
    const depositSame = !productSupports(row, "hasDepositFee") || nearlyEqual(row.depositFee, option.depositFee);
    const accumulationSame = !productSupports(row, "hasAccumulationFee") || nearlyEqual(row.accumulationFee, option.accumulationFee);
    return depositSame && accumulationSame;
  });

  if (fullMatch) {
    return {
      auditStatus: AUDIT_STATUS.VALID,
      auditStatusHe: AUDIT_STATUS_HE.valid,
      auditMatchResult: `MATCH_${fullMatch.optionName || "EXTERNAL_AGREEMENT"}`,
      auditMatchModelName: fullMatch.optionName || "הסכם חיצוני",
      auditMatchRuleType: fullMatch.conditionType || "EXTERNAL_AGREEMENT",
      auditReason: `דמי הניהול זהים ל${fullMatch.optionName || "הסכם החיצוני"}`,
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

  const scoreComparison = compareFeesByScore(row, bestReference);
  const passByScore = Boolean(scoreComparison?.pass);

  return {
    auditStatus: passByScore ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe: passByScore ? AUDIT_STATUS_HE.valid : AUDIT_STATUS_HE.invalid,
    auditMatchResult: passByScore
      ? `MATCH_${bestReference?.optionName || "EXTERNAL_AGREEMENT"}_BY_SCORE`
      : tierPotentialNotUsed
        ? "FAIL_TIER_POTENTIAL"
        : "FAIL_EXTERNAL_AGREEMENT",
    auditMatchModelName: bestReference?.optionName || "הסכם חיצוני",
    auditMatchRuleType: bestReference?.conditionType || "EXTERNAL_AGREEMENT",
    auditReason: passByScore
      ? `דמי הניהול אינם זהים להסכם, אך הציון המשוקלל נמוך/שווה להסכם: בפועל ${scoreComparison?.actualScore?.toFixed?.(4)} מול הסכם ${scoreComparison?.referenceScore?.toFixed?.(4)}`
      : tierPotentialNotUsed
        ? `זכאי למודל צבירה גבוה אך אינו עומד בדמי הניהול של המודל: הפקדה ${row.depositFee ?? "—"}% מול ${eligibleTier.depositFee ?? "—"}% | צבירה ${row.accumulationFee ?? "—"}% מול ${eligibleTier.accumulationFee ?? "—"}%`
        : `דמי הניהול אינם עומדים בהסכם: הפקדה ${row.depositFee ?? "—"}% מול ${bestReference?.depositFee ?? "—"}% | צבירה ${row.accumulationFee ?? "—"}% מול ${bestReference?.accumulationFee ?? "—"}%`,
    auditReferenceDepositFee: bestReference?.depositFee ?? null,
    auditReferenceAccumulationFee: bestReference?.accumulationFee ?? null,
    agreementIssuerFound: true,
    issueCategory: passByScore
      ? ISSUE_CATEGORY.NONE
      : tierPotentialNotUsed
        ? ISSUE_CATEGORY.TIER_POTENTIAL_NOT_USED
        : ISSUE_CATEGORY.FEE_MISMATCH,
    requiredAction: passByScore
      ? ""
      : tierPotentialNotUsed
        ? "בדיקת מעבר למודל צבירות גבוהות"
        : "בדיקת חריגת דמי ניהול מול ההסכם",
    priority: passByScore ? PRIORITY.NONE : tierPotentialNotUsed ? PRIORITY.MEDIUM : PRIORITY.HIGH,
    hasTierModel,
    eligibleForTier,
    inTierModel: false,
    tierPotentialNotUsed: passByScore ? false : tierPotentialNotUsed,
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
  // V82: קודם מתפעל בלבד, ורק אחר כך בדיקת סוג קרן פנסיה.
  // כל "לא" בעמודת האם מנהל ההסדר סוכן בפוליסה עוצר את ה-flow ומסומן כתפעול בלבד.
  if (isOperationOnly(row)) {
    return {
      ...row,
      auditStatus: AUDIT_STATUS.EXCLUDED,
      auditStatusHe: AUDIT_STATUS_HE.excluded,
      auditMatchResult: "EXCLUDED_OPERATION_ONLY",
      auditMatchModelName: "תפעול בלבד",
      auditMatchRuleType: "EXCLUDED",
      auditReason: "תפעול בלבד — בעמודת האם מנהל ההסדר סוכן בפוליסה מופיע לא",
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

  if (!isPensionFeeAuditEligible(row)) {
    return {
      ...row,
      auditStatus: AUDIT_STATUS.EXCLUDED,
      auditStatusHe: AUDIT_STATUS_HE.excluded,
      auditMatchResult: "EXCLUDED_VETERAN_PENSION",
      auditMatchModelName: "קרן פנסיה ותיקה",
      auditMatchRuleType: "EXCLUDED",
      auditReason: "קרן פנסיה ותיקה — לא נכללת בבדיקת דמי ניהול",
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

  const noInformationResult = evaluateNoInformation(row);

  return {
    ...row,
    ...noInformationResult,
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
