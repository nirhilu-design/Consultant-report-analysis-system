// Path: src/parsers/executiveInsuranceParser.js
// v66 — Executive Insurance parser / ביטוח מנהלים

import * as XLSX from "xlsx";

const PARSER_VERSION = "executive_insurance_v66";

const HEADER_ALIASES = {
  employeeCode: ["קוד מזהה של העובד", "קוד עובד", "מספר עובד"],
  idNumber: ['ת"ז', "ת.ז", "תעודת זהות"],
  firstName: ["שם פרטי"],
  lastName: ["שם משפחה"],
  marketingStatus: ["סטטוס שיווקי"],
  agencyProgramCode: ["קוד מזהה של הסוכנות למספר תוכנית"],
  arrangementManager: ["שם מנהל הסדר", "מנהל הסדר"],
  policyId: ["קוד מזהה פוליסה"],
  policyNumber: ["מספר פוליסה"],
  issuer: ["חברת ביטוח", "יצרן", "שם יצרן"],
  insuranceStartDate: ["תחילת ביטוח", "ת.ת.ביטוח"],
  employerCompensationRate: ["אחוז פיצויים"],
  employerRewardsRate: ["אחוז תגמולי מעסיק"],
  disabilityRate: ['אחוז אכ"ע מעסיק', "אחוז אכע מעסיק"],
  employeeRewardsRate: ["אחוז תגמולי עובד"],
  totalDepositRate: ['סה"כ אחוזי הפקדה', "סה״כ אחוזי הפקדה"],
  rewardsTrackName: ["שם מסלול השקעה - תגמולים"],
  compensationTrackName: ["שם מסלול השקעה - פיצויים"],
  activeStatus: ["סטטוס פעיל / מסולק"],
  deathCoverAmount: ["סכום ביטוח למקרה מוות"],
  accumulationFeeAgreement: ["שיעור דמי ניהול מצבירה - לפי הסכם"],
  variableAccumulationFee: ["שיעור דמי ניהול משתנים מצבירה"],
  premiumFeeAmount: ["דמי ניהול מפרמיה בשקלים בפועל"],
  premiumFeePercent: ["דמי ניהול מפרמיה באחוזים"],
  totalAccumulation: ["ערך פדיון כולל", "ערך פדיון כולל ", "ערך פדיון כולל ", "צבירה"],
  agencySalary: ["שכר נתוני סוכנות"],
  clearinghouseSalary: ["שכר נתוני מסלקה"],
  isArrangementAgent: ["האם מנהל ההסדר סוכן בפוליסה"],
  policyStatus: ["סטטוס פוליסה"],
  validityMonth: ["חודש נכונות"],
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
  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeFeePercent(value) {
  const num = normalizeNumber(value);
  if (num === null) return null;
  if (Math.abs(num) > 20) return null;
  if (num !== 0 && Math.abs(num) < 0.1) return Number((num * 100).toFixed(4));
  return Number(num.toFixed(4));
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  return normalizeText(value) || null;
}

function getYear(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getFullYear();
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed?.y || null;
  }
  const text = normalizeText(value);
  const match = text.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) || [];
}

function buildHeaderIndex(headerRow) {
  const normalizedCells = Array.isArray(headerRow) ? headerRow.map(normalizeHeader) : [];
  const indexMap = {};
  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    const normalizedAliases = aliases.map(normalizeHeader).filter(Boolean);
    const exactIndex = normalizedCells.findIndex((cell) => normalizedAliases.includes(cell));
    if (exactIndex >= 0) {
      indexMap[field] = exactIndex;
      return;
    }
    const fuzzyIndex = normalizedCells.findIndex((cell) =>
      normalizedAliases.some((alias) => alias && cell && (cell.includes(alias) || alias.includes(cell)))
    );
    if (fuzzyIndex >= 0) indexMap[field] = fuzzyIndex;
  });
  return indexMap;
}

function detectHeaderInfo(rows) {
  const candidates = rows.slice(0, 12).map((row, index) => ({ index, map: buildHeaderIndex(row) }));
  return candidates.sort((a, b) => Object.keys(b.map).length - Object.keys(a.map).length)[0] || { index: 0, map: {} };
}

function cell(row, indexMap, key, fallbackIndex = null) {
  const idx = indexMap[key] ?? fallbackIndex;
  return idx === null || idx === undefined ? null : row?.[idx];
}

