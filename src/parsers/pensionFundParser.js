// Path: src/parsers/pensionFundParser.js
// ─────────────────────────────────────────────────────────────────────────────
// PENSION FUND PARSER — קריאה ונרמול קובץ פנסיה מדוח מנהל הסדר
//
// תיקונים לעומת הגרסה הקודמת:
//   1. מיפוי עמודות לפי INDEX קבוע — לא לפי שם (כי יש כפל שם "סטטוס")
//   2. סטטוס בדיקת ד.נ = col 44 (לא col 24 שהוא סטטוס פוליסה בלבד)
//   3. סה"כ ערכי פידיון = col 45 (מספר לשורות תקינות, טקסט לתפעול)
//   4. דמי ניהול: הקובץ שומר דצימלי (0.015) — ממירים ל-% (1.5)
//   5. זיהוי "תפעול בלבד" לפי col 44 בלבד — מדויק ואמין
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

// ─── Column index map (verified against real file 2025-10) ───────────────────
// אם מנהל ההסדר ישנה את מבנה הקובץ — מעדכנים רק כאן.
const COL = {
  employeeCode:             0,  // קוד מזהה של העובד
  idNumber:                 1,  // ת"ז
  firstName:                2,  // שם פרטי
  lastName:                 3,  // שם משפחה
  marketingStatus:          4,  // סטטוס שיווקי
  agencyCode:               5,  // קוד מזהה של הסוכנות
  arrangementManager:       6,  // שם מנהל הסדר
  policyIdCode:             7,  // קוד מזהה פוליסה
  policyNumber:             8,  // מספר פוליסה
  employerGroupId:          9,  // קוד מזהה קבוצת מעסיק
  employerSpecificId:      10,  // קוד מזהה מעסיק ספציפי
  issuer:                  11,  // קרן פנסיה (שם יצרן)
  planType:                12,  // סוג תוכנית פנסיה
  fundName:                13,  // שם קרן הפנסיה
  joinDate:                14,  // תאריך הצטרפות
  insuranceStartDate:      15,  // ת.ת.ביטוח
  compensationPct:         16,  // אחוז פיצויים
  employerRewardsPct:      17,  // אחוז תגמולי מעסיק
  employerDisabilityPct:   18,  // אחוז אכ"ע מעסיק
  employerMiscPct:         19,  // אחוז שונות מעסיק
  employeeRewardsPct:      20,  // אחוז תגמולי עובד
  employeeRewards47Pct:    21,  // אחוז תגמולי עובד (47)
  employeeMiscPct:         22,  // אחוז שונות עובד
  totalDepositPct:         23,  // סה"כ אחוזי הפקדה
  policyStatus:            24,  // סטטוס פוליסה (פעיל / לא פעיל) — לא תוצאת בדיקה!
  investmentTrackCodeR:    25,  // קוד מסלול השקעה - תגמולים
  investmentTrackNameR:    26,  // שם מסלול השקעה - תגמולים
  investmentTrackCodeC:    27,  // קוד מסלול השקעה - פיצויים
  investmentTrackNameC:    28,  // שם מסלול השקעה - פיצויים
  insuranceTrack:          29,  // מסלול ביטוח בקרן הפנסיה
  pensionSalary:           30,  // שכר קובע לקרן פנסיה
  disabilityPensionRate:   31,  // שיעור פנסיית נכות
  disabilityNote:          32,  // הערות שיעור פנסיית נכות
  survivorPensionRate:     33,  // שיעור פנסיית שארים מירבית
  survivorNote:            34,  // הערות שיעור פנסיית שארים
  disabilityAmountILS:     35,  // סכום בשקלים פנסיית נכות
  survivorAmountILS:       36,  // סכום בשקלים פנסיית שארים מירבית
  insuranceEndDate:        37,  // תום תקופת הביטוח בנכות
  survivorWaiver:          38,  // וויתור על פנסיית שארים
  depositFee:              39,  // דמי ניהול מפרמיה באחוזים   (דצימלי: 0.015 = 1.5%)
  accumulationFee:         40,  // דמי ניהול מצבירה באחוזים  (דצימלי: 0.0012 = 0.12%)
  compensationRedemption:  41,  // ערך פידיון פיצויים
  depositFeeAgreement:     42,  // דמי ניהול מפרמיה באחוזים בהסכם
  accumulationFeeAgreement:43,  // דמי ניהול מצבירה באחוזים בהסכם
  auditStatus:             44,  // סטטוס (תוצאת בדיקה: תקין / לא תקין / תפעול בלבד)
  totalAccumulation:       45,  // סה"כ ערכי פידיון (מספר לשורות רגילות, טקסט לתפעול)
  salaryAgency:            46,  // שכר נתוני סוכנות
  salaryClearinghouse:     47,  // שכר נתוני מסלקה
  isArrangementAgent:      48,  // האם מנהל ההסדר סוכן בפוליסה
  disabilityEndAge:        49,  // גיל תום תקופה לאכ"ע
  policyStatusSource:      50,  // סטטוס פוליסה (מקור)
  policyStatusClearinghouse:51, // סטטוס פוליסה מסלקה
  validityMonth:           52,  // חודש נכונות
};

// ─── Normalizers ──────────────────────────────────────────────────────────────

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

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

