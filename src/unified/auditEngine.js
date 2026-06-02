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
//   2. קרן פנסיה ותיקה → excluded / לא נבדקת
//   3. הסכם פנימי מתוך דוח היועץ → INLINE_AGREEMENT
//      התאמה מלאה = תקין; אם אין התאמה מלאה מחשבים ציון אפקטיבי:
//      צבירה + (הפקדה / 2), ומשווים קובץ מול הסכם.
//   4. קרנות ברירת מחדל → DEFAULT_PENSION_FUND
//      מור / אלטשולר שחם / אינפיניטי / איילון בלבד.
//      שילובים תקינים: 0.22%+1%, 0.01%+1.45%, ובמור גם 0.15%+1%.
//   5. קובץ הסכמים חיצוני → EXTERNAL_AGREEMENT
//   6. ללא מידע / ללא הסכם בקרן פנסיה → תפעול בלבד
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

const DEFAULT_PENSION_FUND_ALLOWED_COMBINATIONS = [
  { depositFee: 1.0, accumulationFee: 0.22, label: "קרן ברירת מחדל 0.22% מצבירה ו-1% מהפקדה" },
  { depositFee: 1.45, accumulationFee: 0.01, label: "קרן ברירת מחדל 0.01% מצבירה ו-1.45% מהפקדה" },
];

const MOR_DEFAULT_PENSION_FUND_ALLOWED_COMBINATIONS = [
  ...DEFAULT_PENSION_FUND_ALLOWED_COMBINATIONS,
  { depositFee: 1.0, accumulationFee: 0.15, label: "חריג מור 0.15% מצבירה ו-1% מהפקדה" },
];

