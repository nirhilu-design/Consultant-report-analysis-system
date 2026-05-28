// src/unified/unifiedValidationRules.js
// CORE HARDENING v21
// Unified Validation Rules
//
// Purpose:
// Validate normalized Unified Rows after parsing and before analytics/dashboard usage.
// This module does not block the dashboard. It only produces structured issues.

import {
  PRODUCT_TYPES,
  ensureUnifiedRows,
  getProductConfig,
} from "./unifiedSchema.js";

const SEVERITY_LABELS = {
  HIGH: "גבוה",
  MEDIUM: "בינוני",
  LOW: "נמוך",
  INFO: "מידע",
};

function asRows(rows) {
  return ensureUnifiedRows(Array.isArray(rows) ? rows.filter(Boolean) : []);
}

function isPresent(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");

  if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.") return null;

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function getProductType(row) {
  return getProductConfig(row?.productType) ? row.productType : PRODUCT_TYPES.PENSION;
}

function getProductLabel(row) {
  return getProductConfig(getProductType(row))?.label || "מוצר";
}

function isOperationOnly(row) {
  const text = normalizeText([
    row.serviceStatus,
    row.sourceAuditStatus,
    row.marketingStatus,
    row.auditStatusHe,
    row.auditStatus,
  ].filter(Boolean).join(" "));

  return Boolean(
    row.isOperationOnly ||
    row.isExcludedFromFeeAudit ||
    row.auditStatus === "excluded" ||
    text.includes("תפעול בלבד") ||
    text.includes("ללא שיווק")
  );
}

function productSupports(row, flag) {
  return Boolean(getProductConfig(getProductType(row))?.[flag]);
}

function createIssue(row, issue) {
  return {
    rowNumber: row.sourceRowNumber || "",
    employeeCode: row.employeeCode || row.clientId || "",
    clientName: row.personal_fullName || row.clientName || "",
    issuer: row.issuerCanonical || row.issuerOriginal || "",
    productType: getProductType(row),
    productLabel: getProductLabel(row),
    accumulation: toNumber(row.accumulation) || 0,
    severity: issue.severity || "INFO",
    severityLabel: SEVERITY_LABELS[issue.severity || "INFO"] || "מידע",
    category: issue.category || "Unified Validation",
    issueCode: issue.issueCode,
    issueLabel: issue.issueLabel,
    businessMeaning: issue.businessMeaning,
    recommendation: issue.recommendation,
    metadata: issue.metadata || {},
  };
}

function severityRank(severity) {
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
  return rank[severity] ?? 9;
}

function validateRequiredIdentity(row, issues) {
  const excluded = isOperationOnly(row);
  const clientId = normalizeText(row.clientId || row.employeeCode);
  const clientName = normalizeText(row.clientName || row.personal_fullName);
  const issuer = normalizeText(row.issuerCanonical || row.issuerOriginal);
  const policyNumber = normalizeText(row.policyNumber);

  if (!clientId) {
    issues.push(createIssue(row, {
      severity: "HIGH",
      category: "Unified Schema",
      issueCode: "UNIFIED_MISSING_CLIENT_ID",
      issueLabel: "חסר מזהה לקוח בשורה המאוחדת",
      businessMeaning: "ללא מזהה לקוח קשה לאחד נתונים בין דוחות, פרטים אישיים והסכמים.",
      recommendation: "לבדוק מיפוי קוד עובד / תעודת זהות בשכבת ה־parser.",
    }));
  }

  if (!clientName && !excluded) {
    issues.push(createIssue(row, {
      severity: "MEDIUM",
      category: "Unified Schema",
      issueCode: "UNIFIED_MISSING_CLIENT_NAME",
      issueLabel: "חסר שם לקוח בשורה המאוחדת",
      businessMeaning: "הנתון ניתן לחישוב, אך התצוגה והשיוך למשפחה/לקוח עלולים להיות חלקיים.",
      recommendation: "לבדוק חיבור לקובץ פרטים אישיים או מיפוי שם עמית בקובץ הנתונים.",
    }));
  }

  if ((!issuer || issuer === "לא מזוהה") && !excluded) {
    issues.push(createIssue(row, {
      severity: "HIGH",
      category: "Unified Schema",
      issueCode: "UNIFIED_MISSING_ISSUER",
      issueLabel: "חסר גוף מנהל בשורה המאוחדת",
      businessMeaning: "בקרת הסכמים ודמי ניהול תלויה בזיהוי הגוף המנהל.",
      recommendation: "להוסיף alias לגוף המנהל או לבדוק מאיזו עמודה נלקח שם היצרן.",
    }));
  }

  if (!policyNumber && !excluded) {
    issues.push(createIssue(row, {
      severity: "LOW",
      category: "Unified Schema",
      issueCode: "UNIFIED_MISSING_POLICY_NUMBER",
      issueLabel: "חסר מספר פוליסה / חשבון",
      businessMeaning: "קשה לבצע drilldown מדויק למוצר יחיד או הצלבה מול דוחות אחרים.",
      recommendation: "לבדוק alias של מספר פוליסה / מספר חשבון / מספר קופה.",
    }));
  }
}

function validateNumericRanges(row, issues) {
  const excluded = isOperationOnly(row);
  const accumulation = toNumber(row.accumulation);
  const depositFee = toNumber(row.depositFee);
  const accumulationFee = toNumber(row.accumulationFee);

  if (accumulation !== null && accumulation < 0) {
    issues.push(createIssue(row, {
      severity: "HIGH",
      category: "ערכים מספריים",
      issueCode: "UNIFIED_NEGATIVE_ACCUMULATION",
      issueLabel: "צבירה שלילית",
      businessMeaning: "צבירה שלילית בדרך כלל מעידה על parsing שגוי או עמודה לא נכונה.",
      recommendation: "לבדוק את מקור השדה accumulation ואת ניקוי התווים המספריים.",
      metadata: { value: accumulation },
    }));
  }

  if (!excluded && accumulation !== null && accumulation > 100_000_000) {
    issues.push(createIssue(row, {
      severity: "MEDIUM",
      category: "ערכים מספריים",
      issueCode: "UNIFIED_SUSPICIOUSLY_HIGH_ACCUMULATION",
      issueLabel: "צבירה חריגה במיוחד",
      businessMeaning: "ייתכן שהערך נקרא במכפלה שגויה או כולל ספרות לא קשורות.",
      recommendation: "לבדוק הפרדה בין צבירה, מספר פוליסה ועמודות סכום סמוכות.",
      metadata: { value: accumulation },
    }));
  }

  if (productSupports(row, "hasDepositFee") && depositFee !== null && (depositFee < 0 || depositFee > 6)) {
    issues.push(createIssue(row, {
      severity: "HIGH",
      category: "ערכים מספריים",
      issueCode: "UNIFIED_DEPOSIT_FEE_OUT_OF_RANGE",
      issueLabel: "דמי ניהול מהפקדה מחוץ לטווח סביר",
      businessMeaning: "ייתכן שהערך הגיע כדצימלי/אחוז בצורה לא תקינה או מעמודה אחרת.",
      recommendation: "לבדוק normalization של אחוז דמי ניהול מהפקדה.",
      metadata: { value: depositFee },
    }));
  }

  if (productSupports(row, "hasAccumulationFee") && accumulationFee !== null && (accumulationFee < 0 || accumulationFee > 2)) {
    issues.push(createIssue(row, {
      severity: "HIGH",
      category: "ערכים מספריים",
      issueCode: "UNIFIED_ACCUMULATION_FEE_OUT_OF_RANGE",
      issueLabel: "דמי ניהול מצבירה מחוץ לטווח סביר",
      businessMeaning: "דמי ניהול מצבירה חריגים פוגעים בבקרת ההסכם ובניתוח החיסכון.",
      recommendation: "לבדוק normalization של אחוז דמי ניהול מצבירה.",
      metadata: { value: accumulationFee },
    }));
  }
}

function validateProductCompatibility(row, issues) {
  const productType = getProductType(row);
  const configured = Boolean(getProductConfig(row?.productType));

  if (!configured) {
    issues.push(createIssue(row, {
      severity: "MEDIUM",
      category: "סוג מוצר",
      issueCode: "UNIFIED_UNKNOWN_PRODUCT_TYPE",
      issueLabel: "סוג מוצר לא מוכר",
      businessMeaning: "המערכת תשתמש בברירת מחדל של קרן פנסיה, וזה עלול להשפיע על בדיקות דמי ניהול.",
      recommendation: "להוסיף productType תקין ל־unifiedSchema או לתקן mapping ב־parser.",
      metadata: { productType: row?.productType, fallbackProductType: productType },
    }));
  }

  if (productType === PRODUCT_TYPES.HISHTALMUT && isPresent(row.depositFee)) {
    issues.push(createIssue(row, {
      severity: "LOW",
      category: "סוג מוצר",
      issueCode: "UNIFIED_HISHTALMUT_WITH_DEPOSIT_FEE",
      issueLabel: "קרן השתלמות עם דמי ניהול מהפקדה",
      businessMeaning: "לרוב בקרן השתלמות בודקים דמי ניהול מצבירה, ולכן ייתכן שמדובר במיפוי עמודה שגוי.",
      recommendation: "לא לחסום את הנתון, אך לבדוק אם depositFee הגיע מעמודה אחרת.",
    }));
  }
}

function validateDuplicateKeys(rows, issues) {
  const map = new Map();

  rows.forEach((row) => {
    const key = [
      normalizeText(row.clientId || row.employeeCode),
      normalizeText(row.issuerCanonical || row.issuerOriginal),
      normalizeText(row.policyNumber),
      normalizeText(row.fundName),
    ].join("|");

    if (key.replace(/\|/g, "") === "") return;

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });

  map.forEach((group) => {
    if (group.length < 2) return;

    const totalAccumulation = group.reduce((sum, row) => sum + (toNumber(row.accumulation) || 0), 0);

    issues.push(createIssue(group[0], {
      severity: "INFO",
      category: "כפילויות",
      issueCode: "UNIFIED_POSSIBLE_DUPLICATE_PRODUCT_KEY",
      issueLabel: "ייתכן מוצר כפול לפי לקוח/יצרן/פוליסה/שם קרן",
      businessMeaning: "יכול להיות תקין אם יש כמה רכיבי מוצר, אבל כדאי לדעת שקיימת כפילות מפתח.",
      recommendation: "לבדוק האם מדובר בפיצול תגמולים/פיצויים או בשורות כפולות מהמקור.",
      metadata: {
        duplicateCount: group.length,
        totalAccumulation,
        rowNumbers: group.map((row) => row.sourceRowNumber).filter(Boolean),
      },
    }));
  });
}

export function buildUnifiedValidationReport(rows = []) {
  const safeRows = asRows(rows);
  const issues = [];

  safeRows.forEach((row) => {
    validateRequiredIdentity(row, issues);
    validateNumericRanges(row, issues);
    validateProductCompatibility(row, issues);
  });

  validateDuplicateKeys(safeRows, issues);

  const bySeverity = {
    HIGH: issues.filter((issue) => issue.severity === "HIGH").length,
    MEDIUM: issues.filter((issue) => issue.severity === "MEDIUM").length,
    LOW: issues.filter((issue) => issue.severity === "LOW").length,
    INFO: issues.filter((issue) => issue.severity === "INFO").length,
  };

  const byCategory = issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {});

  const sortedIssues = issues.sort((a, b) => {
    return severityRank(a.severity) - severityRank(b.severity) ||
      String(a.category).localeCompare(String(b.category), "he") ||
      String(a.issueCode).localeCompare(String(b.issueCode), "en");
  });

  return {
    version: "v21",
    summary: {
      totalRows: safeRows.length,
      issueCount: sortedIssues.length,
      highIssues: bySeverity.HIGH,
      mediumIssues: bySeverity.MEDIUM,
      lowIssues: bySeverity.LOW,
      infoIssues: bySeverity.INFO,
      actionableIssues: bySeverity.HIGH + bySeverity.MEDIUM + bySeverity.LOW,
      hasBlockingRisk: bySeverity.HIGH > 0,
    },
    bySeverity,
    byCategory,
    issues: sortedIssues,
  };
}

export default buildUnifiedValidationReport;
