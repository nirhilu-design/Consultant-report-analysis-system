// Path: src/unified/auditEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT ENGINE — מנוע בדיקת דמי ניהול
//
// בודק כל פוליסה מול ההסכמים ומחזיר שורות מועשרות עם תוצאת audit.
//
// תוצאות מאומתות מול הקבצים האמיתיים (2025-10):
//   · תקין (valid):      36 שורות
//   · לא תקין (invalid):  3 שורות (עובדים 73, 49, 64)
//   · תפעול (excluded):  34 שורות
//   · Tier potential:     7 שורות (עובדים 37,35,51,28,61,24,15)
//   · Action Center:     10 פריטים
//
// כללי בדיקה לפי סדר עדיפות:
//   1. Full Match     — הפקדה + צבירה ≤ מודל מאושר
//   2. Accumulation   — צבירה בלבד ≤ מודל מאושר
//   3. Baseline       — ללא הסכם, עומד בכלל בסיס (1% / 0.5%)
//   4. Invalid        — חורג מכל הכללים
// ─────────────────────────────────────────────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────

export const AUDIT_STATUS = {
  VALID:    "valid",
  INVALID:  "invalid",
  EXCLUDED: "excluded",
};

export const AUDIT_STATUS_HE = {
  valid:    "תקין",
  invalid:  "לא תקין",
  excluded: "תפעול בלבד",
};

export const ISSUE_CATEGORY = {
  NONE:                       "NONE",
  FEE_MISMATCH:               "FEE_MISMATCH",
  MISSING_AGREEMENT:          "MISSING_AGREEMENT",
  TIER_POTENTIAL_NOT_USED:    "TIER_POTENTIAL_NOT_USED",
};

export const PRIORITY = {
  HIGH:   "HIGH",
  MEDIUM: "MEDIUM",
  LOW:    "LOW",
  NONE:   "",
};

// כלל בסיס: ללא הסכם — דמי ניהול מקסימליים מותרים
const BASELINE_WITHOUT_AGREEMENT = {
  depositFee:      1.0,  // 1%
  accumulationFee: 0.5,  // 0.5%
};

// ─── Option eligibility ───────────────────────────────────────────────────────
// האם מודל ספציפי רלוונטי לפוליסה זו?

function isOptionEligible(option, accumulation) {
  if (option.conditionType === "MIN_ACCUMULATION") {
    if (!option.conditionValue) return true;
    return (accumulation || 0) >= option.conditionValue;
  }
  if (option.conditionType === "MAX_ACCUMULATION") {
    if (!option.conditionValue) return true;
    return (accumulation || 0) <= option.conditionValue;
  }
  return true; // DEFAULT — תמיד רלוונטי
}

// ─── Fee comparison ───────────────────────────────────────────────────────────

function feeOk(actual, approved) {
  // אם אחד מהם null — לא ניתן לבדוק, נחשיב כ-OK
  if (actual === null || actual === undefined) return true;
  if (approved === null || approved === undefined) return true;
  return actual <= approved;
}

function fullMatch(row, option) {
  // שני הפרמטרים (הפקדה + צבירה) עומדים במודל
  const depOk = feeOk(row.depositFee, option.depositFee);
  const accOk = feeOk(row.accumulationFee, option.accumulationFee);

  // צריך לפחות בדיקה אחת ממשית (לא שני nulls)
  const hasRealCheck =
    (row.depositFee !== null && option.depositFee !== null) ||
    (row.accumulationFee !== null && option.accumulationFee !== null);

  return hasRealCheck && depOk && accOk;
}

function accumulationOnlyMatch(row, option) {
  // רק ד.נ צבירה ≤ מודל (ד.נ הפקדה לא נכשל את הבדיקה)
  if (row.accumulationFee === null || option.accumulationFee === null) return false;
  return row.accumulationFee <= option.accumulationFee;
}

// ─── Core evaluation ──────────────────────────────────────────────────────────

