import { PRODUCT_TYPES, getProductConfig } from "../config/productConfigs";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .replace(/[^\w\u0590-\u05FF\s/+.-]/g, "")
    .trim();
}

function normalizePercent(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const raw = String(value).replace("%", "").replace(",", ".").trim();
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) return null;

  // System works in percent units:
  // 0.15 means 0.15%, 1 means 1%.
  return parsed;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") return value;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

const DEFAULT_ISSUER_ALIASES = {
  "הפניקס": ["הפניקס", "פניקס", "הפניקס חברה לביטוח", "הפניקס פנסיה", "אקסלנס", "אקסלנס הפניקס"],
  "הראל": ["הראל", "הראל פנסיה", "הראל חברה לביטוח"],
  "כלל": ["כלל", "כלל פנסיה", "כלל פנסיה וגמל"],
  "מגדל": ["מגדל", "מגדל מקפת", "מקפת"],
  "מנורה מבטחים": ["מנורה", "מבטחים", "מנורה מבטחים"],
  "מיטב": ["מיטב", "מיטב דש"],
  "אלטשולר שחם": ["אלטשולר", "אלטשולר שחם"],
  "מור": ["מור", "מור גמל", "מור גמל ופנסיה"],
  "ילין לפידות": ["ילין", "ילין לפידות"],
  "אנליסט": ["אנליסט"],
  "איילון": ["איילון"],
};

function buildAliasLookup(customAliases = {}) {
  const merged = {
    ...DEFAULT_ISSUER_ALIASES,
    ...customAliases,
  };

  const lookup = {};

  Object.entries(merged).forEach(([canonical, aliases]) => {
    [canonical, ...(aliases || [])].forEach((alias) => {
      const clean = normalizeText(alias);
      if (clean) lookup[clean] = canonical;
    });
  });

  return lookup;
}

function canonicalIssuer(value, aliasLookup) {
  const clean = normalizeText(value);

  if (!clean) return "יצרן לא צוין";

  if (aliasLookup[clean]) return aliasLookup[clean];

  const fuzzy = Object.entries(aliasLookup).find(([alias]) => {
    return alias && clean.includes(alias);
  });

  if (fuzzy) return fuzzy[1];

  return `יצרן לא מוכר - ${clean}`;
}

function getPolicyIssuer(policy = {}) {
  return (
    policy.originalManager ||
    policy.manager ||
    policy.issuer ||
    policy.company ||
    "לא מזוהה"
  );
}

function getPolicyClientId(policy = {}) {
  const raw = policy.raw || {};

  return (
    policy.clientId ||
    policy.employeeId ||
    raw["קוד מזהה של העובד"] ||
    raw["תעודת זהות"] ||
    raw["ת.ז"] ||
    raw["מספר זהות"] ||
    raw["מספר עובד"] ||
    ""
  );
}

function getPolicyInvestmentTrack(policy = {}) {
  const raw = policy.raw || {};

  return (
    policy.investmentTrack ||
    policy.track ||
    raw["שם מסלול השקעה - תגמולים"] ||
    raw[" שם מסלול השקעה - תגמולים"] ||
    raw["מסלול השקעה"] ||
    raw["שם מסלול"] ||
    "מסלול לא צוין"
  );
}

function getPolicyInsuranceTrack(policy = {}) {
  const raw = policy.raw || {};

  return (
    policy.insuranceTrack ||
    policy.insuranceWaiver ||
    raw["מסלול ביטוח בקרן הפנסיה"] ||
    raw["מסלול ביטוח"] ||
    "מסלול ביטוח לא צוין"
  );
}

function getPolicyAccumulation(policy = {}) {
  const raw = policy.raw || {};

  return normalizeNumber(
    policy.accumulation ??
      raw["סה\"כ ערכי פידיון"] ??
      raw["סה״כ ערכי פידיון"] ??
      raw["ערך פדיון כולל"] ??
      raw["ערך פדיון כולל "] ??
      raw["ערך פדיון כולל "] ??
      raw["צבירה"] ??
      raw["יתרה"]
  );
}

function getPolicyDepositFee(policy = {}) {
  const raw = policy.raw || {};

  return normalizePercent(
    policy.depositFee ??
      raw["דמי ניהול מפרמיה באחוזים"] ??
      raw["דמי ניהול מהפקדה"] ??
      raw["דמי ניהול מהפקדות"] ??
      raw["מהפקדה"]
  );
}

