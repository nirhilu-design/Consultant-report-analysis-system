import {
  createUnifiedRow,
  PRODUCT_TYPES,
} from "./unifiedSchema.js";

import {
  normalizeIssuerName,
} from "./issuerAliases.js";

export function normalizePensionRow(rawRow = {}) {
  return createUnifiedRow({
    productType: PRODUCT_TYPES.PENSION,

    issuerOriginal: getIssuer(rawRow),

    issuerCanonical: normalizeIssuerName(
      getIssuer(rawRow)
    ),

    clientId: getValue(rawRow, [
      "clientId",
      "id",
      "תעודת זהות",
    ]),

    employeeId: getValue(rawRow, [
      "employeeId",
      "מספר עובד",
    ]),

    fullName: getValue(rawRow, [
      "fullName",
      "שם עובד",
      "שם מלא",
    ]),

    policyNumber: getValue(rawRow, [
      "policyNumber",
      "policy",
      "מספר פוליסה",
    ]),

    accumulation: normalizeNumber(
      getValue(rawRow, [
        "accumulation",
        "balance",
        "צבירה",
      ])
    ),

    monthlyDeposit: normalizeNumber(
      getValue(rawRow, [
        "monthlyDeposit",
        "deposit",
        "הפקדה חודשית",
      ])
    ),

    accumulationFee: normalizeNumber(
      getValue(rawRow, [
        "accumulationFee",
        "דמי ניהול מצבירה",
      ])
    ),

    depositFee: normalizeNumber(
      getValue(rawRow, [
        "depositFee",
        "דמי ניהול מהפקדה",
      ])
    ),

    investmentTrackRewards:
      normalizeTrackName(
        getValue(rawRow, [
          "investmentTrackRewards",
          "מסלול תגמולים",
        ])
      ),

    investmentTrackCompensation:
      normalizeTrackName(
        getValue(rawRow, [
          "investmentTrackCompensation",
          "מסלול פיצויים",
        ])
      ),

    insuranceTrack: getValue(rawRow, [
      "insuranceTrack",
      "מסלול ביטוח",
    ]),

    maritalStatus: getValue(rawRow, [
      "maritalStatus",
      "מצב משפחתי",
    ]),

    age: normalizeNumber(
      getValue(rawRow, [
        "age",
        "גיל",
      ])
    ),

    gender: getValue(rawRow, [
      "gender",
      "מין",
    ]),

    childrenCount: normalizeNumber(
      getValue(rawRow, [
        "childrenCount",
        "מספר ילדים",
      ])
    ),

    raw: rawRow,
  });
}

export function normalizeHishtalmutRow(
  rawRow = {}
) {
  return createUnifiedRow({
    productType: PRODUCT_TYPES.HISHTALMUT,

    issuerOriginal: getIssuer(rawRow),

    issuerCanonical: normalizeIssuerName(
      getIssuer(rawRow)
    ),

    clientId: getValue(rawRow, [
      "clientId",
      "id",
      "תעודת זהות",
    ]),

    employeeId: getValue(rawRow, [
      "employeeId",
      "מספר עובד",
    ]),

    fullName: getValue(rawRow, [
      "fullName",
      "שם עובד",
      "שם מלא",
    ]),

    policyNumber: getValue(rawRow, [
      "policyNumber",
      "policy",
      "מספר פוליסה",
    ]),

    accumulation: normalizeNumber(
      getValue(rawRow, [
        "accumulation",
        "balance",
        "צבירה",
      ])
    ),

    monthlyDeposit: normalizeNumber(
      getValue(rawRow, [
        "monthlyDeposit",
        "deposit",
        "הפקדה חודשית",
      ])
    ),

    accumulationFee: normalizeNumber(
      getValue(rawRow, [
        "accumulationFee",
        "דמי ניהול מצבירה",
      ])
    ),

    depositFee: null,

    investmentTrackRewards:
      normalizeTrackName(
        getValue(rawRow, [
          "investmentTrack",
          "מסלול השקעה",
        ])
      ),

    investmentTrackCompensation: null,

    insuranceTrack: null,

    maritalStatus: getValue(rawRow, [
      "maritalStatus",
      "מצב משפחתי",
    ]),

    age: normalizeNumber(
      getValue(rawRow, [
        "age",
        "גיל",
      ])
    ),

    gender: getValue(rawRow, [
      "gender",
      "מין",
    ]),

    childrenCount: normalizeNumber(
      getValue(rawRow, [
        "childrenCount",
        "מספר ילדים",
      ])
    ),

    raw: rawRow,
  });
}

function getIssuer(row) {
  return (
    row.issuer ||
    row.company ||
    row.יצרן ||
    ""
  );
}

function getValue(row, keys = []) {
  for (const key of keys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      row[key] !== ""
    ) {
      return row[key];
    }
  }

  return "";
}

function normalizeTrackName(trackName) {
  if (!trackName) {
    return "ללא מסלול השקעה";
  }

  const cleaned = String(trackName).trim();

  if (/^\d+$/.test(cleaned)) {
    return "ללא מסלול השקעה";
  }

  return cleaned;
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

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}
