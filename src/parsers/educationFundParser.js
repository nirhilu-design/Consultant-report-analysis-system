// Path: src/parsers/educationFundParser.js
// CORE HARDENING v26
// EDUCATION FUND PARSER — קרנות השתלמות
//
// Purpose:
// Parse "קרנות השתלמות דוח יועץ.xlsx" into normalized product rows.
// This parser is intentionally independent from Dashboard and Upload UI.
//
// Input example:
// Sheet: "השתלמות וגמל"
// Columns include:
// קוד מזהה של העובד, חברת ביטוח, שם מנהל הסדר, שם קופה,
// דמי ניהול מצבירה באחוזים, דמי ניהול מצבירה בהסכם,
// ערך פדיון כולל, פרמיה אחרונה, חודש נכונות

import * as XLSX from "xlsx";

const EDUCATION_FUND_PARSER_VERSION = "education_fund_v1";

const COL = {
  employeeCode: 0,
  idNumber: 1,
  firstName: 2,
  lastName: 3,
  marketingStatus: 4,
  agencyProgramCode: 5,
  policyNumber: 6,
  employerGroupId: 7,
  employerSpecificId: 8,
  issuer: 9,
  arrangementManager: 10,
  fundName: 11,
  joinDate: 12,
  insuranceStartDate: 13,
  policyStatus: 14,
  policyStatusClearinghouse: 15,
  auditStatus: 16,
  linkedEmployerId: 17,
  investmentTrackCodeRewards: 18,
  investmentTrackNameRewards: 19,
  investmentTrackCodeCompensation: 20,
  investmentTrackNameCompensation: 21,
  accumulationFee: 22,
  accumulationFeeAgreement: 23,
  feeAuditStatus: 24,
  totalAccumulation: 25,
  lastPremium: 26,
  isArrangementAgent: 27,
  validityMonth: 28,
};

const HEADER_ALIASES = {
  employeeCode: ["קוד מזהה של העובד", "קוד עובד", "מספר עובד", "עובד"],
  idNumber: ['ת"ז', "ת.ז", "תעודת זהות", "מספר זהות"],
  firstName: ["שם פרטי"],
  lastName: ["שם משפחה"],
  marketingStatus: ["סטטוס שיווקי", "סטטוס לקוח", "סוג שירות"],
  agencyProgramCode: ["קוד מזהה של הסוכנות למספר תוכנית", "קוד סוכנות לתוכנית"],
  policyNumber: ["מספר פוליסה", "מספר חשבון", "מספר עמית", "מספר קופה"],
  employerGroupId: ["קוד מזהה קבוצת מעסיק", "מספר ח.פ מעסיק", "חפ מעסיק"],
  employerSpecificId: ["קוד מזהה מעסיק ספציפי", "מעסיק ספציפי"],
  issuer: ["חברת ביטוח", "גוף מנהל", "יצרן", "שם יצרן", "חברה מנהלת"],
  arrangementManager: ["שם מנהל הסדר", "מנהל הסדר", "סוכן", "סוכנות"],
  fundName: ["שם קופה", "שם קרן השתלמות", "שם מוצר", "שם תוכנית", "שם תכנית"],
  joinDate: ["תחילת חברות", "תאריך הצטרפות", "מועד הצטרפות"],
  insuranceStartDate: ["ת.ת.ביטוח", "תחילת ביטוח", "תאריך תחילת ביטוח"],
  policyStatus: ["סטטוס פוליסה", "סטטוס מוצר"],
  policyStatusClearinghouse: ["סטטוס פוליסה מסלקה", "סטטוס מסלקה"],
  auditStatus: ["סטטוס", "סטטוס בדיקה"],
  linkedEmployerId: ['ח"פ שמקושר לפוליסה', "חפ שמקושר לפוליסה", "ח.פ מקושר"],
  investmentTrackCodeRewards: ["קוד מסלול השקעה - תגמולים", "קוד מסלול תגמולים"],
  investmentTrackNameRewards: [
    "שם מסלול השקעה - תגמולים",
    " שם מסלול השקעה - תגמולים",
    "מסלול השקעה תגמולים",
    "מסלול תגמולים",
    "שם מסלול תגמולים",
  ],
  investmentTrackCodeCompensation: ["קוד מסלול השקעה - פיצויים", "קוד מסלול פיצויים"],
  investmentTrackNameCompensation: [
    "שם מסלול השקעה - פיצויים",
    "מסלול השקעה פיצויים",
    "מסלול פיצויים",
    "שם מסלול פיצויים",
  ],
  accumulationFee: [
    "דמי ניהול מצבירה באחוזים",
    "דמי ניהול מצבירה",
    "דמי ניהול מהצבירה",
    "מצבירה",
  ],
  accumulationFeeAgreement: [
    "דמי ניהול מצבירה בהסכם",
    "דמי ניהול מהצבירה בהסכם",
    "הסכם מצבירה",
    "דמי ניהול הסכם",
  ],
  feeAuditStatus: ["סטטוס דמי ניהול", "סטטוס בדיקת דמי ניהול", "סטטוס"],
  totalAccumulation: [
    "ערך פדיון כולל",
    "ערך פדיון כולל ",
    "ערך פדיון כולל ",
    "סהכ ערכי פידיון",
    'סה"כ ערכי פידיון',
    "סה״כ ערכי פידיון",
    "צבירה",
    "יתרה",
  ],
  lastPremium: ["פרמיה אחרונה", "הפקדה אחרונה", "הפקדה חודשית", "הפקדה"],
  isArrangementAgent: ["האם מנהל ההסדר  סוכן בקופה", "האם מנהל ההסדר סוכן בקופה", "סוכן בקופה"],
  validityMonth: ["חודש נכונות", "חודש דיווח", "חודש תוקף"],
};

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
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

  // Excel often stores 0.0075 for 0.75%.
  if (num !== 0 && Math.abs(num) < 0.1) {
    return Number((num * 100).toFixed(4));
  }

  return Number(num.toFixed(4));
}

