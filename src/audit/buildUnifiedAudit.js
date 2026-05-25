// REPLACE EXISTING FILE
// Path: src/audit/buildUnifiedAudit.js

import { PRODUCT_TYPES, getProductConfig } from "../config/productConfigs";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .replace(/[^\w\u0590-\u05FF\s/+.-]/g, "")
    .trim();
}

function normalizePercent(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return value > 1 ? value : value * 100;
  }

  const raw = String(value).replace("%", "").replace(",", ".").trim();
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) return null;

  return parsed > 1 ? parsed : parsed * 100;
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

function getRaw(policy) {
  return policy?.raw?.raw || policy?.raw || {};
}

function getByKeys(raw, keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && normalizeText(raw[key])) {
      return raw[key];
    }
  }

  return "";
}

function getPolicyIssuer(policy = {}) {
  return (
    policy.originalManager ||
    policy.manager ||
    policy.issuer ||
    policy.company ||
    getByKeys(getRaw(policy), [
      "קרן פנסיה",
      "חברת ביטוח",
      "שם יצרן",
      "יצרן",
      "שם קופה",
    ]) ||
    "לא מזוהה"
  );
}

function getPolicyClientId(policy = {}) {
  return (
    policy.clientId ||
    policy.employeeId ||
    getByKeys(getRaw(policy), [
      "קוד מזהה של העובד",
      "תעודת זהות",
      "ת.ז",
      "מספר זהות",
      "מספר עובד",
    ]) ||
    ""
  );
}

function getPolicyInvestmentTrack(policy = {}) {
  return (
    policy.investmentTrack ||
    policy.track ||
    getByKeys(getRaw(policy), [
      "שם מסלול השקעה - תגמולים",
      " שם מסלול השקעה - תגמולים",
      "מסלול השקעה",
      "שם מסלול",
    ]) ||
    "מסלול לא צוין"
  );
}

function getPolicyInsuranceTrack(policy = {}) {
  return (
    policy.insuranceTrack ||
    policy.insuranceWaiver ||
    getByKeys(getRaw(policy), [
      "מסלול ביטוח בקרן הפנסיה",
      "מסלול ביטוח",
      "כיסוי שארים",
      "ויתור שארים",
    ]) ||
    "מסלול ביטוח לא צוין"
  );
}

function getPolicyAccumulation(policy = {}) {
  return normalizeNumber(
    policy.accumulation ??
      getByKeys(getRaw(policy), [
        "סה\"כ ערכי פידיון",
        "סה״כ ערכי פידיון",
        "ערך פדיון כולל",
        "ערך פדיון כולל ",
        "ערך פדיון כולל ",
        "צבירה",
        "יתרה",
      ])
  );
}

function getPolicyDepositFee(policy = {}) {
  return normalizePercent(
    policy.depositFee ??
      getByKeys(getRaw(policy), [
        "דמי ניהול מפרמיה באחוזים",
        "דמי ניהול מהפקדה",
        "דמי ניהול מהפקדות",
        "מהפקדה",
      ])
  );
}

function getPolicyAccumulationFee(policy = {}) {
  return normalizePercent(
    policy.accumulationFee ??
      getByKeys(getRaw(policy), [
        "דמי ניהול מצבירה באחוזים",
        "דמי ניהול מצבירה",
        "מצבירה",
      ])
  );
}

function getAgreementIssuer(agreement = {}) {
  return agreement.issuer || agreement.originalManager || agreement.manager || "לא מזוהה";
}

