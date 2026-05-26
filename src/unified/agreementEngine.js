// Path: src/unified/agreementEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// AGREEMENT ENGINE — נרמול הסכמי דמי ניהול לפורמט אחיד
//
// קלט:  agreements[] — פלט של agreementsParser
// פלט:  agreementOptionsByIssuer — Map: שם יצרן קנוני → [options]
//
// כל option:
//   { issuer, optionName, depositFee, accumulationFee, conditionType, conditionValue }
// ─────────────────────────────────────────────────────────────────────────────

import { buildIssuerAliasLookup, canonicalIssuer } from "./issuerAliases.js";
import { normalizePercent } from "./normalizers.js";

function normalizeConditionType(agreement) {
  if (agreement.conditionType) return agreement.conditionType;

  const text = String(agreement.optionName || "").toLowerCase();
  if (/צביר|גבוה|min_accumulation/.test(text)) return "MIN_ACCUMULATION";
  if (/עד|max_accumulation/.test(text))         return "MAX_ACCUMULATION";
  return "DEFAULT";
}

export function normalizeAgreementOptions({ agreements = [], issuerAliases = {} } = {}) {
  const aliasLookup = buildIssuerAliasLookup(issuerAliases);
  const optionsByIssuer = {};

  for (const agreement of agreements) {
    const issuerRaw = agreement.issuer || agreement.issuerOriginal || "";
    const issuer    = canonicalIssuer(issuerRaw, aliasLookup);

    const option = {
      issuer,
      optionName:      agreement.optionName || "מודל א",
      depositFee:      normalizePercent(agreement.depositFee),
      accumulationFee: normalizePercent(agreement.accumulationFee),
      conditionType:   normalizeConditionType(agreement),
      conditionValue:  agreement.conditionValue ?? null,
      isDefault:       Boolean(agreement.isDefault) || agreement.conditionType === "DEFAULT" || !agreement.conditionType,
    };

    if (!optionsByIssuer[issuer]) optionsByIssuer[issuer] = [];
    optionsByIssuer[issuer].push(option);
  }

  console.log("normalizeAgreementOptions:", {
    issuers: Object.keys(optionsByIssuer),
    counts:  Object.fromEntries(
      Object.entries(optionsByIssuer).map(([k, v]) => [k, v.length])
    ),
  });

  return { optionsByIssuer, aliasLookup };
}
