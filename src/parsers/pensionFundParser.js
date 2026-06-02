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
  employeeCode: [
    "קוד מזהה של העובד",
    "קוד עובד",
    "מספר עובד",
    "עובד",
    "מס עובד",
    "מס' עובד",
    "employee code",
    "employee id",
  ],
  idNumber: [
    "תעודת זהות",
    "ת.ז",
    "תז",
    "מספר זהות",
    "מספר תעודת זהות",
    "id",
    "id number",
  ],
  firstName: ["שם פרטי", "פרטי", "first name"],
  lastName: ["שם משפחה", "משפחה", "last name"],
  issuer: [
    "קרן פנסיה",
    "חברת ביטוח",
    "גוף מנהל",
    "גוף מוסדי",
    "יצרן",
    "שם יצרן",
    "מנהל",
    "חברה מנהלת",
    "שם חברה מנהלת",
    "שם קופה מנהלת",
    "issuer",
    "manager",
  ],
  policyNumber: [
    "מספר פוליסה",
    "מס' פוליסה",
    "פוליסה",
    "מספר חשבון",
    "מס' חשבון",
    "מספר עמית",
    "מס' עמית",
    "מספר קופה",
    "מספר קופה/פוליסה",
    "מספר תכנית",
    "מספר תוכנית",
    "policy number",
    "account number",
  ],
  fundName: [
    "שם קרן הפנסיה",
    "שם קרן",
    "שם קופה",
    "שם המוצר",
    "שם מוצר",
    "שם תוכנית",
    "שם תכנית",
    "שם מסלול/קופה",
    "fund name",
    "product name",
  ],
  planType: [
    "סוג תוכנית",
    "סוג תכנית",
    "סוג מוצר",
    "סוג קופה",
    "סוג פוליסה",
    "product type",
    "plan type",
  ],
  marketingStatus: [
    "סטטוס שיווקי",
    "סטטוס לקוח",
    "סוג שירות",
    "סטטוס טיפול",
    "סטטוס שירות",
  ],
  policyStatus: [
    "סטטוס פוליסה",
    "סטטוס מוצר",
    "סטטוס קופה",
    "סטטוס חשבון",
    "מצב פוליסה",
  ],
  auditStatus: [
    "סטטוס",
    "סטטוס2",
    "סטטוס בדיקה",
    "סוג טיפול",
    "הערת בדיקה",
    "בקרת נתונים",
  ],
  investmentTrackNameR: [
    "שם מסלול השקעה - תגמולים",
    "שם מסלול השקעה תגמולים",
    "מסלול השקעה תגמולים",
    "מסלול תגמולים",
    "שם מסלול תגמולים",
    "מסלול השקעה",
    "שם מסלול השקעה",
  ],
  investmentTrackNameC: [
    "שם מסלול השקעה - פיצויים",
    "שם מסלול השקעה פיצויים",
    "מסלול השקעה פיצויים",
    "מסלול פיצויים",
    "שם מסלול פיצויים",
  ],
  insuranceTrack: [
    "מסלול ביטוח בקרן הפנסיה",
    "מסלול ביטוח",
    "כיסוי ביטוחי",
    "שם מסלול ביטוח",
    "מסלול כיסוי",
  ],
  survivorWaiver: [
    "ויתור שארים",
    "ויתור על שארים",
    "כיסוי שארים",
    "שאירים",
    "פנסיית שארים",
  ],
  depositFee: [
    "דמי ניהול מפרמיה באחוזים",
    "דמי ניהול מפרמיה",
    "דמי ניהול מהפקדה",
    "דמי ניהול מהפקדות",
    "דמי ניהול מהפקדות %",
    "שיעור דמי ניהול מהפקדה",
    "אחוז דמי ניהול מהפקדה",
    "מהפקדה",
    "דנ מהפקדה",
  ],
  accumulationFee: [
    "דמי ניהול מצבירה באחוזים",
    "דמי ניהול מצבירה",
    "דמי ניהול מהצבירה",
    "דמי ניהול מצבירה %",
    "שיעור דמי ניהול מצבירה",
    "אחוז דמי ניהול מצבירה",
    "מצבירה",
    "דנ מצבירה",
  ],
  depositFeeAgreement: [
    "דמי ניהול מהפקדה הסכם",
    "דמי ניהול מפרמיה בהסכם",
    "הסכם מהפקדה",
    "דמי ניהול מהפקדה לפי הסכם",
    "דנ מהפקדה הסכם",
  ],
  accumulationFeeAgreement: [
    "דמי ניהול מצבירה הסכם",
    "דמי ניהול מהצבירה בהסכם",
    "הסכם מצבירה",
    "דמי ניהול מצבירה לפי הסכם",
    "דנ מצבירה הסכם",
  ],
  totalAccumulation: [
    "סהכ ערכי פידיון",
    "סה\"כ ערכי פידיון",
    "סה״כ ערכי פידיון",
    "סך הכל ערכי פידיון",
    "סהכ ערכי פדיון",
    "סה\"כ ערכי פדיון",
    "סה״כ ערכי פדיון",
    "ערך פדיון כולל",
    "ערכי פדיון",
    "שווי צבירה",
    "יתרה צבורה",
    "יתרה",
    "צבירה",
    "צבירה נוכחית",
    "accumulation",
    "balance",
  ],
  pensionSalary: [
    "שכר פנסיוני",
    "שכר",
    "משכורת",
    "שכר מבוטח",
    "שכר מדווח",
    "שכר קובע",
    "שכר לביטוח",
  ],

  isArrangementAgent: [
    "האם מנהל ההסדר  סוכן בפוליסה",
    "האם מנהל ההסדר סוכן בפוליסה",
    "האם מנהל הסדר סוכן בפוליסה",
    "מנהל ההסדר סוכן בפוליסה",
    "בטיפול סוכן",
    "האם בטיפול סוכן",
  ],
  arrangementManager: [
    "מנהל הסדר",
    "מנהל ההסדר",
    "סוכן",
    "סוכנות",
    "שם סוכן",
    "מספר סוכן",
  ],
  employerGroupId: [
    "מספר ח.פ מעסיק",
    "מספר חפ מעסיק",
    "חפ מעסיק",
    "ח.פ מעסיק",
    "מזהה מעסיק",
    "מספר מעסיק",
  ],
  joinDate: [
    "תאריך הצטרפות",
    "מועד הצטרפות",
    "תאריך תחילת חברות",
    "תאריך פתיחת חשבון",
  ],
  validityMonth: [
    "חודש נכונות",
    "חודש דיווח",
    "חודש תוקף",
    "נכון לחודש",
    "תאריך נכונות",
  ],
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