function normalizeAgreementOptions(agreements = [], aliasLookup) {
  const map = {};

  agreements.forEach((agreement, index) => {
    const issuer = canonicalIssuer(getAgreementIssuer(agreement), aliasLookup);

    const option = {
      issuer,
      optionName: agreement.optionName || agreement.modelName || `מודל ${index + 1}`,
      depositFee: normalizePercent(agreement.depositFee ?? agreement.premiumFee),
      accumulationFee: normalizePercent(agreement.accumulationFee ?? agreement.assetFee),
      conditionType: agreement.conditionType || "DEFAULT",
      conditionValue: normalizeNumber(agreement.conditionValue),
      isDefault: Boolean(agreement.isDefault) || (agreement.conditionType || "DEFAULT") === "DEFAULT",
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

function optionMatchesFull(policy, option, config) {
  const checks = [];

  if (config.hasDepositFee && policy.depositFee !== null && option.depositFee !== null) {
    checks.push(policy.depositFee <= option.depositFee);
  }

  if (config.hasAccumulationFee && policy.accumulationFee !== null && option.accumulationFee !== null) {
    checks.push(policy.accumulationFee <= option.accumulationFee);
  }

  return checks.length > 0 && checks.every(Boolean);
}

function optionMatchesAccumulationOnly(policy, option, config) {
  if (!config.hasAccumulationFee) return false;
  if (policy.accumulationFee === null || option.accumulationFee === null) return false;

  return policy.accumulationFee <= option.accumulationFee;
}

function evaluatePolicy({ policy, options, config }) {
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

    const pass = depositOk && accumulationOk;

    return {
      agreementIssuerFound: false,
      auditStatus: pass ? "valid" : "invalid",
      auditStatusHe: pass ? "תקין" : "חריג",
      auditMatchResult: pass ? "BASELINE_NO_AGREEMENT" : "BASELINE_FAILURE",
      auditMatchModelName: "כלל בסיס ללא הסכם",
      auditMatchRuleType: "WITHOUT_AGREEMENT",
      auditReason: pass
        ? "אין הסכם, אך דמי הניהול עומדים בכלל הבסיס"
        : "אין הסכם ודמי הניהול חורגים מכלל הבסיס",
      issueCategory: pass ? "NONE" : "MISSING_AGREEMENT",
      requiredAction: pass ? "" : "להשלים/לעדכן הסכם דמי ניהול ליצרן",
      priority: pass ? "" : "HIGH",
    };
  }

  // Important: we check all approved options, not only default/tier eligible.
  // That is the rule we agreed on for option A/B/accumulation-fee approval.
  const fullMatch = options.find((option) =>
    optionMatchesFull(policy, option, config)
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
    };
  }

  const accumulationOnlyMatch = options.find((option) =>
    optionMatchesAccumulationOnly(policy, option, config)
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
    };
  }

  const reference = options[0];

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
  };
}

function detectTierFlags(options = [], policy) {
  const tierOptions = options.filter((option) =>
    ["MIN_ACCUMULATION", "MAX_ACCUMULATION"].includes(option.conditionType)
  );

  const eligibleTierOptions = tierOptions.filter((option) =>
    isEligibleOption(option, policy.accumulation)
  );

  const actualInTierModel = eligibleTierOptions.some((option) =>
    optionMatchesAccumulationOnly(policy, option, {
      hasAccumulationFee: true,
      hasDepositFee: true,
    })
  );

  return {
    hasTierModel: tierOptions.length > 0,
    eligibleTierModel: eligibleTierOptions.length > 0,
    actualInTierModel,
    tierPotentialNotUsed: eligibleTierOptions.length > 0 && !actualInTierModel,
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

    const options = agreementOptionsByIssuer[issuerCanonical] || [];
    const evaluation = evaluatePolicy({ policy, options, config });
    const tier = detectTierFlags(options, policy);

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
      agreementOptionsCount: options.length,
      agreementOptions: options,

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
  return {
    issuers: [],
    rows: [],
  };
}

export function buildActionDrilldown(unifiedRows = []) {
  return unifiedRows.filter((row) => row.issueCategory && row.issueCategory !== "NONE");
}

export function buildAccumulationTierAnalysis(unifiedRows = []) {
  return [];
}

export function buildInvestmentTrackAccumulation(unifiedRows = []) {
  return [];
}