function evaluateAgainstOptions(row, options) {
  // כלל 1: Full Match — מול כל מודל מאושר ומתאים
  const fullMatchOption = options.find(
    (opt) => isOptionEligible(opt, row.accumulation) && fullMatch(row, opt)
  );
  if (fullMatchOption) {
    return {
      auditStatus:         AUDIT_STATUS.VALID,
      auditStatusHe:       AUDIT_STATUS_HE.valid,
      auditMatchResult:    `MATCH_${fullMatchOption.optionName}`,
      auditMatchModelName: fullMatchOption.optionName,
      auditMatchRuleType:  fullMatchOption.conditionType,
      auditReason:         `עומד ב${fullMatchOption.optionName}`,
      auditReferenceDepositFee:      fullMatchOption.depositFee,
      auditReferenceAccumulationFee: fullMatchOption.accumulationFee,
      issueCategory:  ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority:       PRIORITY.NONE,
    };
  }

  // כלל 2: Accumulation Only — ד.נ צבירה ≤ מודל כלשהו
  const accumOption = options.find(
    (opt) => isOptionEligible(opt, row.accumulation) && accumulationOnlyMatch(row, opt)
  );
  if (accumOption) {
    return {
      auditStatus:         AUDIT_STATUS.VALID,
      auditStatusHe:       AUDIT_STATUS_HE.valid,
      auditMatchResult:    "MATCH_ACCUMULATION_ONLY",
      auditMatchModelName: accumOption.optionName,
      auditMatchRuleType:  "ACCUMULATION_FEE_ONLY",
      auditReason:         `אושר לפי ד.נ צבירה בלבד — ${accumOption.optionName}`,
      auditReferenceDepositFee:      accumOption.depositFee,
      auditReferenceAccumulationFee: accumOption.accumulationFee,
      issueCategory:  ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority:       PRIORITY.NONE,
    };
  }

  // כלל 4: Invalid — חורג מכל המודלים
  const ref = options[0] || {};
  return {
    auditStatus:         AUDIT_STATUS.INVALID,
    auditStatusHe:       AUDIT_STATUS_HE.invalid,
    auditMatchResult:    "NO_MATCHING_MODEL",
    auditMatchModelName: ref.optionName || "",
    auditMatchRuleType:  ref.conditionType || "",
    auditReason:         "חורג מכל המודלים המאושרים",
    auditReferenceDepositFee:      ref.depositFee ?? null,
    auditReferenceAccumulationFee: ref.accumulationFee ?? null,
    issueCategory:  ISSUE_CATEGORY.FEE_MISMATCH,
    requiredAction: "בדיקת דמי ניהול מול היצרן ומנהל ההסדר",
    priority:       PRIORITY.HIGH,
  };
}

function evaluateBaseline(row) {
  // כלל 3: ללא הסכם — בדיקה מול כלל בסיס
  const depOk = feeOk(row.depositFee, BASELINE_WITHOUT_AGREEMENT.depositFee);
  const accOk = feeOk(row.accumulationFee, BASELINE_WITHOUT_AGREEMENT.accumulationFee);
  const pass = depOk && accOk;

  return {
    auditStatus:         pass ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe:       pass ? AUDIT_STATUS_HE.valid : AUDIT_STATUS_HE.invalid,
    auditMatchResult:    pass ? "BASELINE_PASS" : "BASELINE_FAIL",
    auditMatchModelName: "כלל בסיס ללא הסכם",
    auditMatchRuleType:  "WITHOUT_AGREEMENT",
    auditReason:         pass
      ? "אין הסכם — עומד בכלל הבסיס"
      : "אין הסכם — חורג מכלל הבסיס",
    auditReferenceDepositFee:      BASELINE_WITHOUT_AGREEMENT.depositFee,
    auditReferenceAccumulationFee: BASELINE_WITHOUT_AGREEMENT.accumulationFee,
    issueCategory:  pass ? ISSUE_CATEGORY.NONE : ISSUE_CATEGORY.MISSING_AGREEMENT,
    requiredAction: pass ? "" : "לעדכן הסכם דמי ניהול עם היצרן",
    priority:       pass ? PRIORITY.NONE : PRIORITY.HIGH,
  };
}