// דמי ניהול — הקובץ שומר דצימלי (0.015).
// מחזירים כאחוז (1.5) לעקביות עם כל המערכת.
// כלל: אם |value| < 0.1 ו-value ≠ 0 → דצימלי → כפול 100
function normalizeFeePercent(value) {
  const num = normalizeNumber(value);
  if (num === null) return null;
  if (Math.abs(num) > 20) return null;           // ודאי לא דמי ניהול
  if (num !== 0 && Math.abs(num) < 0.1) {
    return Number((num * 100).toFixed(4));        // 0.015 → 1.5
  }
  return Number(num.toFixed(4));                 // כבר באחוזים
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return normalizeText(value) || null;
}

// ─── Row helpers ──────────────────────────────────────────────────────────────

function isDataRow(row) {
  // שורה תקפה: חייבת קוד עובד + שם יצרן
  const code = row[COL.employeeCode];
  const issuer = row[COL.issuer];
  return (
    code !== null &&
    code !== undefined &&
    code !== "" &&
    issuer !== null &&
    issuer !== undefined &&
    normalizeText(String(issuer)) !== ""
  );
}

// col 44 הוא מקור האמת לזיהוי תפעול בלבד
function isOperationOnly(row) {
  return normalizeText(row[COL.auditStatus]).includes("תפעול");
}

function getEmployeeCode(row) {
  const raw = row[COL.employeeCode];
  if (raw === null || raw === undefined) return "";
  return String(typeof raw === "number" ? Math.round(raw) : raw).trim();
}

// col 45 = סה"כ ערכי פידיון.
// לשורות תפעול הערך הוא הטקסט "תפעול בלבד" — מחזירים null.
function getTotalAccumulation(row) {
  const raw = row[COL.totalAccumulation];
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") return null;      // טקסט = תפעול בלבד
  return normalizeNumber(raw);
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parsePensionFund(workbook) {
  if (!workbook) return [];

  const allRows = [];

  workbook.SheetNames.forEach((sheetName) => {
    // מעבדים רק גיליון שמכיל "פנסיה" בשמו — מדלגים על גיליון הסיכום
    if (!normalizeText(sheetName).includes("פנסיה")) return;

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    if (rows.length < 2) return;

    // שורה 0 = כותרות, שורה 1+ = נתונים
    rows.slice(1).forEach((row, idx) => {
      if (!isDataRow(row)) return;

      const operationOnly = isOperationOnly(row);

      allRows.push({
        // ── זיהוי ──────────────────────────────────────────────────────
        sheetName,
        sourceRowIndex:  idx + 2,              // שורה ב-Excel (1-based + header)
        employeeCode:    getEmployeeCode(row),

        // ── יצרן ────────────────────────────────────────────────────────
        issuerOriginal:  normalizeText(row[COL.issuer]),
        manager:         normalizeText(row[COL.issuer]), // alias לתאימות לאחור

        // ── מוצר ────────────────────────────────────────────────────────
        policyNumber:    normalizeText(row[COL.policyNumber]),
        fundName:        normalizeText(row[COL.fundName]),
        planType:        normalizeText(row[COL.planType]),

        // ── סטטוסים ─────────────────────────────────────────────────────
        marketingStatus: normalizeText(row[COL.marketingStatus]),
        policyStatus:    normalizeText(row[COL.policyStatus]),   // col 24
        auditStatus:     normalizeText(row[COL.auditStatus]),    // col 44
        isOperationOnly: operationOnly,

        // ── מסלולים ─────────────────────────────────────────────────────
        investmentTrackRewards:      normalizeText(row[COL.investmentTrackNameR]),
        investmentTrackCompensation: normalizeText(row[COL.investmentTrackNameC]),
        insuranceTrack:              normalizeText(row[COL.insuranceTrack]),
        survivorWaiver:              normalizeText(row[COL.survivorWaiver]),

        // ── דמי ניהול בפועל (דצימלי → אחוז) ───────────────────────────
        depositFee:      normalizeFeePercent(row[COL.depositFee]),
        accumulationFee: normalizeFeePercent(row[COL.accumulationFee]),

        // ── דמי ניהול בהסכם (כפי שמנהל ההסדר רשם) ─────────────────────
        depositFeeAgreement:      normalizeFeePercent(row[COL.depositFeeAgreement]),
        accumulationFeeAgreement: normalizeFeePercent(row[COL.accumulationFeeAgreement]),

        // ── כספים ───────────────────────────────────────────────────────
        accumulation:  getTotalAccumulation(row),  // col 45 — null לתפעול
        pensionSalary: normalizeNumber(row[COL.pensionSalary]),

        // ── מידע מעסיק ──────────────────────────────────────────────────
        arrangementManager: normalizeText(row[COL.arrangementManager]),
        employerGroupId:    normalizeText(row[COL.employerGroupId]),
        joinDate:           normalizeDate(row[COL.joinDate]),
        validityMonth:      normalizeText(row[COL.validityMonth]),

        // ── raw — לצורך debugging בלבד ──────────────────────────────────
        raw: row,
      });
    });
  });

  console.log("parsePensionFund:", {
    total:         allRows.length,
    operationOnly: allRows.filter((r) => r.isOperationOnly).length,
    withFees:      allRows.filter((r) => r.depositFee !== null || r.accumulationFee !== null).length,
    withAccum:     allRows.filter((r) => r.accumulation !== null).length,
    sampleFees:    allRows
      .filter((r) => r.depositFee !== null)
      .slice(0, 3)
      .map((r) => ({
        emp: r.employeeCode,
        issuer: r.issuerOriginal,
        depositFee: r.depositFee + "%",
        accumulationFee: r.accumulationFee + "%",
        accumulation: r.accumulation,
      })),
  });

  return allRows;
}
