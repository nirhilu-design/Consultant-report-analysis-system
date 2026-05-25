// NEW FILE
// Path: src/unified/auditEngine.js

import {
  getProductConfig,
  AUDIT_STATUS,
  AUDIT_STATUS_HE,
  ISSUE_CATEGORY,
} from "./unifiedSchema";

import { isEligibleOption } from "./agreementEngine";

function optionMatchesFull(row, option, config) {
  const checks = [];

  if (
    config.hasDepositFee &&
    row.depositFee !== null &&
    option.depositFee !== null
  ) {
    checks.push(row.depositFee <= option.depositFee);
  }

  if (
    config.hasAccumulationFee &&
    row.accumulationFee !== null &&
    option.accumulationFee !== null
  ) {
    checks.push(row.accumulationFee <= option.accumulationFee);
  }

  return checks.length > 0 && checks.every(Boolean);
}

function optionMatchesAccumulationOnly(row, option, config) {
  if (!config.hasAccumulationFee) return false;
  if (row.accumulationFee === null || option.accumulationFee === null) {
    return false;
  }

  return row.accumulationFee <= option.accumulationFee;
}

function baselineEvaluation(row, config) {
  const baseline = config.withoutAgreementBaseline || {};

  const depositOk =
    baseline.depositFee === null ||
    row.depositFee === null ||
    row.depositFee <= baseline.depositFee;

  const accumulationOk =
    baseline.accumulationFee === null ||
    row.accumulationFee === null ||
    row.accumulationFee <= baseline.accumulationFee;

  const pass = depositOk && accumulationOk;

  return {
    auditStatus: pass ? AUDIT_STATUS.VALID : AUDIT_STATUS.INVALID,
    auditStatusHe: pass ? AUDIT_STATUS_HE.VALID : AUDIT_STATUS_HE.INVALID,
    auditMatchResult: pass ? "BASELINE_NO_AGREEMENT" : "BASELINE_FAILURE",
    auditMatchModelName: "כלל בסיס ללא הסכם",
    auditMatchRuleType: "WITHOUT_AGREEMENT",
    auditReason: pass
      ? "אין הסכם, אך דמי הניהול עומדים בכלל הבסיס"
      : "אין הסכם ודמי הניהול חורגים מכלל הבסיס",
    issueCategory: pass
      ? ISSUE_CATEGORY.NONE
      : ISSUE_CATEGORY.MISSING_AGREEMENT,
    requiredAction: pass
      ? ""
      : "להשלים/לעדכן הסכם דמי ניהול ליצרן",
    priority: pass ? "" : "HIGH",
    auditReferenceDepositFee: baseline.depositFee,
    auditReferenceAccumulationFee: baseline.accumulationFee,
  };
}