function getPolicyAccumulationFee(policy = {}) {
  const raw = policy.raw || {};

  return normalizePercent(
    policy.accumulationFee ??
      raw["דמי ניהול מצבירה באחוזים"] ??
      raw["דמי ניהול מצבירה"] ??
      raw["מצבירה"]
  );
}

function getAgreementIssuer(agreement = {}) {
  return agreement.originalManager || agreement.manager || agreement.issuer || "לא מזוהה";
}

function getAgreementDepositFee(agreement = {}) {
  return normalizePercent(
    agreement.depositFee ??
      agreement.premiumFee ??
      agreement.raw?.["דמי ניהול מהפקדה"] ??
      agreement.raw?.["דמי ניהול מפרמיה"] ??
      agreement.raw?.["מהפקדה"]
  );
}

function getAgreementAccumulationFee(agreement = {}) {
  return normalizePercent(
    agreement.accumulationFee ??
      agreement.assetFee ??
      agreement.raw?.["דמי ניהול מצבירה"] ??
      agreement.raw?.["מצבירה"]
  );
}

function detectAgreementOptionName(agreement = {}, index = 0) {
  return (
    agreement.optionName ||
    agreement.modelName ||
    agreement.raw?.["מודל"] ||
    agreement.raw?.["אפשרות"] ||
    agreement.raw?.["שם מודל"] ||
    `מודל ${index + 1}`
  );
}

function detectConditionType(agreement = {}) {
  const text = normalizeText(
    `${agreement.optionName || ""} ${agreement.modelName || ""} ${agreement.raw?.["מודל"] || ""} ${agreement.raw?.["הערות"] || ""}`
  );

  if (/צביר|גבוה|מעל|MIN_ACCUMULATION/.test(text)) return "MIN_ACCUMULATION";
  if (/עד|MAX_ACCUMULATION/.test(text)) return "MAX_ACCUMULATION";
  if (/בחירת|עובד|EMPLOYEE_CHOICE/.test(text)) return "EMPLOYEE_CHOICE";

  return agreement.conditionType || "DEFAULT";
}

function detectConditionValue(agreement = {}) {
  if (agreement.conditionValue !== undefined && agreement.conditionValue !== null) {
    return normalizeNumber(agreement.conditionValue);
  }

  const text = normalizeText(
    `${agreement.optionName || ""} ${agreement.modelName || ""} ${agreement.raw?.["מודל"] || ""} ${agreement.raw?.["הערות"] || ""}`
  );

  const match = text.match(/(\d{2,3}(?:,\d{3})+|\d{5,})/);

  return match ? normalizeNumber(match[1]) : null;
}

function normalizeAgreementOptions(agreements = [], aliasLookup) {
  const map = {};

  agreements.forEach((agreement, index) => {
    const issuer = canonicalIssuer(getAgreementIssuer(agreement), aliasLookup);

    const option = {
      issuer,
      optionName: detectAgreementOptionName(agreement, index),
      depositFee: getAgreementDepositFee(agreement),
      accumulationFee: getAgreementAccumulationFee(agreement),
      conditionType: detectConditionType(agreement),
      conditionValue: detectConditionValue(agreement),
      isDefault: Boolean(agreement.isDefault) || detectConditionType(agreement) === "DEFAULT",
      raw: agreement,
    };

    if (!map[issuer]) map[issuer] = [];
    map[issuer].push(option);
  });

  return map;
}

function isEligibleOption(option, accumulation) {
  const acc = Number(accumulation || 0);

  if (option.conditionType === "MIN_ACCUMULATION") {
    return option.conditionValue === null ? true : acc > option.conditionValue;
  }

  if (option.conditionType === "MAX_ACCUMULATION") {
    return option.conditionValue === null ? true : acc <= option.conditionValue;
  }

  return true;
}

function optionMatchesByFullFees(policy, option, config) {
  const checks = [];

  if (config.hasDepositFee && policy.depositFee !== null && option.depositFee !== null) {
    checks.push(policy.depositFee <= option.depositFee);
  }

  if (config.hasAccumulationFee && policy.accumulationFee !== null && option.accumulationFee !== null) {
    checks.push(policy.accumulationFee <= option.accumulationFee);
  }

  if (!checks.length) return false;

  return checks.every(Boolean);
}

function optionMatchesByAccumulationFeeOnly(policy, option, config) {
  if (!config.hasAccumulationFee) return false;
  if (policy.accumulationFee === null || option.accumulationFee === null) return false;

  return policy.accumulationFee <= option.accumulationFee;
}