function isArrangementAgentHeader(value) {
  const text = normalizeHeader(value);
  if (!text) return false;

  const exactHeaders = HEADER_ALIASES.isArrangementAgent.map((alias) => normalizeHeader(alias));
  if (exactHeaders.includes(text)) return true;

  // V82: זיהוי קשיח של התא שבתמונה: "האם מנהל ההסדר סוכן בפוליסה".
  // הכותרת לפעמים מגיעה עם ירידות שורה / רווח כפול, לכן בודקים את רכיבי הכותרת,
  // אבל לא מסתפקים במילה "סוכן" כדי לא ליפול על "שם מנהל הסדר".
  const requiredTokens = ["האם", "מנהל", "סוכן", "בפוליסה"];
  return requiredTokens.every((token) => text.includes(token));
}

function findArrangementAgentHeader(rows) {
  const maxRowsToScan = Math.min(rows.length, 20);

  for (let rowIndex = 0; rowIndex < maxRowsToScan; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!Array.isArray(row)) continue;

    const columnIndex = row.findIndex((cell) => isArrangementAgentHeader(cell));
    if (columnIndex >= 0) {
      return { rowIndex, columnIndex, headerText: normalizeText(row[columnIndex]) };
    }
  }

  return null;
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

    // V82: עמודת "האם מנהל ההסדר סוכן בפוליסה" רגישה עסקית.
    // לא עושים לה fuzzy match כללי; הזיהוי הקשיח נעשה ב-findArrangementAgentHeader.
    if (field === "isArrangementAgent") return;

    const fuzzyIndex = normalizedCells.findIndex((cell) => {
      if (!cell || cell.length < 3) return false;
      return normalizedAliases.some((alias) => alias && alias.length >= 3 && (cell.includes(alias) || alias.includes(cell)));
    });

    if (fuzzyIndex >= 0) indexMap[field] = fuzzyIndex;
  });

  return indexMap;
}

function detectHeaderInfo(rows) {
  const arrangementAgentHeader = findArrangementAgentHeader(rows);

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

  const headerInfo = best?.score >= 2 ? best : { index: 0, map: {} };

  if (arrangementAgentHeader) {
    headerInfo.map = {
      ...(headerInfo.map || {}),
      isArrangementAgent: arrangementAgentHeader.columnIndex,
    };
    headerInfo.arrangementAgentHeader = arrangementAgentHeader;

    // אם הכותרת העסקית נמצאה בשורה מאוחרת יותר מזיהוי הכותרות הכללי,
    // מתחילים את הנתונים מתחת לשורת הכותרות האמיתית.
    if (arrangementAgentHeader.rowIndex > headerInfo.index) {
      headerInfo.index = arrangementAgentHeader.rowIndex;
    }
  }

  return headerInfo;
}

