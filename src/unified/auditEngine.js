import {
  AUDIT_STATUS,
  AUDIT_STATUS_HE,
  AUDIT_MODELS,
  ISSUE_CATEGORY,
  getProductConfig,
} from "./unifiedSchema.js";

import {
  isEligibleOption,
  getEligibleAgreementOptions,
} from "./agreementEngine.js";

export function evaluateUnifiedRows({
  unifiedRows = [],
  agreementOptions = [],
} = {}) {
  return unifiedRows.map((row) =>
    evaluateUnifiedRow({
      row,
      agreementOptions,
    })
  );
}

export function auditUnifiedRows({
  unifiedRows = [],
  agreements = [],
} = {}) {
  return evaluateUnifiedRows({
    unifiedRows,
    agreementOptions: agreements,
  });
}

function evaluateUnifiedRow({
  row,
  agreementOptions,
}) {
  const config = getProductConfig(row.productType);

  if (isOperationalOnlyRow(row)) {
    return buildAuditResult(row, {
      auditStatus: AUDIT_STATUS.EXCLUDED,
      auditStatusHe: AUDIT_STATUS_HE.EXCLUDED,
      auditModel: AUDIT_MODELS.NONE,
      auditReason: "שורת תפעול בלבד - לא נכללת בבקרת דמי ניהול",
      issueCategory: ISSUE_CATEGORY.NONE,
      auditDetails: {
        ruleUsed: "OPERATIONAL_ONLY",
        checkedOptions: [],
        matchedOption: null,
        failedReasons: [],
      },
    });
  }

  const eligibleOptions = getEligibleAgreementOptions(
    row,
    agreementOptions
  );

  const checkedOptions = eligibleOptions.map((option) =>
    buildCheckedOption(row, option, config)
  );

  const fullMatch = checkedOptions.find(
    (option) => option.fullPass
  );

  if (fullMatch) {
    return buildAuditResult(row, {
      auditStatus: AUDIT_STATUS.VALID,
      auditStatusHe: AUDIT_STATUS_HE.VALID,
      auditModel: fullMatch.modelName || AUDIT_MODELS.STANDARD_MODEL,
      auditReason: `תקין לפי ${formatModelLabel(fullMatch.modelName)}`,
      issueCategory: ISSUE_CATEGORY.NONE,
      auditDetails: {
        ruleUsed: "FULL_MODEL_MATCH",
        checkedOptions,
        matchedOption: fullMatch,
        failedReasons: [],
      },
    });
  }

  const tierMatch = checkedOptions.find(
    (option) =>
      option.isTierModel &&
      option.accumulationPass &&
      option.depositPass
  );

  if (tierMatch) {
    return buildAuditResult(row, {
      auditStatus: AUDIT_STATUS.VALID,
      auditStatusHe: AUDIT_STATUS_HE.VALID,
      auditModel: AUDIT_MODELS.TIER_MODEL,
      auditReason: "תקין לפי מודל צבירות גבוהות / מדרגה",
      issueCategory: ISSUE_CATEGORY.NONE,
      auditDetails: {
        ruleUsed: "HIGH_ACCUMULATION_TIER",
        checkedOptions,
        matchedOption: tierMatch,
        failedReasons: [],
      },
    });
  }

  const accumulationOnlyMatch = checkedOptions.find(
    (option) => option.accumulationPass
  );

  if (accumulationOnlyMatch) {
    return buildAuditResult(row, {
      auditStatus: AUDIT_STATUS.VALID,
      auditStatusHe: AUDIT_STATUS_HE.VALID,
      auditModel: "APPROVED_ACCUMULATION",
      auditReason: "תקין לפי צבירה מאושרת",
      issueCategory: ISSUE_CATEGORY.NONE,
      auditDetails: {
        ruleUsed: "APPROVED_ACCUMULATION_ONLY",
        checkedOptions,
        matchedOption: accumulationOnlyMatch,
        failedReasons: collectFailedReasons(checkedOptions),
      },
    });
  }

  if (!eligibleOptions.length) {
    return applyBaselineAudit(row, config, checkedOptions);
  }

  return buildAuditResult(row, {
    auditStatus: AUDIT_STATUS.INVALID,
    auditStatusHe: AUDIT_STATUS_HE.INVALID,
    auditModel: AUDIT_MODELS.NONE,
    auditReason: "דמי הניהול גבוהים מההסכמים המאושרים",
    issueCategory: ISSUE_CATEGORY.MANAGEMENT_FEES,
    auditDetails: {
      ruleUsed: "FAILED_ALL_AGREEMENT_OPTIONS",
      checkedOptions,
      matchedOption: null,
      failedReasons: collectFailedReasons(checkedOptions),
    },
  });
}