function evaluateRow(row, options, config) {
  if (row.isExcludedFromFeeAudit) {
    return {
      auditStatus: AUDIT_STATUS.EXCLUDED,
      auditStatusHe: AUDIT_STATUS_HE.EXCLUDED,
      auditMatchResult: "EXCLUDED_OPERATION_ONLY",
      auditMatchModelName: "",
      auditMatchRuleType: "EXCLUDED",
      auditReason: row.auditReason || "הוחרג מבדיקת דמי ניהול",
      issueCategory: ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority: "",
    };
  }

  if (!options.length) {
    return baselineEvaluation(row, config);
  }

  // Rule 1: full match against any approved model.
  const fullMatch = options.find((option) =>
    optionMatchesFull(row, option, config)
  );

  if (fullMatch) {
    return {
      auditStatus: AUDIT_STATUS.VALID,
      auditStatusHe: AUDIT_STATUS_HE.VALID,
      auditMatchResult: `MATCH_${fullMatch.optionName}`,
      auditMatchModelName: fullMatch.optionName,
      auditMatchRuleType: fullMatch.conditionType,
      auditReason: `דמי הניהול עומדים במודל: ${fullMatch.optionName}`,
      issueCategory: ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority: "",
      auditReferenceDepositFee: fullMatch.depositFee,
      auditReferenceAccumulationFee: fullMatch.accumulationFee,
    };
  }

  // Rule 2: approved business rule:
  // If actual accumulation fee is <= any approved accumulation fee option,
  // the row is valid.
  const accumulationMatch = options.find((option) =>
    optionMatchesAccumulationOnly(row, option, config)
  );

  if (accumulationMatch) {
    return {
      auditStatus: AUDIT_STATUS.VALID,
      auditStatusHe: AUDIT_STATUS_HE.VALID,
      auditMatchResult: "MATCH_ACCUMULATION_FEE_APPROVED",
      auditMatchModelName: accumulationMatch.optionName,
      auditMatchRuleType: "ACCUMULATION_FEE_ONLY",
      auditReason: `אושר לפי דמי ניהול מצבירה: בפועל נמוך/שווה למודל ${accumulationMatch.optionName}`,
      issueCategory: ISSUE_CATEGORY.NONE,
      requiredAction: "",
      priority: "",
      auditReferenceDepositFee: accumulationMatch.depositFee,
      auditReferenceAccumulationFee: accumulationMatch.accumulationFee,
    };
  }

  const reference = options[0] || {};

  return {
    auditStatus: AUDIT_STATUS.INVALID,
    auditStatusHe: AUDIT_STATUS_HE.INVALID,
    auditMatchResult: "NO_MATCHING_MODEL",
    auditMatchModelName: reference.optionName || "",
    auditMatchRuleType: reference.conditionType || "",
    auditReason: "דמי הניהול אינם עומדים באף מודל מאושר",
    issueCategory: ISSUE_CATEGORY.FEE_MISMATCH,
    requiredAction: "בדיקת דמי ניהול מול היצרן/מנהל ההסדר",
    priority: "HIGH",
    auditReferenceDepositFee: reference.depositFee ?? null,
    auditReferenceAccumulationFee: reference.accumulationFee ?? null,
  };
}

function tierFlags(row, options = []) {
  const tierOptions = options.filter((option) =>
    ["MIN_ACCUMULATION", "MAX_ACCUMULATION"].includes(option.conditionType)
  );

  const eligibleTierOptions = tierOptions.filter((option) =>
    isEligibleOption(option, row.accumulation)
  );

  const actualInTierModel = eligibleTierOptions.some((option) => {
    if (row.accumulationFee === null || option.accumulationFee === null) {
      return false;
    }

    return row.accumulationFee <= option.accumulationFee;
  });

  return {
    hasTierModel: tierOptions.length > 0,
    eligibleTierModel: eligibleTierOptions.length > 0,
    actualInTierModel,
    tierPotentialNotUsed:
      eligibleTierOptions.length > 0 && !actualInTierModel,
  };
}

export function evaluateUnifiedRows({
  unifiedRows = [],
  agreementOptionsByIssuer = {},
  productType,
} = {}) {
  const config = getProductConfig(productType);

  return unifiedRows.map((row) => {
    const options = agreementOptionsByIssuer[row.issuerCanonical] || [];

    const evaluation = evaluateRow(row, options, config);
    const tier = tierFlags(row, options);

    let issueCategory = evaluation.issueCategory;
    let requiredAction = evaluation.requiredAction;
    let priority = evaluation.priority;

    if (
      tier.tierPotentialNotUsed &&
      evaluation.auditStatus !== AUDIT_STATUS.INVALID &&
      !row.isExcludedFromFeeAudit
    ) {
      issueCategory = ISSUE_CATEGORY.LARGE_BALANCE_NOT_OPTIMIZED;
      requiredAction = "לבחון מעבר למודל צבירות גבוהות / מדרגה מוזלת";
      priority = "MEDIUM";
    }

    return {
      ...row,

      agreementIssuerFound: options.length > 0,
      agreementOptions: options,
      agreementOptionsCount: options.length,

      ...evaluation,
      ...tier,

      issueCategory,
      requiredAction,
      priority,
    };
  });
}
