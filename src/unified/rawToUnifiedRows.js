import { normalizeIssuerName } from "./issuerAliases.js";

export function rawToUnifiedRows({
  pensionRows = [],
  hishtalmutRows = [],
  brokerId = "",
  brokerName = "",
  batchId = "",
}) {
  const unifiedRows = [];

  pensionRows.forEach((row) => {
    unifiedRows.push(
      buildPensionUnifiedRow({
        row,
        brokerId,
        brokerName,
        batchId,
      })
    );
  });

  hishtalmutRows.forEach((row) => {
    unifiedRows.push(
      buildHishtalmutUnifiedRow({
        row,
        brokerId,
        brokerName,
        batchId,
      })
    );
  });

  return unifiedRows;
}

function buildPensionUnifiedRow({
  row,
  brokerId,
  brokerName,
  batchId,
}) {
  const issuerCanonical = normalizeIssuerName(
    row.issuer || row.company || row.יצרן
  );

  return {
    brokerId,
    brokerName,
    batchId,

    sourceType: "consultant_report",

    productType: "pension",

    issuerOriginal:
      row.issuer || row.company || row.יצרן || "",

    issuerCanonical,

    clientId:
      row.clientId ||
      row.id ||
      row["תעודת זהות"] ||
      "",

    employeeId:
      row.employeeId ||
      row["מספר עובד"] ||
      "",

    fullName:
      row.fullName ||
      row["שם עובד"] ||
      row["שם מלא"] ||
      "",

    policyNumber:
      row.policyNumber ||
      row.policy ||
      row["מספר פוליסה"] ||
      "",

    accumulation: normalizeNumber(
      row.accumulation ||
        row.balance ||
        row["צבירה"]
    ),

    monthlyDeposit: normalizeNumber(
      row.monthlyDeposit ||
        row.deposit ||
        row["הפקדה חודשית"]
    ),

    accumulationFee: normalizeNumber(
      row.accumulationFee ||
        row["דמי ניהול מצבירה"]
    ),

    depositFee: normalizeNumber(
      row.depositFee ||
        row["דמי ניהול מהפקדה"]
    ),

    investmentTrackRewards:
      normalizeTrackName(
        row.investmentTrackRewards ||
          row["מסלול תגמולים"]
      ),

    investmentTrackCompensation:
      normalizeTrackName(
        row.investmentTrackCompensation ||
          row["מסלול פיצויים"]
      ),

    insuranceTrack:
      row.insuranceTrack ||
      row["מסלול ביטוח"] ||
      "ללא מסלול ביטוח",

    maritalStatus:
      row.maritalStatus ||
      row["מצב משפחתי"] ||
      "",

    age: normalizeNumber(
      row.age || row["גיל"]
    ),

    gender:
      row.gender || row["מין"] || "",

    childrenCount: normalizeNumber(
      row.childrenCount ||
        row["מספר ילדים"]
    ),

    auditStatus: null,
    auditReason: null,
    auditModel: null,
  };
}

function buildHishtalmutUnifiedRow({
  row,
  brokerId,
  brokerName,
  batchId,
}) {
  const issuerCanonical = normalizeIssuerName(
    row.issuer || row.company || row.יצרן
  );

  return {
    brokerId,
    brokerName,
    batchId,

    sourceType: "consultant_report",

    productType: "hishtalmut",

    issuerOriginal:
      row.issuer || row.company || row.יצרן || "",

    issuerCanonical,

    clientId:
      row.clientId ||
      row.id ||
      row["תעודת זהות"] ||
      "",

    employeeId:
      row.employeeId ||
      row["מספר עובד"] ||
      "",

    fullName:
      row.fullName ||
      row["שם עובד"] ||
      row["שם מלא"] ||
      "",

    policyNumber:
      row.policyNumber ||
      row.policy ||
      row["מספר פוליסה"] ||
      "",

    accumulation: normalizeNumber(
      row.accumulation ||
        row.balance ||
        row["צבירה"]
    ),

    monthlyDeposit: normalizeNumber(
      row.monthlyDeposit ||
        row.deposit ||
        row["הפקדה חודשית"]
    ),

    accumulationFee: normalizeNumber(
      row.accumulationFee ||
        row["דמי ניהול מצבירה"]
    ),

    depositFee: null,

    investmentTrackRewards:
      normalizeTrackName(
        row.investmentTrack ||
          row["מסלול השקעה"]
      ),

    investmentTrackCompensation: null,

    insuranceTrack: null,

    maritalStatus:
      row.maritalStatus ||
      row["מצב משפחתי"] ||
      "",

    age: normalizeNumber(
      row.age || row["גיל"]
    ),

    gender:
      row.gender || row["מין"] || "",

    childrenCount: normalizeNumber(
      row.childrenCount ||
        row["מספר ילדים"]
    ),

    auditStatus: null,
    auditReason: null,
    auditModel: null,
  };
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

  const numberValue = Number(normalized);

  return Number.isNaN(numberValue)
    ? 0
    : numberValue;
}