function getField(row, indexMap, field) {
  const dynamicIndex = indexMap?.[field];
  if (dynamicIndex !== undefined) {
    const dynamicValue = getCell(row, dynamicIndex);
    if (dynamicValue !== null && dynamicValue !== undefined && normalizeText(dynamicValue) !== "") return dynamicValue;
  }

  // V82: אסור לנחש את עמודת "האם מנהל ההסדר סוכן בפוליסה" לפי מיקום fallback.
  // אם התא המדויק לא נמצא בשורת הכותרות, מחזירים null ולא מסיקים מתפעל מעמודות אחרות.
  if (field === "isArrangementAgent") return null;

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

function isNegativeAgentValue(value) {
  const text = normalizeText(value).toLowerCase();
  return text === "לא" || text === "no" || text === "false" || text === "0";
}

function isOperationOnly(row, indexMap) {
  // V82: מתפעל בלבד נקבע אך ורק לפי העמודה:
  // "האם מנהל ההסדר  סוכן בפוליסה".
  // אם הערך בעמודה הוא "לא" המשמעות היא שהמוצר בתפעול בלבד.
  // לא משתמשים בעמודות סטטוס / דמי ניהול כדי למנוע ערבוב בין סטטוס פוליסה לבין סטטוס טיפול סוכן.
  const arrangementAgent = getField(row, indexMap, "isArrangementAgent");
  return isNegativeAgentValue(arrangementAgent);
}


function getPensionFundProfile({ issuerOriginal, fundName, planType } = {}) {
  const text = normalizeText([issuerOriginal, fundName, planType].filter(Boolean).join(" "));

  if (!text) {
    return {
      pensionFundType: "לא צוין",
      isVeteranPensionFund: false,
      isFeeAuditEligible: true,
    };
  }

  // כלל עסקי V83: בודקים מקיפה וכללית; לא בודקים ותיקה/ישן.
  // דוגמאות מהקובץ: "גלעד ישן" ו"תשורה זיקנה" לא נכנסות לבקרת דמי ניהול.
  const isVeteran =
    text.includes("ותיק") ||
    text.includes("ותיקה") ||
    text.includes("ישן") ||
    text.includes("זיקנה") ||
    text.includes("זקנה");

  if (isVeteran) {
    return {
      pensionFundType: "ותיקה",
      isVeteranPensionFund: true,
      isFeeAuditEligible: false,
    };
  }

  if (text.includes("כללית") || text.includes("משלימ") || text.includes("משלימה")) {
    return {
      pensionFundType: "כללית",
      isVeteranPensionFund: false,
      isFeeAuditEligible: true,
    };
  }

  return {
    pensionFundType: "מקיפה",
    isVeteranPensionFund: false,
    isFeeAuditEligible: true,
  };
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
      const issuerOriginal = normalizeText(getField(row, indexMap, "issuer"));
      const fundName = normalizeText(getField(row, indexMap, "fundName"));
      const planType = normalizeText(getField(row, indexMap, "planType"));
      const pensionFundProfile = getPensionFundProfile({
        issuerOriginal,
        fundName,
        planType,
      });

      allRows.push({
        sheetName,
        sourceRowIndex: headerInfo.index + idx + 2,
        parserVersion: "stability_09_v83",
        parserWarnings,
        employeeCode: getEmployeeCode(row, indexMap),

        issuerOriginal,
        manager: issuerOriginal,

        policyNumber: normalizeText(getField(row, indexMap, "policyNumber")),
        fundName,
        planType,
        pensionFundType: pensionFundProfile.pensionFundType,
        isVeteranPensionFund: pensionFundProfile.isVeteranPensionFund,
        isFeeAuditEligible: pensionFundProfile.isFeeAuditEligible,

        marketingStatus: normalizeText(getField(row, indexMap, "marketingStatus")),
        policyStatus: normalizeText(getField(row, indexMap, "policyStatus")),
        auditStatus: normalizeText(getField(row, indexMap, "auditStatus")),
        isOperationOnly: operationOnly,
        isArrangementAgent: normalizeText(getField(row, indexMap, "isArrangementAgent")),
        isArrangementAgentRaw: normalizeText(getField(row, indexMap, "isArrangementAgent")),
        isArrangementAgentColumnIndex: indexMap?.isArrangementAgent ?? null,
        isArrangementAgentHeaderText: headerInfo.arrangementAgentHeader?.headerText || "",

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
    version: "stability_09_v83",
    total: allRows.length,
    operationOnly: allRows.filter((r) => r.isOperationOnly).length,
    arrangementAgentValues: allRows.reduce((acc, row) => {
      const key = row.isArrangementAgent || "ריק";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
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