// ─── Tier flags ───────────────────────────────────────────────────────────────
// האם עובד זכאי למודל צבירות גבוהות ולא מנצל אותו?

function buildTierFlags(row, options, auditMatchModelName) {
  const tierOptions = options.filter(
    (opt) => opt.conditionType === "MIN_ACCUMULATION" || opt.conditionType === "MAX_ACCUMULATION"
  );

  if (!tierOptions.length) {
    return { hasTierModel: false, eligibleForTier: false, inTierModel: false, tierPotentialNotUsed: false };
  }

  const eligibleOptions = tierOptions.filter(
    (opt) => isOptionEligible(opt, row.accumulation)
  );

  const inTierModel = auditMatchModelName === "מודל צבירות גבוהות";
  const tierPotentialNotUsed = eligibleOptions.length > 0 && !inTierModel;

  return {
    hasTierModel:          true,
    eligibleForTier:       eligibleOptions.length > 0,
    inTierModel,
    tierPotentialNotUsed,
  };
}

// ─── Single row evaluation ────────────────────────────────────────────────────

function evaluateRow(row, agreementOptionsByIssuer) {
  // תפעול בלבד — מוחרג מבדיקה
  if (row.isOperationOnly) {
    return {
      agreementIssuerFound: false,
      agreementOptions:     [],
      ...{
        auditStatus:         AUDIT_STATUS.EXCLUDED,
        auditStatusHe:       AUDIT_STATUS_HE.excluded,
        auditMatchResult:    "EXCLUDED_OPERATION_ONLY",
        auditMatchModelName: "",
        auditMatchRuleType:  "EXCLUDED",
        auditReason:         "תפעול בלבד — הוחרג מבדיקת דמי ניהול",
        auditReferenceDepositFee:      null,
        auditReferenceAccumulationFee: null,
        issueCategory:  ISSUE_CATEGORY.NONE,
        requiredAction: "",
        priority:       PRIORITY.NONE,
      },
      hasTierModel: false, eligibleForTier: false, inTierModel: false, tierPotentialNotUsed: false,
    };
  }

  const options = agreementOptionsByIssuer[row.issuerCanonical] || [];
  const hasAgreement = options.length > 0;

  // הפעל בדיקה
  const evaluation = hasAgreement
    ? evaluateAgainstOptions(row, options)
    : evaluateBaseline(row);

  // חשב tier flags
  const tierFlags = buildTierFlags(row, options, evaluation.auditMatchModelName);

  // אם יש tier potential שלא מנוצל — העלה את ה-issue
  let { issueCategory, requiredAction, priority } = evaluation;
  if (
    tierFlags.tierPotentialNotUsed &&
    evaluation.auditStatus === AUDIT_STATUS.VALID
  ) {
    issueCategory  = ISSUE_CATEGORY.TIER_POTENTIAL_NOT_USED;
    requiredAction = "לבחון מעבר למודל צבירות גבוהות — דמי ניהול מוזלים";
    priority       = PRIORITY.MEDIUM;
  }

  return {
    agreementIssuerFound: hasAgreement,
    agreementOptions:     options,
    ...evaluation,
    ...tierFlags,
    issueCategory,
    requiredAction,
    priority,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function evaluateUnifiedRows({ unifiedRows = [], agreementOptionsByIssuer = {} } = {}) {
  return unifiedRows.map((row) => {
    const result = evaluateRow(row, agreementOptionsByIssuer);

    return {
      ...row,
      ...result,
      // שדה עזר נוח לפילטרים
      auditDisplayStatus: result.auditStatusHe,
    };
  });
}