const DEFAULT_PENSION_FUND_ISSUER_NAMES = [
  "מור",
  "אלטשולר",
  "שחם",
  "אינפיניטי",
  "איילון",
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

function sameFee(actual, approved) {
  const actualNum = toNumber(actual);
  const approvedNum = toNumber(approved);

  if (actualNum === null || approvedNum === null) return false;

  return Math.abs(actualNum - approvedNum) <= 0.00001;
}

function effectiveFeeScore({ depositFee, accumulationFee }) {
  const depositNum = toNumber(depositFee);
  const accumulationNum = toNumber(accumulationFee);

  if (depositNum === null || accumulationNum === null) return null;

  return Number((accumulationNum + depositNum / 2).toFixed(6));
}

function evaluateFeeComparison(row, approvedDepositFee, approvedAccumulationFee) {
  const actualDepositFee = productSupports(row, "hasDepositFee") ? toNumber(row.depositFee) : 0;
  const actualAccumulationFee = productSupports(row, "hasAccumulationFee") ? toNumber(row.accumulationFee) : 0;
  const agreementDepositFee = productSupports(row, "hasDepositFee") ? toNumber(approvedDepositFee) : 0;
  const agreementAccumulationFee = productSupports(row, "hasAccumulationFee") ? toNumber(approvedAccumulationFee) : 0;

  if (actualDepositFee === null || actualAccumulationFee === null) {
    return {
      canCheck: false,
      reason: "אין מידע דמי ניהול בקובץ — סומן כתפעול בלבד",
    };
  }

  if (agreementDepositFee === null || agreementAccumulationFee === null) {
    return {
      canCheck: false,
      reason: "אין מידע דמי ניהול בהסכם — סומן כתפעול בלבד",
    };
  }

  const exactMatch =
    sameFee(actualDepositFee, agreementDepositFee) &&
    sameFee(actualAccumulationFee, agreementAccumulationFee);

  const actualEffectiveScore = effectiveFeeScore({
    depositFee: actualDepositFee,
    accumulationFee: actualAccumulationFee,
  });
  const agreementEffectiveScore = effectiveFeeScore({
    depositFee: agreementDepositFee,
    accumulationFee: agreementAccumulationFee,
  });

  const economicPass =
    actualEffectiveScore !== null &&
    agreementEffectiveScore !== null &&
    actualEffectiveScore <= agreementEffectiveScore + 0.00001;

  return {
    canCheck: true,
    pass: exactMatch || economicPass,
    exactMatch,
    economicPass,
    actualDepositFee,
    actualAccumulationFee,
    agreementDepositFee,
    agreementAccumulationFee,
    actualEffectiveScore,
    agreementEffectiveScore,
  };
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

function pensionProductText(row) {
  return normalizeText(
    [
      row.fundName,
      row.issuerOriginal,
      row.issuerCanonical,
      row.policyNumber,
      row.sourceSheetName,
      row.raw?.["שם קרן הפנסיה"],
      row.raw?.["שם קופה"],
      row.raw?.["שם מוצר"],
      row.raw?.["שם תוכנית"],
      row.raw?.["סוג מוצר"],
      row.raw?.["סוג קרן"],
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isPensionProduct(row) {
  return getProductType(row) === PRODUCT_TYPES.PENSION;
}

function isOldPensionFund(row) {
  return isPensionProduct(row) && /פנסיה ותיקה|קרן ותיקה|ותיקה|ותיקות/.test(pensionProductText(row));
}

function buildExcludedResult(reason, matchResult = "EXCLUDED_OPERATION_ONLY") {
  return {
    auditStatus: AUDIT_STATUS.EXCLUDED,
    auditStatusHe: AUDIT_STATUS_HE.excluded,
    auditMatchResult: matchResult,
    auditMatchModelName: "תפעול בלבד",
    auditMatchRuleType: "EXCLUDED",
    auditReason: reason,
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

function getDefaultPensionFundCombinations(row) {
  return includesAny(issuerText(row), ["מור"])
    ? MOR_DEFAULT_PENSION_FUND_ALLOWED_COMBINATIONS
    : DEFAULT_PENSION_FUND_ALLOWED_COMBINATIONS;
}

function isDefaultPensionFundCandidate(row) {
  if (!isPensionProduct(row) || isOldPensionFund(row)) return false;

  const text = issuerText(row);
  return includesAny(text, DEFAULT_PENSION_FUND_ISSUER_NAMES);
}

function evaluateDefaultPensionFundRule(row) {
  if (!isDefaultPensionFundCandidate(row)) return null;

  const combinations = getDefaultPensionFundCombinations(row);
  const matchedCombination = combinations.find((option) =>
    sameFee(row.depositFee, option.depositFee) &&
    sameFee(row.accumulationFee, option.accumulationFee)
  );

  if (!matchedCombination) return null;

  return {
    auditStatus: AUDIT_STATUS.VALID,
    auditStatusHe: AUDIT_STATUS_HE.valid,
    auditMatchResult: "MATCH_DEFAULT_PENSION_FUND",
    auditMatchModelName: matchedCombination.label,
    auditMatchRuleType: "DEFAULT_PENSION_FUND",
    auditReason: `קרן פנסיה ברירת מחדל — דמי הניהול תואמים לשילוב המאושר: ${matchedCombination.label}`,
    auditReferenceDepositFee: matchedCombination.depositFee,
    auditReferenceAccumulationFee: matchedCombination.accumulationFee,
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

  const comparison = evaluateFeeComparison(row, approvedDepositFee, approvedAccumulationFee);

  if (!comparison.canCheck) {
    return buildExcludedResult(comparison.reason, "EXCLUDED_MISSING_FEE_DATA");
  }

  const pass = comparison.pass;
  const reason = comparison.exactMatch
    ? "דמי הניהול באקסל זהים לדמי הניהול בהסכם מנהל ההסדר"
    : pass
      ? `דמי הניהול אינם זהים, אך הציון האפקטיבי בקובץ נמוך/שווה להסכם: קובץ ${comparison.actualEffectiveScore} מול הסכם ${comparison.agreementEffectiveScore}`
      : `דמי הניהול גבוהים מההסכם לפי ציון אפקטיבי: קובץ ${comparison.actualEffectiveScore} מול הסכם ${comparison.agreementEffectiveScore}`;

  return {
    auditStatus: pass ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe: pass ? AUDIT_STATUS_HE.valid : AUDIT_STATUS_HE.invalid,
    auditMatchResult: pass ? "MATCH_INLINE_AGREEMENT" : "FAIL_INLINE_AGREEMENT",
    auditMatchModelName: "הסכם מנהל הסדר",
    auditMatchRuleType: "INLINE_AGREEMENT",
    auditReason: reason,
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

  const evaluatedOptions = eligibleOptions
    .map((option) => ({
      option,
      comparison: evaluateFeeComparison(row, option.depositFee, option.accumulationFee),
    }))
    .filter((item) => item.comparison.canCheck);

  const fullMatch = evaluatedOptions.find((item) => item.comparison.pass);

  if (fullMatch) {
    const { option, comparison } = fullMatch;
    return {
      auditStatus: AUDIT_STATUS.VALID,
      auditStatusHe: AUDIT_STATUS_HE.valid,
      auditMatchResult: `MATCH_${option.optionName || "EXTERNAL_AGREEMENT"}`,
      auditMatchModelName: option.optionName || "הסכם חיצוני",
      auditMatchRuleType: option.conditionType || "EXTERNAL_AGREEMENT",
      auditReason: comparison.exactMatch
        ? `דמי הניהול באקסל זהים ל${option.optionName || "הסכם החיצוני"}`
        : `דמי הניהול נמוכים/שווים להסכם לפי ציון אפקטיבי: קובץ ${comparison.actualEffectiveScore} מול הסכם ${comparison.agreementEffectiveScore}`,
      auditReferenceDepositFee: option.depositFee ?? null,
      auditReferenceAccumulationFee: option.accumulationFee ?? null,
      agreementIssuerFound: true,
      issueCategory: ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority: PRIORITY.NONE,
      hasTierModel: options.some((o) => o.conditionType === "MIN_ACCUMULATION"),
      eligibleForTier: eligibleOptions.some((o) => o.conditionType === "MIN_ACCUMULATION"),
      inTierModel: option.conditionType === "MIN_ACCUMULATION",
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
  const bestComparison = evaluateFeeComparison(
    row,
    bestReference?.depositFee,
    bestReference?.accumulationFee
  );

  if (!bestComparison.canCheck) {
    return buildExcludedResult(bestComparison.reason, "EXCLUDED_MISSING_FEE_DATA");
  }

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
      ? `זכאי למודל צבירה גבוה אך אינו עומד בדמי הניהול של המודל לפי ציון אפקטיבי: קובץ ${bestComparison.actualEffectiveScore} מול הסכם ${bestComparison.agreementEffectiveScore}`
      : `דמי הניהול גבוהים מההסכם לפי ציון אפקטיבי: קובץ ${bestComparison.actualEffectiveScore} מול הסכם ${bestComparison.agreementEffectiveScore}`,
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
  if (isPensionProduct(row)) {
    return buildExcludedResult("לא נמצא הסכם / אין מידע הסכם לבדיקת קרן פנסיה — סומן כתפעול בלבד", "EXCLUDED_NO_AGREEMENT");
  }

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
      ...buildExcludedResult("תפעול בלבד / ללא שיווק — הוחרג מבדיקת דמי ניהול"),
    };
  }

  if (isOldPensionFund(row)) {
    return {
      ...row,
      ...buildExcludedResult("קרן פנסיה ותיקה — לא נכללת בבדיקת דמי ניהול", "EXCLUDED_OLD_PENSION_FUND"),
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
