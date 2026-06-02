// NEW FILE
// Path: src/unified/rawToUnifiedRows.js

import {
  DEFAULT_BROKER,
  PRODUCT_TYPES,
  getProductConfig,
  createEmptyUnifiedRow,
  ensureUnifiedRow,
} from "./unifiedSchema.js";

import {
  buildIssuerAliasLookup,
  canonicalIssuer,
} from "./issuerAliases.js";

import {
  normalizeText,
  normalizeNumber,
  normalizePercent,
  normalizeTrackName,
  getRaw,
  getByKeys,
  firstNonEmpty,
  ageBucket,
  accumulationBucket,
} from "./normalizers.js";

function getClientId(row) {
  const raw = getRaw(row);

  return normalizeText(
    firstNonEmpty(
      row.clientId,
      row.employeeCode,
      row.employeeId,
      getByKeys(raw, [
        "קוד מזהה של העובד",
        "תעודת זהות",
        "ת.ז",
        "מספר זהות",
        "מספר עובד",
      ])
    )
  );
}

function getIssuerOriginal(row) {
  const raw = getRaw(row);

  return normalizeText(
    firstNonEmpty(
      row.originalManager,
      row.manager,
      row.issuer,
      row.company,
      getByKeys(raw, [
        "קרן פנסיה",
        "חברת ביטוח",
        "שם יצרן",
        "יצרן",
        "שם קופה",
      ])
    )
  );
}

function getClientName(row) {
  const raw = getRaw(row);

  return normalizeText(
    firstNonEmpty(
      row.clientName,
      row.personal_fullName,
      [row.personal_firstName, row.personal_lastName].filter(Boolean).join(" "),
      getByKeys(raw, [
        "שם עובד",
        "שם הלקוח",
        "שם לקוח",
        "שם מלא",
      ])
    )
  );
}

function getServiceStatus(row) {
  const raw = getRaw(row);

  return normalizeText(
    firstNonEmpty(
      row.serviceStatus,
      row.marketingStatus,
      row.personal_marketingStatus,
      getByKeys(raw, [
        "סטטוס שיווקי",
        "סטטוס לקוח",
        "סוג שירות",
        "סטטוס טיפול",
        "האם מנהל ההסדר  סוכן בפוליסה",
        "האם מנהל ההסדר סוכן בפוליסה",
        "בטיפול סוכן",
      ])
    )
  );
}

function getFundName(row) {
  const raw = getRaw(row);

  return normalizeText(
    firstNonEmpty(
      row.fundName,
      getByKeys(raw, [
        "שם קרן הפנסיה",
        "שם קופה",
        "שם מוצר",
        "שם תוכנית",
      ])
    )
  );
}

function getPolicyNumber(row) {
  const raw = getRaw(row);

  return normalizeText(
    firstNonEmpty(
      row.policyNumber,
      getByKeys(raw, [
        "מספר פוליסה",
        "מספר חשבון",
        "מספר עמית",
        "מספר קופה",
      ])
    )
  );
}

function getInsuranceTrack(row) {
  const raw = getRaw(row);

  return (
    normalizeText(
      firstNonEmpty(
        row.insuranceTrack,
        row.insuranceWaiver,
        getByKeys(raw, [
          "מסלול ביטוח בקרן הפנסיה",
          "מסלול ביטוח",
          "כיסוי שארים",
          "ויתור שארים",
        ])
      )
    ) || "מסלול ביטוח לא צוין"
  );
}

function getInvestmentTrackRewards(row) {
  const raw = getRaw(row);

  const explicitValue = firstNonEmpty(
    row.investmentTrackRewards,
    getByKeys(raw, [
      "שם מסלול השקעה - תגמולים",
      " שם מסלול השקעה - תגמולים",
      "מסלול השקעה תגמולים",
      "מסלול תגמולים",
      "שם מסלול תגמולים",
    ])
  );

  return normalizeTrackName(explicitValue, "ללא מסלול השקעה");
}

function getInvestmentTrackCompensation(row) {
  const raw = getRaw(row);

  const explicitValue = firstNonEmpty(
    row.investmentTrackCompensation,
    getByKeys(raw, [
      "שם מסלול השקעה - פיצויים",
      "מסלול השקעה פיצויים",
      "מסלול פיצויים",
      "שם מסלול פיצויים",
    ])
  );

  return normalizeTrackName(explicitValue, "ללא מסלול השקעה");
}

function getAccumulation(row) {
  const raw = getRaw(row);

  // Prefer the original redemption/accumulation columns from the consultant report.
  // Earlier versions preferred row.accumulation, but the parser could accidentally
  // populate it from a fee column because headers contain the word "צבירה".
  const explicitAccumulation = getByKeys(raw, [
    'סה"כ ערכי פידיון',
    "סה״כ ערכי פידיון",
    "סהכ ערכי פידיון",
    "סך הכל ערכי פידיון",
    "ערך פדיון כולל",
    "ערך פדיון כולל ",
    "ערך פדיון כולל ",
    "צבירה",
    "יתרה",
  ]);

  return normalizeNumber(
    firstNonEmpty(
      explicitAccumulation,
      row.accumulation
    )
  );
}