function buildCheckedOption(row, option, config) {
  const actualAccumulationFee = normalizeNumber(row.accumulationFee);
  const actualDepositFee = normalizeNumber(row.depositFee);

  const approvedAccumulationFee = normalizeNumber(option.accumulationFee);
  const approvedDepositFee = normalizeNumber(option.depositFee);

  const supportsDepositFee = config.supportsDepositFees;

  const accumulationPass =
    actualAccumulationFee <= approvedAccumulationFee;

  const depositPass =
    !supportsDepositFee ||
    approvedDepositFee === 0 ||
    actualDepositFee <= approvedDepositFee;

  const eligible = isEligibleOption(row, option);

  const minAccumulation = normalizeNumber(option.minAccumulation);
  const isTierModel =
    option.modelName === AUDIT_MODELS.TIER_MODEL ||
    minAccumulation > 0;

  return {
    eligible,
    modelName: option.modelName || AUDIT_MODELS.STANDARD_MODEL,
    issuerCanonical: option.issuerCanonical,
    productType: option.productType,

    minAccumulation,

    actualAccumulation: normalizeNumber(row.accumulation),

    actualAccumulationFee,
    approvedAccumulationFee,
    accumulationPass,

    actualDepositFee,
    approvedDepositFee,
    depositPass,

    isTierModel,

    fullPass:
      eligible &&
      accumulationPass &&
      depositPass,
  };
}

function applyBaselineAudit(row, config, checkedOptions) {
  const actualAccumulationFee = normalizeNumber(row.accumulationFee);
  const actualDepositFee = normalizeNumber(row.depositFee);

  const baselineAccumulationFee = normalizeNumber(
    config.baselineAccumulationFee
  );

  const baselineDepositFee = normalizeNumber(
    config.baselineDepositFee
  );

  const accumulationPass =
    actualAccumulationFee <= baselineAccumulationFee;

  const depositPass =
    !config.supportsDepositFees ||
    actualDepositFee <= baselineDepositFee;

  if (accumulationPass && depositPass) {
    return buildAuditResult(row, {
      auditStatus: AUDIT_STATUS.VALID_BASELINE,
      auditStatusHe: AUDIT_STATUS_HE.VALID_BASELINE,
      auditModel: AUDIT_MODELS.BASELINE,
      auditReason: "תקין לפי כלל ברירת מחדל ליצרן ללא הסכם",
      issueCategory: ISSUE_CATEGORY.NONE,
      auditDetails: {
        ruleUsed: "BASELINE_VALID",
        checkedOptions,
        matchedOption: {
          modelName: AUDIT_MODELS.BASELINE,
          actualAccumulationFee,
          approvedAccumulationFee: baselineAccumulationFee,
          accumulationPass,
          actualDepositFee,
          approvedDepositFee: baselineDepositFee,
          depositPass,
        },
        failedReasons: [],
      },
    });
  }

  return buildAuditResult(row, {
    auditStatus: AUDIT_STATUS.INVALID,
    auditStatusHe: AUDIT_STATUS_HE.INVALID,
    auditModel: AUDIT_MODELS.BASELINE,
    auditReason: "חריגה מכלל ברירת מחדל ליצרן ללא הסכם",
    issueCategory: ISSUE_CATEGORY.NO_AGREEMENT,
    auditDetails: {
      ruleUsed: "BASELINE_INVALID",
      checkedOptions,
      matchedOption: null,
      failedReasons: [
        !accumulationPass
          ? `דמי ניהול מצבירה ${actualAccumulationFee}% גבוהים מהמאושר ${baselineAccumulationFee}%`
          : null,
        !depositPass
          ? `דמי ניהול מהפקדה ${actualDepositFee}% גבוהים מהמאושר ${baselineDepositFee}%`
          : null,
      ].filter(Boolean),
    },
  });
}

function buildAuditResult(row, auditFields) {
  return {
    ...row,
    ...auditFields,
  };
}

function collectFailedReasons(checkedOptions) {
  const reasons = [];

  checkedOptions.forEach((option) => {
    if (!option.accumulationPass) {
      reasons.push(
        `${formatModelLabel(option.modelName)}: דמי ניהול מצבירה בפועל ${option.actualAccumulationFee}% גבוהים מהמאושר ${option.approvedAccumulationFee}%`
      );
    }

    if (!option.depositPass) {
      reasons.push(
        `${formatModelLabel(option.modelName)}: דמי ניהול מהפקדה בפועל ${option.actualDepositFee}% גבוהים מהמאושר ${option.approvedDepositFee}%`
      );
    }
  });

  return [...new Set(reasons)];
}

function formatModelLabel(modelName) {
  if (!modelName) return "מודל הסכם";

  const modelMap = {
    [AUDIT_MODELS.MODEL_A]: "מודל א",
    [AUDIT_MODELS.MODEL_B]: "מודל ב",
    [AUDIT_MODELS.TIER_MODEL]: "מודל צבירות גבוהות / מדרגה",
    [AUDIT_MODELS.BASELINE]: "כלל ברירת מחדל",
    [AUDIT_MODELS.STANDARD_MODEL]: "מודל הסכם",
    APPROVED_ACCUMULATION: "צבירה מאושרת",
  };

  return modelMap[modelName] || modelName;
}

function isOperationalOnlyRow(row) {
  return (
    row?.isOperationalOnly === true ||
    row?.auditStatus === AUDIT_STATUS.EXCLUDED ||
    String(row?.productType || "").toLowerCase() === "operational"
  );
}

function normalizeNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const parsed = Number(normalized);

  return Number.isNaN(parsed) ? 0 : parsed;
}
