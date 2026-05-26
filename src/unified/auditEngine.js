// Path: src/unified/auditEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT ENGINE — מנוע בדיקת דמי ניהול
//
// כלל בדיקה:
//   המקור האמין לדמי ניהול מאושרים הוא cols 42-43 בקובץ הפנסיה עצמו
//   (דמי ניהול מפרמיה/מצבירה בהסכם) — אלה הדמי ניהול שמנהל ההסדר אישר
//   בפועל לכל פוליסה. קובץ ההסכמים הנפרד משמש רק כגיבוי.
//
// כללי בדיקה לפי סדר:
//   1. אם cols 42+43 קיימים → השווה אחד לאחד
//   2. אם אין → השווה מול קובץ הסכמים (מודל א / מודל גבוה)
//   3. ללא כל הסכם → בדוק מול כלל בסיס (1% / 0.5%)
// ─────────────────────────────────────────────────────────────────────────────

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
  NONE:                    "NONE",
  FEE_MISMATCH:            "FEE_MISMATCH",
  MISSING_AGREEMENT:       "MISSING_AGREEMENT",
  TIER_POTENTIAL_NOT_USED: "TIER_POTENTIAL_NOT_USED",
};

export const PRIORITY = {
  HIGH:   "HIGH",
  MEDIUM: "MEDIUM",
  NONE:   "",
};