function getDepositFee(row) {
  const raw = getRaw(row);

  return normalizePercent(
    firstNonEmpty(
      row.depositFee,
      getByKeys(raw, [
        "דמי ניהול מפרמיה באחוזים",
        "דמי ניהול מהפקדה",
        "דמי ניהול מהפקדות",
        "מהפקדה",
      ])
    )
  );
}

function getAccumulationFee(row) {
  const raw = getRaw(row);

  return normalizePercent(
    firstNonEmpty(
      row.accumulationFee,
      getByKeys(raw, [
        "דמי ניהול מצבירה באחוזים",
        "דמי ניהול מצבירה",
        "מצבירה",
      ])
    )
  );
}

function isOperationOnly(serviceStatus) {
  const text = normalizeText(serviceStatus).toLowerCase();
  return /תפעול בלבד|ללא שיווק/.test(text) || text === "לא" || text === "no" || text === "false" || text === "0";
}

function isArrangementAgentNo(value) {
  const text = normalizeText(value).toLowerCase();
  return text === "לא" || text === "no" || text === "false" || text === "0";
}

function getArrangementAgentStatus(row) {
  const raw = getRaw(row);

  return normalizeText(
    firstNonEmpty(
      row.isArrangementAgent,
      getByKeys(raw, [
        "האם מנהל ההסדר  סוכן בפוליסה",
        "האם מנהל ההסדר סוכן בפוליסה",
        "האם מנהל הסדר סוכן בפוליסה",
        "מנהל ההסדר סוכן בפוליסה",
        "בטיפול סוכן",
        "האם בטיפול סוכן",
      ])
    )
  );
}

function isVeteranPensionFund(row) {
  const raw = getRaw(row);
  const text = normalizeText(
    [
      row.planType,
      row.fundName,
      row.issuerOriginal,
      getByKeys(raw, ["סוג תוכנית פנסיה", "סוג תוכנית", "סוג תכנית", "שם קרן הפנסיה", "קרן פנסיה"]),
    ]
      .filter(Boolean)
      .join(" ")
  );

  return text.includes("ותיק") || text.includes("ותיקה");
}

function personalByClientId(personalRows = []) {
  const map = new Map();

  personalRows.forEach((row) => {
    const raw = getRaw(row);

    const clientId = normalizeText(
      firstNonEmpty(
        row.clientId,
        getByKeys(raw, [
          "קוד מזהה של העובד",
          "תעודת זהות",
          "ת.ז",
          "מספר זהות",
          "מספר עובד",
        ])
      )
    );

    if (!clientId) return;

    map.set(clientId, row);
  });

  return map;
}

function getPersonalFields(personalRow) {
  if (!personalRow) {
    return {
      age: null,
      maritalStatus: "לא צוין",
      gender: "",
      childrenCount: null,
      personalDetailsFound: false,
    };
  }

  const raw = getRaw(personalRow);

  const age = normalizeNumber(
    firstNonEmpty(
      personalRow.personal_age,
      personalRow.age,
      getByKeys(raw, ["גיל מחושב", "גיל"])
    )
  );

  const maritalStatus = normalizeText(
    firstNonEmpty(
      personalRow.personal_maritalStatus,
      personalRow.maritalStatus,
      getByKeys(raw, ["מצב משפחתי", "סטטוס משפחתי"])
    )
  ) || "לא צוין";

  const gender = normalizeText(
    firstNonEmpty(
      personalRow.personal_gender,
      personalRow.gender,
      getByKeys(raw, ["מין", "מגדר"])
    )
  ) || "";

  const childrenCount = normalizeNumber(
    firstNonEmpty(
      personalRow.personal_childrenCount,
      personalRow.childrenCount,
      getByKeys(raw, ["מספר ילדים", "ילדים"])
    )
  );

  return {
    age,
    maritalStatus,
    gender,
    childrenCount,
    personalDetailsFound: Boolean(
      personalRow.personalMatched || personalRow.personal_age || personalRow.personal_maritalStatus || personalRow.employeeJoinKey
    ),
  };
}