function evaluatePolicyAgainstAgreement({ policy, options, config }) {
  if (!options || !options.length) {
    const baseline = config.baseline || {};

    const depositOk =
      baseline.depositFee === null ||
      policy.depositFee === null ||
      policy.depositFee <= baseline.depositFee;

    const accumulationOk =
      baseline.accumulationFee === null ||
      policy.accumulationFee === null ||
      policy.accumulationFee <= baseline.accumulationFee;

    const baselinePass = depositOk && accumulationOk;

    return {
      agreementIssuerFound: false,
      auditStatus: baselinePass ? "valid" : "invalid",
      auditStatusHe: baselinePass ? "תקין" : "חריג",
      auditMatchResult: baselinePass ? "BASELINE_NO_AGREEMENT" : "BASELINE_FAILURE",
      auditMatchModelName: "כלל בסיס ללא הסכם",
      auditMatchRuleType: "WITHOUT_AGREEMENT",
      auditReason: baselinePass
        ? "אין הסכם, אך דמי הניהול עומדים בכלל הבסיס"
        : "אין הסכם ודמי הניהול חורגים מכלל הבסיס",
      issueCategory: baselinePass ? "NONE" : "MISSING_AGREEMENT",
      requiredAction: baselinePass ? "" : "להשלים/לעדכן הסכם דמי ניהול ליצרן",
      priority: baselinePass ? "" : "HIGH",
      matchedOption: null,
    };
  }

  const eligibleOptions = options.filter((option) =>
    isEligibleOption(option, policy.accumulation)
  );

  const optionsToCheck = eligibleOptions.length ? eligibleOptions : options;

  const fullMatch = optionsToCheck.find((option) =>
    optionMatchesByFullFees(policy, option, config)
  );

  if (fullMatch) {
    return {
      agreementIssuerFound: true,
      auditStatus: "valid",
      auditStatusHe: "תקין",
      auditMatchResult: `MATCH_${fullMatch.optionName}`,
      auditMatchModelName: fullMatch.optionName,
      auditMatchRuleType: fullMatch.conditionType,
      auditReferenceDepositFee: fullMatch.depositFee,
      auditReferenceAccumulationFee: fullMatch.accumulationFee,
      auditReason: `דמי הניהול עומדים במודל: ${fullMatch.optionName}`,
      issueCategory: "NONE",
      requiredAction: "",
      priority: "",
      matchedOption: fullMatch,
    };
  }

  // Approved business rule:
  // if actual accumulation fee is <= any approved accumulation fee option,
  // the row is valid even if deposit fee does not match exactly.
  const accumulationOnlyMatch = optionsToCheck.find((option) =>
    optionMatchesByAccumulationFeeOnly(policy, option, config)
  );

  if (accumulationOnlyMatch) {
    return {
      agreementIssuerFound: true,
      auditStatus: "valid",
      auditStatusHe: "תקין",
      auditMatchResult: "MATCH_ACCUMULATION_FEE_APPROVED",
      auditMatchModelName: accumulationOnlyMatch.optionName,
      auditMatchRuleType: "ACCUMULATION_FEE_ONLY",
      auditReferenceDepositFee: accumulationOnlyMatch.depositFee,
      auditReferenceAccumulationFee: accumulationOnlyMatch.accumulationFee,
      auditReason: `אושר לפי דמי ניהול מצבירה: בפועל נמוך/שווה למודל ${accumulationOnlyMatch.optionName}`,
      issueCategory: "NONE",
      requiredAction: "",
      priority: "",
      matchedOption: accumulationOnlyMatch,
    };
  }

  const reference = optionsToCheck[0] || options[0];

  return {
    agreementIssuerFound: true,
    auditStatus: "invalid",
    auditStatusHe: "חריג",
    auditMatchResult: "NO_MATCHING_MODEL",
    auditMatchModelName: reference?.optionName || "",
    auditMatchRuleType: reference?.conditionType || "",
    auditReferenceDepositFee: reference?.depositFee ?? null,
    auditReferenceAccumulationFee: reference?.accumulationFee ?? null,
    auditReason: "דמי הניהול אינם עומדים באף מודל מאושר",
    issueCategory: "FEE_MISMATCH",
    requiredAction: "בדיקת דמי ניהול מול היצרן/מנהל ההסדר",
    priority: "HIGH",
    matchedOption: null,
  };
}