export function normalizeExecutiveIssuer(value) {
  return normalizeText(value)
    .replace(/בע"מ/g, "")
    .replace(/בעמ/g, "")
    .replace(/חברה לביטוח/g, "")
    .replace(/חברת ביטוח/g, "")
    .replace(/ביטוח/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseExecutiveInsurance(workbook) {
  const sheetName = workbook?.SheetNames?.[0];
  if (!sheetName) return { rows: [], warnings: ["לא נמצאו גיליונות בקובץ ביטוח מנהלים."], metadata: { parserVersion: PARSER_VERSION } };

  const rows = readSheetRows(workbook, sheetName);
  const headerInfo = detectHeaderInfo(rows);
  const dataRows = rows.slice(headerInfo.index + 1);
  const parsedRows = [];
  const warnings = [];

  dataRows.forEach((rawRow, rowOffset) => {
    if (!Array.isArray(rawRow) || rawRow.every((value) => value === null || value === "")) return;

    const issuerOriginal = normalizeText(cell(rawRow, headerInfo.map, "issuer", 11));
    const employeeCode = normalizeText(cell(rawRow, headerInfo.map, "employeeCode", 0));
    const policyId = normalizeText(cell(rawRow, headerInfo.map, "policyId", 7));

    if (!issuerOriginal && !employeeCode && !policyId) return;

    const startDateRaw = cell(rawRow, headerInfo.map, "insuranceStartDate", 12);
    const actualPremiumFeePercent = normalizeFeePercent(cell(rawRow, headerInfo.map, "premiumFeePercent", 36));
    const actualAccumulationFeePercent =
      normalizeFeePercent(cell(rawRow, headerInfo.map, "variableAccumulationFee", 34)) ??
      normalizeFeePercent(cell(rawRow, headerInfo.map, "accumulationFeeAgreement", 33));

    parsedRows.push({
      productType: "executiveInsurance",
      productLabel: "ביטוח מנהלים",
      sourceRowNumber: headerInfo.index + rowOffset + 2,
      employeeCode,
      idNumber: normalizeText(cell(rawRow, headerInfo.map, "idNumber", 1)),
      firstName: normalizeText(cell(rawRow, headerInfo.map, "firstName", 2)),
      lastName: normalizeText(cell(rawRow, headerInfo.map, "lastName", 3)),
      memberName: [cell(rawRow, headerInfo.map, "firstName", 2), cell(rawRow, headerInfo.map, "lastName", 3)].map(normalizeText).filter(Boolean).join(" "),
      marketingStatus: normalizeText(cell(rawRow, headerInfo.map, "marketingStatus", 4)),
      arrangementManagerName: normalizeText(cell(rawRow, headerInfo.map, "arrangementManager", 6)),
      policyId,
      policyNumber: normalizeText(cell(rawRow, headerInfo.map, "policyNumber", 8)),
      issuerOriginal,
      issuer: normalizeExecutiveIssuer(issuerOriginal) || issuerOriginal,
      companyName: normalizeExecutiveIssuer(issuerOriginal) || issuerOriginal,
      insuranceStartDate: normalizeDate(startDateRaw),
      insuranceStartYear: getYear(startDateRaw),
      activeStatus: normalizeText(cell(rawRow, headerInfo.map, "activeStatus", 26)),
      policyStatus: normalizeText(cell(rawRow, headerInfo.map, "policyStatus", 41)),
      actualPremiumFeePercent,
      actualAccumulationFeePercent,
      premiumFeeAmount: normalizeNumber(cell(rawRow, headerInfo.map, "premiumFeeAmount", 35)),
      totalAccumulation: normalizeNumber(cell(rawRow, headerInfo.map, "totalAccumulation", 37)) || 0,
      accumulation: normalizeNumber(cell(rawRow, headerInfo.map, "totalAccumulation", 37)) || 0,
      deathCoverAmount: normalizeNumber(cell(rawRow, headerInfo.map, "deathCoverAmount", 27)) || 0,
      rewardsTrackName: normalizeText(cell(rawRow, headerInfo.map, "rewardsTrackName", 23)),
      compensationTrackName: normalizeText(cell(rawRow, headerInfo.map, "compensationTrackName", 25)),
      validityMonth: normalizeText(cell(rawRow, headerInfo.map, "validityMonth", 42)),
      feeStatus: "לא נבדק",
    });
  });

  if (!parsedRows.length) warnings.push("קובץ ביטוח מנהלים נטען, אך לא זוהו שורות מוצר תקינות.");

  return {
    rows: parsedRows,
    warnings,
    metadata: {
      parserVersion: PARSER_VERSION,
      sheetName,
      headerRow: headerInfo.index + 1,
      rawRowCount: dataRows.length,
      parsedRowCount: parsedRows.length,
    },
  };
}
