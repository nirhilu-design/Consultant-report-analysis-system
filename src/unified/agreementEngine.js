// NEW FILE
// Path: src/unified/agreementEngine.js

import {
  canonicalIssuer,
  buildIssuerAliasLookup,
} from "./issuerAliases.js";

import {
  normalizePercent,
  normalizeNumber,
  normalizeText,
} from "./normalizers.js";

function getAgreementIssuer(agreement = {}) {
  return (
    agreement.issuer ||
    agreement.originalManager ||
    agreement.manager ||
    agreement.raw?.issuer ||
    agreement.raw?.["שם יצרן"] ||
    agreement.raw?.["יצרן"] ||
    "לא מזוהה"
  );
}

function detectOptionName(agreement = {}, index = 0) {
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
  if (agreement.conditionType) return agreement.conditionType;

  const text = normalizeText(
    `${agreement.optionName || ""} ${agreement.modelName || ""} ${agreement.raw?.["מודל"] || ""} ${agreement.raw?.["הערות"] || ""}`
  );

  if (/צביר|גבוה|מעל|MIN_ACCUMULATION/.test(text)) {
    return "MIN_ACCUMULATION";
  }

  if (/עד|MAX_ACCUMULATION/.test(text)) {
    return "MAX_ACCUMULATION";
  }

  if (/בחירת|עובד|EMPLOYEE_CHOICE/.test(text)) {
    return "EMPLOYEE_CHOICE";
  }

  return "DEFAULT";
}

function detectConditionValue(agreement = {}) {
  if (
    agreement.conditionValue !== undefined &&
    agreement.conditionValue !== null
  ) {
    return normalizeNumber(agreement.conditionValue);
  }

  const text = normalizeText(
    `${agreement.optionName || ""} ${agreement.modelName || ""} ${agreement.raw?.["מודל"] || ""} ${agreement.raw?.["הערות"] || ""}`
  );

  const match = text.match(/(\d{2,3}(?:,\d{3})+|\d{5,})/);

  return match ? normalizeNumber(match[1]) : null;
}

export function normalizeAgreementOptions({
  agreements = [],
  issuerAliases = {},
} = {}) {
  const aliasLookup = buildIssuerAliasLookup(issuerAliases);
  const optionsByIssuer = {};

  agreements.forEach((agreement, index) => {
    const issuer = canonicalIssuer(
      getAgreementIssuer(agreement),
      aliasLookup
    );

    const conditionType = detectConditionType(agreement);

    const option = {
      issuer,
      optionName: detectOptionName(agreement, index),
      depositFee: normalizePercent(
        agreement.depositFee ?? agreement.premiumFee
      ),
      accumulationFee: normalizePercent(
        agreement.accumulationFee ?? agreement.assetFee
      ),
      conditionType,
      conditionValue: detectConditionValue(agreement),
      isDefault:
        Boolean(agreement.isDefault) ||
        conditionType === "DEFAULT",
      raw: agreement,
    };

    if (!optionsByIssuer[issuer]) {
      optionsByIssuer[issuer] = [];
    }

    optionsByIssuer[issuer].push(option);
  });

  return {
    optionsByIssuer,
    aliasLookup,
  };
}

export function isEligibleOption(option, accumulation) {
  const acc = Number(accumulation || 0);

  if (option.conditionType === "MIN_ACCUMULATION") {
    return option.conditionValue === null
      ? true
      : acc >= option.conditionValue;
  }

  if (option.conditionType === "MAX_ACCUMULATION") {
    return option.conditionValue === null
      ? true
      : acc <= option.conditionValue;
  }

  return true;
}