export function buildBaseUnifiedRows({
  rows = [],
  personalRows = [],
  broker = DEFAULT_BROKER,
  productType = PRODUCT_TYPES.PENSION,
  issuerAliases = {},
  aliases = null,
} = {}) {
  const config = getProductConfig(productType);
  const aliasLookup = buildIssuerAliasLookup(aliases || issuerAliases);
  const personalMap = personalByClientId(personalRows);

  return rows.map((sourceRow, index) => {
    const clientId = getClientId(sourceRow);
    const personalSource = personalMap.get(clientId) || sourceRow;
    const personal = getPersonalFields(personalSource);

    const issuerOriginal = getIssuerOriginal(sourceRow);
    const issuerCanonical = canonicalIssuer(issuerOriginal, aliasLookup);

    const serviceStatus = getServiceStatus(sourceRow);
    const arrangementAgentStatus = getArrangementAgentStatus(sourceRow);
    const veteranPensionFund = productType === PRODUCT_TYPES.PENSION && isVeteranPensionFund(sourceRow);
    const raw = getRaw(sourceRow);
    const sourceAuditStatus = normalizeText(getByKeys(raw, ["סטטוס", "סטטוס2"]));

    // V80: בקרן פנסיה "מתפעל בלבד" לא נקבע לפי עמודת סטטוס או לפי דמי ניהול.
    // הקביעה נעשית לפי העמודה המדויקת "האם מנהל ההסדר  סוכן בפוליסה":
    // אם הערך "לא" => תפעול בלבד. קרן ותיקה מוחרגת תמיד.
    const operationOnlyByArrangementAgent = isArrangementAgentNo(arrangementAgentStatus);

    const excluded =
      config.excludeOperationOnlyFromFeeAudit &&
      (operationOnlyByArrangementAgent || veteranPensionFund);

    const accumulation = getAccumulation(sourceRow);

    return ensureUnifiedRow({
      ...createEmptyUnifiedRow(),

      brokerId: broker.brokerId || DEFAULT_BROKER.brokerId,
      brokerName: broker.brokerName || DEFAULT_BROKER.brokerName,
      batchId: broker.batchId || "",
      productType,

      sourceRowNumber: index + 1,
      sourceSheetName: sourceRow.sheetName || "",
      sourceFileName: sourceRow.sourceFileName || "",

      clientId,
      employeeCode: sourceRow.employeeCode || clientId,
      clientName: getClientName(sourceRow),
      personal_fullName: sourceRow.personal_fullName || getClientName(sourceRow),
      personal_age: sourceRow.personal_age ?? personal.age,
      personal_maritalStatus: sourceRow.personal_maritalStatus || personal.maritalStatus,
      personal_gender: sourceRow.personal_gender || personal.gender,
      personal_childrenCount: sourceRow.personal_childrenCount ?? personal.childrenCount,
      personalMatched: Boolean(sourceRow.personalMatched || personal.personalDetailsFound),

      serviceStatus,
      arrangementAgentStatus,
      sourceAuditStatus,
      age: personal.age,
      ageBucket: ageBucket(personal.age),
      maritalStatus: personal.maritalStatus,
      gender: personal.gender,
      childrenCount: personal.childrenCount,
      personalDetailsFound: personal.personalDetailsFound,

      issuerOriginal,
      issuerCanonical,
      arrangementManager:
        sourceRow.arrangementManager ||
        sourceRow.arrangementManagerName ||
        sourceRow.personal_arrangementManagerName ||
        personal.arrangementManagerName ||
        "",
      arrangementManagerName:
        sourceRow.arrangementManagerName ||
        sourceRow.arrangementManager ||
        sourceRow.personal_arrangementManagerName ||
        personal.arrangementManagerName ||
        "",
      personal_arrangementManagerName:
        sourceRow.personal_arrangementManagerName ||
        personal.arrangementManagerName ||
        sourceRow.arrangementManagerName ||
        sourceRow.arrangementManager ||
        "",

      policyNumber: getPolicyNumber(sourceRow),
      fundName: getFundName(sourceRow),

      insuranceTrack: config.hasInsuranceTrack
        ? getInsuranceTrack(sourceRow)
        : "לא רלוונטי",

      investmentTrackRewards: config.hasRewardsTrack
        ? getInvestmentTrackRewards(sourceRow)
        : "לא רלוונטי",

      investmentTrackCompensation: config.hasCompensationTrack
        ? getInvestmentTrackCompensation(sourceRow)
        : "לא רלוונטי",

      accumulation,
      accumulationBucket: accumulationBucket(accumulation),

      depositFee: config.hasDepositFee
        ? getDepositFee(sourceRow)
        : null,

      accumulationFee: config.hasAccumulationFee
        ? getAccumulationFee(sourceRow)
        : null,

      depositFeeAgreement: normalizePercent(sourceRow.depositFeeAgreement),
      accumulationFeeAgreement: normalizePercent(sourceRow.accumulationFeeAgreement),
      isOperationOnly: Boolean(excluded),
      isExcludedFromFeeAudit: Boolean(excluded),

      auditStatus: excluded ? "excluded" : "",
      auditStatusHe: excluded ? "תפעול בלבד" : "",
      auditReason: excluded
        ? (veteranPensionFund
            ? "קרן פנסיה ותיקה — לא נכללת בבדיקת דמי ניהול"
            : "מתפעל בלבד — בעמודת האם מנהל ההסדר סוכן בפוליסה מופיע לא")
        : "",

      raw: sourceRow,
    });
  });
}