function normalizeBooleanHebrew(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (["כן", "true", "1", "yes"].includes(text.toLowerCase())) return true;
  if (["לא", "false", "0", "no"].includes(text.toLowerCase())) return false;
  return null;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${month}-${day}`;
    }
  }

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
    console.warn("parseEducationFund: failed reading sheet", {
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
  const candidates = rows.slice(0, 12).map((row, index) => ({
    index,
    map: buildHeaderIndex(row),
  }));

  const importantFields = [
    "employeeCode",
    "issuer",
    "fundName",
    "accumulationFee",
    "totalAccumulation",
    "lastPremium",
  ];

  const best = candidates
    .map((candidate) => ({
      ...candidate,
      score: importantFields.filter((field) => candidate.map[field] !== undefined).length,
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (best?.score >= 3) return best;
  return { index: 0, map: {} };
}

function getField(row, indexMap, field) {
  const dynamicIndex = indexMap?.[field];

  if (dynamicIndex !== undefined) {
    const dynamicValue = getCell(row, dynamicIndex);
    if (dynamicValue !== null && dynamicValue !== undefined && normalizeText(dynamicValue) !== "") {
      return dynamicValue;
    }
  }

  return getCell(row, COL[field]);
}

function isDataRow(row, indexMap) {
  if (!Array.isArray(row)) return false;

  const employeeCode = getField(row, indexMap, "employeeCode");
  const issuer = getField(row, indexMap, "issuer");
  const fundName = getField(row, indexMap, "fundName");

  return (
    employeeCode !== null &&
    employeeCode !== undefined &&
    normalizeText(employeeCode) !== "" &&
    normalizeText(issuer) !== "" &&
    normalizeText(fundName) !== ""
  );
}

function getEmployeeCode(row, indexMap) {
  const raw = getField(row, indexMap, "employeeCode");
  if (raw === null || raw === undefined) return "";
  return String(typeof raw === "number" ? Math.round(raw) : raw).trim();
}

function getClientName(row, indexMap) {
  const firstName = normalizeText(getField(row, indexMap, "firstName"));
  const lastName = normalizeText(getField(row, indexMap, "lastName"));
  return [firstName, lastName].filter(Boolean).join(" ");
}

function getAccumulation(row, indexMap) {
  const raw = getField(row, indexMap, "totalAccumulation");
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && !/[0-9]/.test(raw)) return null;
  return normalizeNumber(raw);
}

export function parseEducationFund(workbook) {
  const sheetNames = getSheetNames(workbook);
  if (!sheetNames.length) return [];

  const educationSheetNames = sheetNames.filter((sheetName) => {
    const normalized = normalizeText(sheetName);
    return normalized.includes("השתלמות") || normalized.includes("גמל");
  });

  const selectedSheetNames = educationSheetNames.length ? educationSheetNames : sheetNames;

  if (!educationSheetNames.length) {
    console.warn("parseEducationFund: no education fund sheet was detected, using all sheets as fallback", {
      sheetNames,
    });
  }

  const allRows = [];
  const parserWarnings = [];

  selectedSheetNames.forEach((sheetName) => {
    const rows = readSheetRows(workbook, sheetName);
    if (rows.length < 2) return;

    const headerInfo = detectHeaderInfo(rows);
    const indexMap = headerInfo.map || {};
    const hasDynamicHeaders = Object.keys(indexMap).length >= 3;

    if (!hasDynamicHeaders) {
      parserWarnings.push(`לא זוהו מספיק כותרות בגיליון ${sheetName}; נעשה שימוש במיקומי העמודות הקיימים.`);
    }

    rows.slice(headerInfo.index + 1).forEach((row, idx) => {
      if (!isDataRow(row, indexMap)) return;

      const accumulationFee = normalizeFeePercent(getField(row, indexMap, "accumulationFee"));
      const accumulationFeeAgreement = normalizeFeePercent(getField(row, indexMap, "accumulationFeeAgreement"));
      const accumulation = getAccumulation(row, indexMap);

      allRows.push({
        sheetName,
        sourceRowIndex: headerInfo.index + idx + 2,
        parserVersion: EDUCATION_FUND_PARSER_VERSION,
        parserWarnings,

        productType: "hishtalmut",
        productLabel: "קרן השתלמות",

        employeeCode: getEmployeeCode(row, indexMap),
        idNumber: normalizeText(getField(row, indexMap, "idNumber")),
        clientName: getClientName(row, indexMap),

        issuerOriginal: normalizeText(getField(row, indexMap, "issuer")),
        manager: normalizeText(getField(row, indexMap, "issuer")),
        arrangementManager: normalizeText(getField(row, indexMap, "arrangementManager")),

        policyNumber: normalizeText(getField(row, indexMap, "policyNumber")),
        fundName: normalizeText(getField(row, indexMap, "fundName")),

        marketingStatus: normalizeText(getField(row, indexMap, "marketingStatus")),
        policyStatus: normalizeText(getField(row, indexMap, "policyStatus")),
        policyStatusClearinghouse: normalizeText(getField(row, indexMap, "policyStatusClearinghouse")),
        auditStatus: normalizeText(getField(row, indexMap, "auditStatus")),
        feeAuditStatus: normalizeText(getField(row, indexMap, "feeAuditStatus")),

        investmentTrackCodeRewards: normalizeText(getField(row, indexMap, "investmentTrackCodeRewards")),
        investmentTrackRewards: normalizeText(getField(row, indexMap, "investmentTrackNameRewards")),
        investmentTrackCodeCompensation: normalizeText(getField(row, indexMap, "investmentTrackCodeCompensation")),
        investmentTrackCompensation: normalizeText(getField(row, indexMap, "investmentTrackNameCompensation")),

        accumulation,
        lastPremium: normalizeNumber(getField(row, indexMap, "lastPremium")),
        depositFee: null,
        accumulationFee,
        depositFeeAgreement: null,
        accumulationFeeAgreement,

        joinDate: normalizeDate(getField(row, indexMap, "joinDate")),
        insuranceStartDate: normalizeDate(getField(row, indexMap, "insuranceStartDate")),
        validityMonth: normalizeText(getField(row, indexMap, "validityMonth")),

        employerGroupId: normalizeText(getField(row, indexMap, "employerGroupId")),
        employerSpecificId: normalizeText(getField(row, indexMap, "employerSpecificId")),
        linkedEmployerId: normalizeText(getField(row, indexMap, "linkedEmployerId")),
        isArrangementAgent: normalizeBooleanHebrew(getField(row, indexMap, "isArrangementAgent")),

        isOperationOnly: false,

        raw: row,
      });
    });
  });

  console.log("parseEducationFund:", {
    version: EDUCATION_FUND_PARSER_VERSION,
    total: allRows.length,
    withAccum: allRows.filter((row) => row.accumulation !== null).length,
    withAccumulationFee: allRows.filter((row) => row.accumulationFee !== null).length,
    issuers: [...new Set(allRows.map((row) => row.issuerOriginal).filter(Boolean))],
    totalAccumulation: allRows.reduce((sum, row) => sum + (Number(row.accumulation) || 0), 0),
    totalLastPremium: allRows.reduce((sum, row) => sum + (Number(row.lastPremium) || 0), 0),
    warnings: [...new Set(parserWarnings)],
  });

  return allRows;
}

export default parseEducationFund;
