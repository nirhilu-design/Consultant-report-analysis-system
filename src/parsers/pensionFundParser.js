// Path: src/parsers/pensionFundParser.js
// ─────────────────────────────────────────────────────────────────────────────
// PENSION FUND PARSER — קריאה ונרמול קובץ פנסיה מדוח מנהל הסדר
//
// Stability 05:
//   1. Header detection עדין: אם כותרות זוהו, נשתמש בהן; אם לא — נשארים עם מיקומי העמודות הקיימים.
//   2. Header aliases לשמות עמודות נפוצים כדי להקטין תלות בסדר עמודות קשיח.
//   3. המשך הגנות Stability 04 סביב workbook / sheets / rows.
//   4. אותו schema עסקי מוחזר — בלי שינוי Dashboard / Audit / UX.
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

const HEADER_ALIASES = {
  employeeCode: ["קוד מזהה של העובד", "קוד עובד", "מספר עובד", "עובד"],
  issuer: ["קרן פנסיה", "חברת ביטוח", "גוף מנהל", "יצרן", "שם יצרן", "מנהל"],
  policyNumber: ["מספר פוליסה", "מספר חשבון", "מספר עמית", "מספר קופה"],
  fundName: ["שם קרן הפנסיה", "שם קופה", "שם מוצר", "שם תוכנית", "שם תכנית"],
  planType: ["סוג תוכנית", "סוג תכנית", "סוג מוצר"],
  marketingStatus: ["סטטוס שיווקי", "סטטוס לקוח", "סוג שירות"],
  policyStatus: ["סטטוס פוליסה", "סטטוס מוצר"],
  auditStatus: ["סטטוס", "סטטוס2", "סטטוס בדיקה", "סוג טיפול"],
  investmentTrackNameR: [
    "שם מסלול השקעה - תגמולים",
    "מסלול השקעה תגמולים",
    "מסלול תגמולים",
    "שם מסלול תגמולים",
  ],
  investmentTrackNameC: [
    "שם מסלול השקעה - פיצויים",
    "מסלול השקעה פיצויים",
    "מסלול פיצויים",
    "שם מסלול פיצויים",
  ],
  insuranceTrack: ["מסלול ביטוח בקרן הפנסיה", "מסלול ביטוח", "כיסוי ביטוחי"],
  survivorWaiver: ["ויתור שארים", "כיסוי שארים", "שאירים"],
  depositFee: ["דמי ניהול מפרמיה באחוזים", "דמי ניהול מהפקדה", "דמי ניהול מהפקדות", "מהפקדה"],
  accumulationFee: ["דמי ניהול מצבירה באחוזים", "דמי ניהול מצבירה", "דמי ניהול מהצבירה", "מצבירה"],
  depositFeeAgreement: ["דמי ניהול מהפקדה הסכם", "הסכם מהפקדה", "דמי ניהול מפרמיה בהסכם"],
  accumulationFeeAgreement: ["דמי ניהול מצבירה הסכם", "הסכם מצבירה", "דמי ניהול מהצבירה בהסכם"],
  totalAccumulation: ["סהכ ערכי פידיון", "סה\"כ ערכי פידיון", "סה״כ ערכי פידיון", "ערך פדיון כולל", "צבירה", "יתרה"],
  pensionSalary: ["שכר פנסיוני", "שכר", "משכורת", "שכר מבוטח"],
  arrangementManager: ["מנהל הסדר", "סוכן", "סוכנות"],
  employerGroupId: ["מספר ח.פ מעסיק", "חפ מעסיק", "מזהה מעסיק"],
  joinDate: ["תאריך הצטרפות", "מועד הצטרפות"],
  validityMonth: ["חודש נכונות", "חודש דיווח", "חודש תוקף"],
};

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function normalizeHeader(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[.:]/g, "")
    .replace(/[־–—_-]/g, " ")
    .replace(/\s+/g, " ")
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

function buildHeaderIndex(headerRow) {
  if (!Array.isArray(headerRow)) return {};

  const normalizedCells = headerRow.map((cell) => normalizeHeader(cell));
  const indexMap = {};

  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    const normalizedAliases = aliases.map((alias) => normalizeHeader(alias)).filter(Boolean);

    const exactIndex = normalizedCells.findIndex((cell) => normalizedAliases.includes(cell));
    if (exactIndex >= 0) {
      indexMap[field] = exactIndex;
      return;
    }

    const fuzzyIndex = normalizedCells.findIndex((cell) => {
      if (!cell || cell.length < 3) return false;
      return normalizedAliases.some((alias) => alias && alias.length >= 3 && (cell.includes(alias) || alias.includes(cell)));
    });

    if (fuzzyIndex >= 0) indexMap[field] = fuzzyIndex;
  });

  return indexMap;
}