function detectTierFlags(options = [], policy, evaluation) {
  const tierOptions = options.filter((option) =>
    ["MIN_ACCUMULATION", "MAX_ACCUMULATION"].includes(option.conditionType)
  );

  const eligibleTierOptions = tierOptions.filter((option) =>
    isEligibleOption(option, policy.accumulation)
  );

  const actualInTierModel = eligibleTierOptions.some((option) =>
    optionMatchesByAccumulationFeeOnly(policy, option, {
      hasAccumulationFee: true,
      hasDepositFee: true,
    })
  );

  const tierPotentialNotUsed =
    eligibleTierOptions.length > 0 &&
    !actualInTierModel &&
    evaluation.auditStatus !== "invalid";

  return {
    hasTierModel: tierOptions.length > 0,
    eligibleTierModel: eligibleTierOptions.length > 0,
    actualInTierModel,
    tierPotentialNotUsed,
  };
}

export function buildUnifiedAudit({
  rows = [],
  agreements = [],
  broker = {
    brokerId: "broker_001",
    brokerName: "מנהל הסדר 1",
  },
  productType = PRODUCT_TYPES.PENSION,
  issuerAliases = {},
} = {}) {
  const config = getProductConfig(productType);
  const aliasLookup = buildAliasLookup(issuerAliases);
  const agreementOptionsByIssuer = normalizeAgreementOptions(agreements, aliasLookup);

  const unifiedRows = rows.map((row, index) => {
    const issuerOriginal = getPolicyIssuer(row);
    const issuerCanonical = canonicalIssuer(issuerOriginal, aliasLookup);

    const policy = {
      clientId: getPolicyClientId(row),
      issuerOriginal,
      issuerCanonical,
      accumulation: getPolicyAccumulation(row),
      depositFee: getPolicyDepositFee(row),
      accumulationFee: getPolicyAccumulationFee(row),
      investmentTrack: normalizeText(getPolicyInvestmentTrack(row)) || "מסלול לא צוין",
      insuranceTrack: normalizeText(getPolicyInsuranceTrack(row)) || "מסלול ביטוח לא צוין",
      raw: row,
    };

    const agreementOptions = agreementOptionsByIssuer[issuerCanonical] || [];

    const evaluation = evaluatePolicyAgainstAgreement({
      policy,
      options: agreementOptions,
      config,
    });

    const tier = detectTierFlags(agreementOptions, policy, evaluation);

    return {
      auditRowId: `${broker.brokerId || "broker_001"}_${productType}_${index + 1}`,
      brokerId: broker.brokerId || "broker_001",
      brokerName: broker.brokerName || "מנהל הסדר 1",
      productType,

      sourceRowNumber: index + 1,
      clientId: policy.clientId,

      issuerOriginal: policy.issuerOriginal,
      issuerCanonical: policy.issuerCanonical,

      accumulation: policy.accumulation,
      depositFee: policy.depositFee,
      accumulationFee: policy.accumulationFee,

      investmentTrack: policy.investmentTrack,
      insuranceTrack: policy.insuranceTrack,

      agreementIssuerFound: evaluation.agreementIssuerFound,
      agreementOptionsCount: agreementOptions.length,
      agreementOptions,

      auditStatus: evaluation.auditStatus,
      auditStatusHe: evaluation.auditStatusHe,
      auditMatchResult: evaluation.auditMatchResult,
      auditMatchModelName: evaluation.auditMatchModelName,
      auditMatchRuleType: evaluation.auditMatchRuleType,
      auditReferenceDepositFee: evaluation.auditReferenceDepositFee ?? null,
      auditReferenceAccumulationFee: evaluation.auditReferenceAccumulationFee ?? null,
      auditReason: evaluation.auditReason,

      hasTierModel: tier.hasTierModel,
      eligibleTierModel: tier.eligibleTierModel,
      actualInTierModel: tier.actualInTierModel,
      tierPotentialNotUsed: tier.tierPotentialNotUsed,

      issueCategory: evaluation.issueCategory,
      requiredAction: evaluation.requiredAction,
      priority: evaluation.priority,

      raw: row,
    };
  });

  return {
    unifiedRows,
    agreementOptionsByIssuer,
  };
}

