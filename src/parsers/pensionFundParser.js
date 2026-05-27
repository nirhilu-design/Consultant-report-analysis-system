// Path: src/parsers/pensionFundParser.js
// ─────────────────────────────────────────────────────────────────────────────
// PENSION FUND PARSER — קריאה ונרמול קובץ פנסיה מדוח מנהל הסדר
//
// Stability 04:
//   1. הגנות סביב workbook / SheetNames / Sheets
//   2. הגנות סביב sheet_to_json כדי שקובץ Excel פגום לא יפיל את האפליקציה
//   3. הגנות על row שאינו Array
//   4. שמירה על אותו schema עסקי קיים — בלי שינוי UX ובלי שינוי Audit
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

const COL = {
  employeeCode: 0,
  idNumber: 1,
  firstName: 2,
  lastName: 3,
  marketingStatus: 4,
  agencyCode: 5,
  arrangementManager: 6,
  policyIdCode: 7,
  policyNumber: 8,
  employerGroupId: 9,
  employerSpecificId: 10,
  issuer: 11,
  planType: 12,
  fundName: 13,
  joinDate: 14,
  insuranceStartDate: 15,
  compensationPct: 16,
  employerRewardsPct: 17,
  employerDisabilityPct: 18,
  employerMiscPct: 19,
  employeeRewardsPct: 20,
  employeeRewards47Pct: 21,
  employeeMiscPct: 22,
  totalDepositPct: 23,
  policyStatus: 24,
  investmentTrackCodeR: 25,
  investmentTrackNameR: 26,
  investmentTrackCodeC: 27,
  investmentTrackNameC: 28,
  insuranceTrack: 29,
  pensionSalary: 30,
  disabilityPensionRate: 31,
  disabilityNote: 32,
  survivorPensionRate: 33,
  survivorNote: 34,
  disabilityAmountILS: 35,
  survivorAmountILS: 36,
  insuranceEndDate: 37,
  survivorWaiver: 38,
  depositFee: 39,
  accumulationFee: 40,
  compensationRedemption: 41,
  depositFeeAgreement: 42,
  accumulationFeeAgreement: 43,
  auditStatus: 44,
  totalAccumulation: 45,
  salaryAgency: 46,
  salaryClearinghouse: 47,
  isArrangementAgent: 48,
  disabilityEndAge: 49,
  policyStatusSource: 50,
  policyStatusClearinghouse: 51,
  validityMonth: 52,
};

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/[^\d.-]/g, "");

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFeePercent(value) {
  const num = normalizeNumber(value);
  if (num === null) return null;
  if (Math.abs(num) > 20) return null;
  if (num !== 0 && Math.abs(num) < 0.1) {
    return Number((num * 100).toFixed(4));
  }
  return Number(num.toFixed(4));
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return normalizeText(value) || null;
}

function getSheetNames(workbook) {
  return Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) return [];

  try {
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn("parsePensionFund: failed reading sheet", {
      sheetName,
      error: error?.message || String(error),
    });
    return [];
  }
}

function getCell(row, index) {
  return Array.isArray(row) ? row[index] : null;
}

function isDataRow(row) {
  if (!Array.isArray(row)) return false;

  const code = getCell(row, COL.employeeCode);
  const issuer = getCell(row, COL.issuer);

  return (
    code !== null &&
    code !== undefined &&
    code !== "" &&
    issuer !== null &&
    issuer !== undefined &&
    normalizeText(issuer) !== ""
  );
}

function isOperationOnly(row) {
  return normalizeText(getCell(row, COL.auditStatus)).includes("תפעול");
}

function getEmployeeCode(row) {
  const raw = getCell(row, COL.employeeCode);
  if (raw === null || raw === undefined) return "";
  return String(typeof raw === "number" ? Math.round(raw) : raw).trim();
}

function getTotalAccumulation(row) {
  const raw = getCell(row, COL.totalAccumulation);
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") return null;
  return normalizeNumber(raw);
}

export function parsePensionFund(workbook) {
  const sheetNames = getSheetNames(workbook);
  if (!sheetNames.length) return [];

  const pensionSheetNames = sheetNames.filter((sheetName) =>
    normalizeText(sheetName).includes("פנסיה")
  );

  if (!pensionSheetNames.length) {
    console.warn("parsePensionFund: no pension sheet was detected", { sheetNames });
    return [];
  }

  const allRows = [];

  pensionSheetNames.forEach((sheetName) => {
    const rows = readSheetRows(workbook, sheetName);
    if (rows.length < 2) return;

    rows.slice(1).forEach((row, idx) => {
      if (!isDataRow(row)) return;

      const operationOnly = isOperationOnly(row);

      allRows.push({
        sheetName,
        sourceRowIndex: idx + 2,
        employeeCode: getEmployeeCode(row),

        issuerOriginal: normalizeText(getCell(row, COL.issuer)),
        manager: normalizeText(getCell(row, COL.issuer)),

        policyNumber: normalizeText(getCell(row, COL.policyNumber)),
        fundName: normalizeText(getCell(row, COL.fundName)),
        planType: normalizeText(getCell(row, COL.planType)),

        marketingStatus: normalizeText(getCell(row, COL.marketingStatus)),
        policyStatus: normalizeText(getCell(row, COL.policyStatus)),
        auditStatus: normalizeText(getCell(row, COL.auditStatus)),
        isOperationOnly: operationOnly,

        investmentTrackRewards: normalizeText(getCell(row, COL.investmentTrackNameR)),
        investmentTrackCompensation: normalizeText(getCell(row, COL.investmentTrackNameC)),
        insuranceTrack: normalizeText(getCell(row, COL.insuranceTrack)),
        survivorWaiver: normalizeText(getCell(row, COL.survivorWaiver)),

        depositFee: normalizeFeePercent(getCell(row, COL.depositFee)),
        accumulationFee: normalizeFeePercent(getCell(row, COL.accumulationFee)),

        depositFeeAgreement: normalizeFeePercent(getCell(row, COL.depositFeeAgreement)),
        accumulationFeeAgreement: normalizeFeePercent(getCell(row, COL.accumulationFeeAgreement)),

        accumulation: getTotalAccumulation(row),
        pensionSalary: normalizeNumber(getCell(row, COL.pensionSalary)),

        arrangementManager: normalizeText(getCell(row, COL.arrangementManager)),
        employerGroupId: normalizeText(getCell(row, COL.employerGroupId)),
        joinDate: normalizeDate(getCell(row, COL.joinDate)),
        validityMonth: normalizeText(getCell(row, COL.validityMonth)),

        raw: row,
      });
    });
  });

  console.log("parsePensionFund:", {
    total: allRows.length,
    operationOnly: allRows.filter((r) => r.isOperationOnly).length,
    withFees: allRows.filter((r) => r.depositFee !== null || r.accumulationFee !== null).length,
    withAccum: allRows.filter((r) => r.accumulation !== null).length,
    sampleFees: allRows
      .filter((r) => r.depositFee !== null)
      .slice(0, 3)
      .map((r) => ({
        emp: r.employeeCode,
        issuer: r.issuerOriginal,
        depositFee: `${r.depositFee}%`,
        accumulationFee: `${r.accumulationFee}%`,
        accumulation: r.accumulation,
      })),
  });

  return allRows;
}