function detectHeaderInfo(rows) {
  const candidates = rows.slice(0, 10).map((row, index) => ({
    index,
    map: buildHeaderIndex(row),
  }));

  const best = candidates
    .map((candidate) => ({
      ...candidate,
      score: ["employeeCode", "issuer", "depositFee", "accumulationFee", "totalAccumulation"].filter(
        (field) => candidate.map[field] !== undefined
      ).length,
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (best?.score >= 2) return best;
  return { index: 0, map: {} };
}

function getField(row, indexMap, field) {
  const dynamicIndex = indexMap?.[field];
  if (dynamicIndex !== undefined) {
    const dynamicValue = getCell(row, dynamicIndex);
    if (dynamicValue !== null && dynamicValue !== undefined && normalizeText(dynamicValue) !== "") return dynamicValue;
  }

  return getCell(row, COL[field]);
}

function isDataRow(row, indexMap) {
  if (!Array.isArray(row)) return false;

  const code = getField(row, indexMap, "employeeCode");
  const issuer = getField(row, indexMap, "issuer");

  return (
    code !== null &&
    code !== undefined &&
    code !== "" &&
    issuer !== null &&
    issuer !== undefined &&
    normalizeText(issuer) !== ""
  );
}

function isOperationOnly(row, indexMap) {
  return normalizeText(getField(row, indexMap, "auditStatus")).includes("תפעול");
}

function getEmployeeCode(row, indexMap) {
  const raw = getField(row, indexMap, "employeeCode");
  if (raw === null || raw === undefined) return "";
  return String(typeof raw === "number" ? Math.round(raw) : raw).trim();
}

function getTotalAccumulation(row, indexMap) {
  const raw = getField(row, indexMap, "totalAccumulation");
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && !/[0-9]/.test(raw)) return null;
  return normalizeNumber(raw);
}

export function parsePensionFund(workbook) {
  const sheetNames = getSheetNames(workbook);
  if (!sheetNames.length) return [];

  const pensionSheetNames = sheetNames.filter((sheetName) =>
    normalizeText(sheetName).includes("פנסיה")
  );

  const selectedSheetNames = pensionSheetNames.length ? pensionSheetNames : sheetNames;
  if (!pensionSheetNames.length) {
    console.warn("parsePensionFund: no pension sheet was detected, using all sheets as fallback", { sheetNames });
  }

  const allRows = [];
  const parserWarnings = [];

  selectedSheetNames.forEach((sheetName) => {
    const rows = readSheetRows(workbook, sheetName);
    if (rows.length < 2) return;

    const headerInfo = detectHeaderInfo(rows);
    const indexMap = headerInfo.map || {};
    const hasDynamicHeaders = Object.keys(indexMap).length >= 2;

    if (!hasDynamicHeaders) {
      parserWarnings.push(`לא זוהו מספיק כותרות בגיליון ${sheetName}; נעשה שימוש במיקומי העמודות הקיימים.`);
    }

    rows.slice(headerInfo.index + 1).forEach((row, idx) => {
      if (!isDataRow(row, indexMap)) return;

      const operationOnly = isOperationOnly(row, indexMap);

      allRows.push({
        sheetName,
        sourceRowIndex: headerInfo.index + idx + 2,
        parserVersion: "stability_05",
        parserWarnings,
        employeeCode: getEmployeeCode(row, indexMap),

        issuerOriginal: normalizeText(getField(row, indexMap, "issuer")),
        manager: normalizeText(getField(row, indexMap, "issuer")),

        policyNumber: normalizeText(getField(row, indexMap, "policyNumber")),
        fundName: normalizeText(getField(row, indexMap, "fundName")),
        planType: normalizeText(getField(row, indexMap, "planType")),

        marketingStatus: normalizeText(getField(row, indexMap, "marketingStatus")),
        policyStatus: normalizeText(getField(row, indexMap, "policyStatus")),
        auditStatus: normalizeText(getField(row, indexMap, "auditStatus")),
        isOperationOnly: operationOnly,

        investmentTrackRewards: normalizeText(getField(row, indexMap, "investmentTrackNameR")),
        investmentTrackCompensation: normalizeText(getField(row, indexMap, "investmentTrackNameC")),
        insuranceTrack: normalizeText(getField(row, indexMap, "insuranceTrack")),
        survivorWaiver: normalizeText(getField(row, indexMap, "survivorWaiver")),

        depositFee: normalizeFeePercent(getField(row, indexMap, "depositFee")),
        accumulationFee: normalizeFeePercent(getField(row, indexMap, "accumulationFee")),

        depositFeeAgreement: normalizeFeePercent(getField(row, indexMap, "depositFeeAgreement")),
        accumulationFeeAgreement: normalizeFeePercent(getField(row, indexMap, "accumulationFeeAgreement")),

        accumulation: getTotalAccumulation(row, indexMap),
        pensionSalary: normalizeNumber(getField(row, indexMap, "pensionSalary")),

        arrangementManager: normalizeText(getField(row, indexMap, "arrangementManager")),
        employerGroupId: normalizeText(getField(row, indexMap, "employerGroupId")),
        joinDate: normalizeDate(getField(row, indexMap, "joinDate")),
        validityMonth: normalizeText(getField(row, indexMap, "validityMonth")),

        raw: row,
      });
    });
  });

  console.log("parsePensionFund:", {
    version: "stability_05",
    total: allRows.length,
    operationOnly: allRows.filter((r) => r.isOperationOnly).length,
    withFees: allRows.filter((r) => r.depositFee !== null || r.accumulationFee !== null).length,
    withAccum: allRows.filter((r) => r.accumulation !== null).length,
    warnings: [...new Set(parserWarnings)],
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