export function buildManagementFeesAudit(unifiedRows = []) {
  const issuers = Array.from(
    new Set(unifiedRows.map((row) => row.issuerCanonical || "לא מזוהה"))
  ).sort((a, b) => a.localeCompare(b, "he"));

  const rows = {
    matchModelA: { label: "תקין לפי מודל א" },
    matchModelB: { label: "תקין לפי מודל ב" },
    matchTier: { label: "תקין לפי מודל צבירות / מדרגה" },
    matchAccumulationFee: { label: "תקין לפי מצבירה מאושרת" },
    baselineNoAgreement: { label: "תקין לפי כלל בסיס ללא הסדר" },
    invalid: { label: "ד.נ תקולים" },
    total: { label: "סה״כ נבדקו" },
    compliance: { label: "אחוז ד.נ תקין" },
  };

  Object.keys(rows).forEach((key) => {
    issuers.forEach((issuer) => {
      rows[key][issuer] = 0;
    });
  });

  unifiedRows.forEach((row) => {
    const issuer = row.issuerCanonical || "לא מזוהה";

    if (row.auditStatus === "valid") {
      if (row.auditMatchRuleType === "WITHOUT_AGREEMENT") {
        rows.baselineNoAgreement[issuer] += 1;
      } else if (row.auditMatchRuleType === "ACCUMULATION_FEE_ONLY") {
        rows.matchAccumulationFee[issuer] += 1;
      } else if (/ב|B/i.test(row.auditMatchModelName || "")) {
        rows.matchModelB[issuer] += 1;
      } else if (/צביר|מדרג|MIN_ACCUMULATION|MAX_ACCUMULATION/.test(
        `${row.auditMatchModelName || ""} ${row.auditMatchRuleType || ""}`
      )) {
        rows.matchTier[issuer] += 1;
      } else {
        rows.matchModelA[issuer] += 1;
      }
    }

    if (row.auditStatus === "invalid") {
      rows.invalid[issuer] += 1;
    }

    rows.total[issuer] += 1;
  });

  issuers.forEach((issuer) => {
    const valid =
      rows.matchModelA[issuer] +
      rows.matchModelB[issuer] +
      rows.matchTier[issuer] +
      rows.matchAccumulationFee[issuer] +
      rows.baselineNoAgreement[issuer];

    const total = rows.total[issuer];

    rows.compliance[issuer] = total ? valid / total : 0;
  });

  return {
    issuers,
    rows: Object.values(rows),
  };
}

export function buildActionDrilldown(unifiedRows = []) {
  return unifiedRows.filter((row) => row.issueCategory && row.issueCategory !== "NONE");
}

export function buildAccumulationTierAnalysis(unifiedRows = []) {
  const buckets = [
    { key: "0-50K", min: 0, max: 50000 },
    { key: "50K-100K", min: 50000, max: 100000 },
    { key: "100K-300K", min: 100000, max: 300000 },
    { key: "300K-500K", min: 300000, max: 500000 },
    { key: "500K+", min: 500000, max: Infinity },
  ];

  return buckets.map((bucket) => {
    const rows = unifiedRows.filter((row) => {
      const acc = Number(row.accumulation || 0);
      return acc >= bucket.min && acc < bucket.max;
    });

    return {
      bucket: bucket.key,
      clients: rows.length,
      totalAccumulation: rows.reduce((sum, row) => sum + Number(row.accumulation || 0), 0),
      hasTierModel: rows.filter((row) => row.hasTierModel).length,
      eligibleTierModel: rows.filter((row) => row.eligibleTierModel).length,
      actualInTierModel: rows.filter((row) => row.actualInTierModel).length,
      tierPotentialNotUsed: rows.filter((row) => row.tierPotentialNotUsed).length,
    };
  });
}

export function buildInvestmentTrackAccumulation(unifiedRows = []) {
  const result = {};

  const buckets = ["0-50K", "50K-100K", "100K-300K", "300K-500K", "500K+"];

  function bucketFor(value) {
    const acc = Number(value || 0);
    if (acc < 50000) return "0-50K";
    if (acc < 100000) return "50K-100K";
    if (acc < 300000) return "100K-300K";
    if (acc < 500000) return "300K-500K";
    return "500K+";
  }

  unifiedRows.forEach((row) => {
    const track = row.investmentTrack || "מסלול לא צוין";
    const bucket = bucketFor(row.accumulation);

    if (!result[track]) {
      result[track] = { track };
      buckets.forEach((b) => {
        result[track][b] = 0;
      });
      result[track].total = 0;
    }

    result[track][bucket] += 1;
    result[track].total += 1;
  });

  return Object.values(result).sort((a, b) => b.total - a.total);
}