// כלל בסיס מוחלט — ללא כל הסכם
const BASELINE = { depositFee: 1.0, accumulationFee: 0.5 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function feeOk(actual, approved) {
  if (actual === null || actual === undefined) return true;
  if (approved === null || approved === undefined) return true;
  return actual <= approved;
}

function isOptionEligible(option, accumulation) {
  if (option.conditionType === "MIN_ACCUMULATION") {
    return !option.conditionValue || (accumulation || 0) >= option.conditionValue;
  }
  return true;
}

// ─── Evaluate using inline agreement (cols 42-43 from pension file) ───────────
// זהו המקור הראשון והאמין ביותר

function evaluateInlineAgreement(row) {
  const agrDep = row.depositFeeAgreement;
  const agrAcc = row.accumulationFeeAgreement;

  // אם אין נתונים ב-cols 42-43 — עבור לשיטה הבאה
  if (agrDep === null && agrAcc === null) return null;

  const depOk = feeOk(row.depositFee, agrDep);
  const accOk = feeOk(row.accumulationFee, agrAcc);
  const pass  = depOk && accOk;

  return {
    auditStatus:         pass ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe:       pass ? AUDIT_STATUS_HE.valid : AUDIT_STATUS_HE.invalid,
    auditMatchResult:    pass ? "MATCH_INLINE_AGREEMENT" : "FAIL_INLINE_AGREEMENT",
    auditMatchModelName: "הסכם מנהל הסדר",
    auditMatchRuleType:  "INLINE_AGREEMENT",
    auditReason:         pass
      ? "דמי הניהול עומדים בהסכם מנהל ההסדר"
      : `חריגה: הפקדה ${row.depositFee}% vs מאושר ${agrDep}% | צבירה ${row.accumulationFee}% vs מאושר ${agrAcc}%`,
    auditReferenceDepositFee:      agrDep,
    auditReferenceAccumulationFee: agrAcc,
    issueCategory:  pass ? ISSUE_CATEGORY.NONE : ISSUE_CATEGORY.FEE_MISMATCH,
    requiredAction: pass ? "" : "בדיקת דמי ניהול מול מנהל ההסדר",
    priority:       pass ? PRIORITY.NONE : PRIORITY.HIGH,
  };
}

// ─── Evaluate using external agreements file ──────────────────────────────────

function evaluateExternalAgreement(row, options) {
  // כלל 1: Full match
  const fullOpt = options.find(
    (o) => isOptionEligible(o, row.accumulation) &&
           feeOk(row.depositFee, o.depositFee) &&
           feeOk(row.accumulationFee, o.accumulationFee) &&
           (row.depositFee !== null || row.accumulationFee !== null)
  );
  if (fullOpt) {
    return {
      auditStatus:         AUDIT_STATUS.VALID,
      auditStatusHe:       AUDIT_STATUS_HE.valid,
      auditMatchResult:    `MATCH_${fullOpt.optionName}`,
      auditMatchModelName: fullOpt.optionName,
      auditMatchRuleType:  fullOpt.conditionType,
      auditReason:         `עומד ב${fullOpt.optionName}`,
      auditReferenceDepositFee:      fullOpt.depositFee,
      auditReferenceAccumulationFee: fullOpt.accumulationFee,
      issueCategory:  ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority:       PRIORITY.NONE,
    };
  }

  // כלל 2: Accumulation fee only
  const accOpt = options.find(
    (o) => isOptionEligible(o, row.accumulation) &&
           feeOk(row.accumulationFee, o.accumulationFee) &&
           row.accumulationFee !== null && o.accumulationFee !== null
  );
  if (accOpt) {
    return {
      auditStatus:         AUDIT_STATUS.VALID,
      auditStatusHe:       AUDIT_STATUS_HE.valid,
      auditMatchResult:    "MATCH_ACCUMULATION_ONLY",
      auditMatchModelName: accOpt.optionName,
      auditMatchRuleType:  "ACCUMULATION_FEE_ONLY",
      auditReason:         `אושר לפי ד.נ צבירה בלבד — ${accOpt.optionName}`,
      auditReferenceDepositFee:      accOpt.depositFee,
      auditReferenceAccumulationFee: accOpt.accumulationFee,
      issueCategory:  ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority:       PRIORITY.NONE,
    };
  }

  // כלל 3: Invalid
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

// ─── Baseline (no agreement at all) ──────────────────────────────────────────

function evaluateBaseline(row) {
  const pass = feeOk(row.depositFee, BASELINE.depositFee) &&
               feeOk(row.accumulationFee, BASELINE.accumulationFee);
  return {
    auditStatus:         pass ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe:       pass ? AUDIT_STATUS_HE.valid : AUDIT_STATUS_HE.invalid,
    auditMatchResult:    pass ? "BASELINE_PASS" : "BASELINE_FAIL",
    auditMatchModelName: "כלל בסיס ללא הסכם",
    auditMatchRuleType:  "WITHOUT_AGREEMENT",
    auditReason:         pass ? "אין הסכם — עומד בכלל הבסיס" : "אין הסכם — חורג מכלל הבסיס",
    auditReferenceDepositFee:      BASELINE.depositFee,
    auditReferenceAccumulationFee: BASELINE.accumulationFee,
    issueCategory:  pass ? ISSUE_CATEGORY.NONE : ISSUE_CATEGORY.MISSING_AGREEMENT,
    requiredAction: pass ? "" : "לעדכן הסכם דמי ניהול עם היצרן",
    priority:       pass ? PRIORITY.NONE : PRIORITY.HIGH,
  };
}

// ─── Tier flags ───────────────────────────────────────────────────────────────

function buildTierFlags(row, options, auditMatchModelName) {
  const tierOpts = options.filter(
    (o) => o.conditionType === "MIN_ACCUMULATION" || o.conditionType === "MAX_ACCUMULATION"
  );
  if (!tierOpts.length) {
    return { hasTierModel: false, eligibleForTier: false, inTierModel: false, tierPotentialNotUsed: false };
  }
  const eligible    = tierOpts.filter((o) => isOptionEligible(o, row.accumulation));
  const inTierModel = auditMatchModelName === "מודל צבירות גבוהות";
  return {
    hasTierModel:          true,
    eligibleForTier:       eligible.length > 0,
    inTierModel,
    tierPotentialNotUsed:  eligible.length > 0 && !inTierModel,
  };
}

// ─── Single row ───────────────────────────────────────────────────────────────

function evaluateRow(row, agreementOptionsByIssuer) {
  if (row.isOperationOnly || row.isExcludedFromFeeAudit || row.auditStatus === AUDIT_STATUS.EXCLUDED) {
    return {
      agreementIssuerFound: false,
      agreementOptions:     [],
      auditStatus:          AUDIT_STATUS.EXCLUDED,
      auditStatusHe:        AUDIT_STATUS_HE.excluded,
      auditMatchResult:     "EXCLUDED_OPERATION_ONLY",
      auditMatchModelName:  "",
      auditMatchRuleType:   "EXCLUDED",
      auditReason:          "תפעול בלבד — הוחרג מבדיקה",
      auditReferenceDepositFee:      null,
      auditReferenceAccumulationFee: null,
      issueCategory:        ISSUE_CATEGORY.NONE,
      requiredAction:       "",
      priority:             PRIORITY.NONE,
      hasTierModel: false, eligibleForTier: false, inTierModel: false, tierPotentialNotUsed: false,
    };
  }

  const options    = agreementOptionsByIssuer[row.issuerCanonical] || [];

  // שלב 1: הסכם inline (cols 42-43) — הכי אמין
  const inlineResult = evaluateInlineAgreement(row);
  const evaluation   = inlineResult
    ?? (options.length ? evaluateExternalAgreement(row, options) : evaluateBaseline(row));

  const tierFlags = buildTierFlags(row, options, evaluation.auditMatchModelName);

  let { issueCategory, requiredAction, priority } = evaluation;
  if (tierFlags.tierPotentialNotUsed && evaluation.auditStatus === AUDIT_STATUS.VALID) {
    issueCategory  = ISSUE_CATEGORY.TIER_POTENTIAL_NOT_USED;
    requiredAction = "לבחון מעבר למודל צבירות גבוהות — דמי ניהול מוזלים";
    priority       = PRIORITY.MEDIUM;
  }

  return {
    agreementIssuerFound: options.length > 0 || row.depositFeeAgreement !== null || row.accumulationFeeAgreement !== null,
    agreementOptions:     options,
    ...evaluation,
    ...tierFlags,
    issueCategory,
    requiredAction,
    priority,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function evaluateUnifiedRows({ unifiedRows = [], agreementOptionsByIssuer = {} } = {}) {
  return unifiedRows.map((row) => ({
    ...row,
    ...evaluateRow(row, agreementOptionsByIssuer),
    auditDisplayStatus: row.isOperationOnly
      ? AUDIT_STATUS_HE.excluded
      : undefined,
  })).map((row) => ({
    ...row,
    auditDisplayStatus: row.auditStatusHe || row.auditDisplayStatus,
  }));
}
