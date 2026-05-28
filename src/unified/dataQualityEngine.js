// Path: src/unified/dataQualityEngine.js

import {
  PRODUCT_TYPES,
  ensureUnifiedRows,
  getProductConfig,
} from "./unifiedSchema.js";
import { buildUnifiedValidationReport } from "./unifiedValidationRules.js";

// ─────────────────────────────────────────────────────────────────────────────
// SMART PENSION DATA VALIDATION — בדיקת תקינות נתונים פנסיונית
//
// המטרה:
// לא לבדוק רק "האם יש ערך", אלא האם הערך הגיוני עסקית.
//
// עיקרון חשוב:
// צבירה 0 אינה תמיד תקלה.
// היא בעיה רק אם השורה נראית כמו מוצר פעיל / רלוונטי:
//   - יש דמי ניהול
//   - יש הסכם / דמי ניהול מאושרים
//   - יש מסלול השקעה
//   - יש אינדיקציה להפקדה / שכר / סטטוס פעיל
//
// שורות תפעול בלבד / ללא שיווק / מוחרגות:
//   לא מקבלות התראת צבירה חסרה.
// ─────────────────────────────────────────────────────────────────────────────

function safeRows(rows) {
  return ensureUnifiedRows(Array.isArray(rows) ? rows.filter(Boolean) : []);
}

function getProductType(row) {
  return getProductConfig(row?.productType) ? row.productType : PRODUCT_TYPES.PENSION;
}

function productSupports(row, flag) {
  return Boolean(getProductConfig(getProductType(row))?.[flag]);
}

function getProductLabel(row) {
  return getProductConfig(getProductType(row))?.label || "מוצר";
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function normalizeTrack(value) {
  const text = normalizeText(value);

  if (!text) return "";
  if (text === "ללא מסלול") return "";
  if (text === "ללא מסלול השקעה") return "";
  if (text === "לא צוין") return "";
  if (text === "לא רלוונטי") return "";

  return text;
}

function toNumber(value) {
  if (!isPresent(value)) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  if (!cleaned) return null;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function hasAnyAgreement(row) {
  return Boolean(
    row.agreementIssuerFound ||
    row.auditMatchRuleType === "INLINE_AGREEMENT" ||
    row.auditMatchResult === "MATCH_INLINE_AGREEMENT" ||
    row.auditMatchResult === "FAIL_INLINE_AGREEMENT" ||
    isPresent(row.depositFeeAgreement) ||
    isPresent(row.accumulationFeeAgreement) ||
    isPresent(row.auditReferenceDepositFee) ||
    isPresent(row.auditReferenceAccumulationFee)
  );
}

function isExcludedOrOperationOnly(row) {
  const text = normalizeText(
    [
      row.auditStatus,
      row.auditStatusHe,
      row.serviceStatus,
      row.sourceAuditStatus,
      row.marketingStatus,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    row.auditStatus === "excluded" ||
    row.isOperationOnly ||
    row.isExcludedFromFeeAudit ||
    text.includes("תפעול בלבד") ||
    text.includes("ללא שיווק")
  );
}

function hasInvestmentTrack(row) {
  return Boolean(
    normalizeTrack(row.investmentTrackRewards) ||
    normalizeTrack(row.investmentTrackCompensation)
  );
}

function hasFees(row) {
  return (
    isPresent(row.depositFee) ||
    isPresent(row.accumulationFee) ||
    isPresent(row.depositFeeAgreement) ||
    isPresent(row.accumulationFeeAgreement) ||
    isPresent(row.auditReferenceDepositFee) ||
    isPresent(row.auditReferenceAccumulationFee)
  );
}

function hasDepositOrActiveSignal(row) {
  const candidates = [
    row.monthlyDeposit,
    row.deposit,
    row.monthlyPremium,
    row.premium,
    row.totalDeposit,
    row.employerDeposit,
    row.employeeDeposit,
    row.personal_pensionSalary,
    row.pensionSalary,
    row.salary,
  ];

  const hasNumericSignal = candidates.some((value) => {
    const num = toNumber(value);
    return num !== null && num > 0;
  });

  const statusText = normalizeText(
    [
      row.status,
      row.policyStatus,
      row.productStatus,
      row.serviceStatus,
      row.sourceAuditStatus,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const hasActiveText =
    statusText.includes("פעיל") ||
    statusText.includes("פעילה") ||
    statusText.includes("בתוקף") ||
    statusText.includes("מופקד") ||
    statusText.includes("הפקדה");

  return hasNumericSignal || hasActiveText;
}

function looksLikeActiveProduct(row) {
  if (isExcludedOrOperationOnly(row)) return false;

  return (
    hasDepositOrActiveSignal(row) ||
    hasFees(row) ||
    hasAnyAgreement(row) ||
    hasInvestmentTrack(row)
  );
}

function addIssue(issues, row, issue) {
  issues.push({
    rowNumber: row.sourceRowNumber || "",
    employeeCode: row.employeeCode || row.clientId || "",
    clientName: row.personal_fullName || row.clientName || "",
    issuer: row.issuerCanonical || row.issuerOriginal || "",
    productType: row.productType || PRODUCT_TYPES.PENSION,
    productLabel: getProductLabel(row),
    accumulation: row.accumulation || 0,
    ...issue,
  });
}

function severityRank(severity) {
  const rank = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
    INFO: 3,
  };

  return rank[severity] ?? 9;
}

function buildTrackSimilarity(rows = []) {
  rows = safeRows(rows);
  const active = rows.filter((r) => !isExcludedOrOperationOnly(r));

  const withBoth = active.filter((r) => {
    const rewards = normalizeTrack(r.investmentTrackRewards);
    const compensation = normalizeTrack(r.investmentTrackCompensation);

    return rewards && compensation;
  });

  const same = withBoth.filter((r) => {
    const rewards = normalizeTrack(r.investmentTrackRewards);
    const compensation = normalizeTrack(r.investmentTrackCompensation);

    return rewards === compensation;
  });

  return {
    rowsWithBothTracks: withBoth.length,
    sameTrackRows: same.length,
    sameTrackRate: withBoth.length ? same.length / withBoth.length : 0,
  };
}

export function buildDataQuality(rows = []) {
  rows = safeRows(rows);
  const issues = [];
  const activeRows = rows.filter((r) => !isExcludedOrOperationOnly(r));
  const validationReport = buildUnifiedValidationReport(rows);

  validationReport.issues.forEach((validationIssue) => {
    issues.push({
      rowNumber: validationIssue.rowNumber || "",
      employeeCode: validationIssue.employeeCode || "",
      clientName: validationIssue.clientName || "",
      issuer: validationIssue.issuer || "",
      productType: validationIssue.productType || PRODUCT_TYPES.PENSION,
      productLabel: validationIssue.productLabel || "מוצר",
      accumulation: validationIssue.accumulation || 0,
      severity: validationIssue.severity || "INFO",
      severityLabel: validationIssue.severityLabel || "מידע",
      category: validationIssue.category || "Unified Validation",
      issueCode: validationIssue.issueCode || "UNIFIED_VALIDATION_ISSUE",
      issueLabel: validationIssue.issueLabel || "בדיקת Unified Validation",
      businessMeaning: validationIssue.businessMeaning || "נמצאה אינדיקציה הדורשת בדיקה בשכבת הנתונים המאוחדים.",
      recommendation: validationIssue.recommendation || "לבדוק את שורת המקור ואת מיפוי השדות ל־Unified Schema.",
      metadata: validationIssue.metadata || {},
    });
  });

  for (const row of rows) {
    const excluded = isExcludedOrOperationOnly(row);
    const activeLike = looksLikeActiveProduct(row);

    const employeeCode = normalizeText(row.employeeCode || row.clientId);
    const clientName = normalizeText(row.personal_fullName || row.clientName);
    const issuer = normalizeText(row.issuerCanonical || row.issuerOriginal);
    const accumulation = toNumber(row.accumulation);
    const depositFee = toNumber(row.depositFee);
    const accumulationFee = toNumber(row.accumulationFee);
    const rewardsTrack = normalizeTrack(row.investmentTrackRewards);
    const compensationTrack = normalizeTrack(row.investmentTrackCompensation);

    if (!employeeCode) {
      addIssue(issues, row, {
        severity: "HIGH",
        severityLabel: "גבוה",
        category: "זיהוי לקוח",
        issueCode: "MISSING_EMPLOYEE_CODE",
        issueLabel: "חסר קוד עובד",
        businessMeaning: "לא ניתן לחבר את השורה לעובד או לפרטים אישיים.",
        recommendation: "לבדוק מיפוי של עמודת קוד מזהה עובד בקובץ המקור.",
      });
    }

    if (!clientName && !excluded) {
      addIssue(issues, row, {
        severity: "MEDIUM",
        severityLabel: "בינוני",
        category: "זיהוי לקוח",
        issueCode: "MISSING_CLIENT_NAME",
        issueLabel: "חסר שם לקוח",
        businessMeaning: "השורה קיימת אך לא מזוהה בשם לקוח.",
        recommendation: "לבדוק את החיבור לקובץ פרטים אישיים או את עמודת שם העובד.",
      });
    }

    if ((!issuer || issuer === "לא מזוהה") && !excluded) {
      addIssue(issues, row, {
        severity: "HIGH",
        severityLabel: "גבוה",
        category: "גוף מנהל",
        issueCode: "MISSING_ISSUER",
        issueLabel: "גוף מנהל לא מזוהה",
        businessMeaning: "לא ניתן לשייך את המוצר ליצרן ולכן בקרת הסכמים ודמי ניהול עלולה להיפגע.",
        recommendation: "להוסיף alias ליצרן או לבדוק parsing של שם הקרן / הגוף המנהל.",
      });
    }

    // שינוי חשוב:
    // צבירה 0 היא בעיה רק אם המוצר נראה פעיל / רלוונטי.
    // שורות תפעול בלבד או מוצרים ללא אינדיקציה פעילות לא יסומנו כבעיה.
    if (!excluded && activeLike && (!accumulation || accumulation <= 0)) {
      addIssue(issues, row, {
        severity: "MEDIUM",
        severityLabel: "בינוני",
        category: "צבירה",
        issueCode: "ACTIVE_PRODUCT_WITH_ZERO_ACCUMULATION",
        issueLabel: "מוצר שנראה פעיל אך הצבירה חסרה או אפס",
        businessMeaning:
          "ייתכן שהמוצר באמת ללא צבירה, אך אם קיימים דמי ניהול / הסכם / מסלול השקעה — כדאי לוודא שהצבירה נקראה נכון.",
        recommendation:
          "לבדוק את עמודת סה״כ ערכי פדיון בדוח היועץ, ולוודא שלא נקראה בטעות עמודת דמי ניהול.",
      });
    }

    // מידע בלבד — לא בעיה:
    // שורה מוחרגת/תפעולית עם צבירה אפס.
    if (excluded && (!accumulation || accumulation <= 0)) {
      addIssue(issues, row, {
        severity: "INFO",
        severityLabel: "מידע",
        category: "תפעול",
        issueCode: "OPERATION_ONLY_WITH_ZERO_ACCUMULATION",
        issueLabel: "שורת תפעול / מוחרגת ללא צבירה",
        businessMeaning:
          "כנראה לא מדובר בתקלה. השורה מוחרגת מבקרת דמי ניהול ולכן צבירה אפס יכולה להיות תקינה.",
        recommendation:
          "אין צורך בפעולה, אלא אם לדעתך השורה אמורה להיות מוצר פעיל.",
      });
    }

    if (!excluded && productSupports(row, "hasDepositFee") && !isPresent(row.depositFee)) {
      addIssue(issues, row, {
        severity: "MEDIUM",
        severityLabel: "בינוני",
        category: "דמי ניהול",
        issueCode: "MISSING_DEPOSIT_FEE",
        issueLabel: "חסרים דמי ניהול מהפקדה",
        businessMeaning: "לא ניתן לבדוק באופן מלא אם דמי הניהול מהפקדה עומדים בהסכם.",
        recommendation: "לבדוק parsing של עמודת דמי ניהול מפרמיה באחוזים.",
      });
    }

    if (!excluded && productSupports(row, "hasAccumulationFee") && !isPresent(row.accumulationFee)) {
      addIssue(issues, row, {
        severity: "MEDIUM",
        severityLabel: "בינוני",
        category: "דמי ניהול",
        issueCode: "MISSING_ACCUMULATION_FEE",
        issueLabel: "חסרים דמי ניהול מצבירה",
        businessMeaning: "לא ניתן לבדוק באופן מלא אם דמי הניהול מצבירה עומדים בהסכם.",
        recommendation: "לבדוק parsing של עמודת דמי ניהול מצבירה באחוזים.",
      });
    }

    if (productSupports(row, "hasDepositFee") && depositFee !== null && depositFee > 6) {
      addIssue(issues, row, {
        severity: "HIGH",
        severityLabel: "גבוה",
        category: "דמי ניהול",
        issueCode: "SUSPICIOUS_DEPOSIT_FEE",
        issueLabel: "דמי ניהול מהפקדה נראים חריגים",
        businessMeaning: "ייתכן שהערך לא הומר נכון מאחוזים או שנקראה עמודה לא נכונה.",
        recommendation: "לבדוק אם הערך הגיע כדצימלי/אחוז ולוודא מיפוי עמודה.",
      });
    }

    if (productSupports(row, "hasAccumulationFee") && accumulationFee !== null && accumulationFee > 2) {
      addIssue(issues, row, {
        severity: "HIGH",
        severityLabel: "גבוה",
        category: "דמי ניהול",
        issueCode: "SUSPICIOUS_ACCUMULATION_FEE",
        issueLabel: "דמי ניהול מצבירה נראים חריגים",
        businessMeaning: "דמי ניהול מצבירה מעל 2% בדרך כלל אינם סבירים לקרן פנסיה.",
        recommendation: "לבדוק אם הערך הגיע כדצימלי/אחוז ולוודא מיפוי עמודה.",
      });
    }

    if (!excluded && productSupports(row, "hasInvestmentTracks") && !rewardsTrack) {
      addIssue(issues, row, {
        severity: "LOW",
        severityLabel: "נמוך",
        category: "מסלולי השקעה",
        issueCode: "MISSING_REWARDS_TRACK",
        issueLabel: "חסר מסלול השקעה לתגמולים",
        businessMeaning: "ניתוח מסלולי השקעה לתגמולים עלול להיות חלקי.",
        recommendation: "לבדוק עמודת שם מסלול השקעה - תגמולים.",
      });
    }

    if (!excluded && productSupports(row, "hasCompensationTrack") && !compensationTrack) {
      addIssue(issues, row, {
        severity: "LOW",
        severityLabel: "נמוך",
        category: "מסלולי השקעה",
        issueCode: "MISSING_COMPENSATION_TRACK",
        issueLabel: "חסר מסלול השקעה לפיצויים",
        businessMeaning: "ניתוח מסלולי השקעה לפיצויים עלול להיות חלקי.",
        recommendation: "לבדוק עמודת שם מסלול השקעה - פיצויים.",
      });
    }
  }

  const trackSimilarity = buildTrackSimilarity(rows);

  if (
    trackSimilarity.rowsWithBothTracks >= 10 &&
    trackSimilarity.sameTrackRate >= 0.95
  ) {
    issues.push({
      rowNumber: "",
      employeeCode: "",
      clientName: "",
      issuer: "",
      accumulation: 0,
      severity: "INFO",
      severityLabel: "מידע",
      category: "מסלולי השקעה",
      issueCode: "REWARDS_COMPENSATION_TRACKS_TOO_SIMILAR",
      issueLabel: "מסלולי תגמולים ופיצויים זהים כמעט בכל השורות",
      businessMeaning:
        "זה יכול להיות תקין אם רוב הלקוחות נמצאים באותו מסלול בשני הרכיבים. אם לא — ייתכן שמיפוי הפיצויים נלקח בטעות מעמודת תגמולים.",
      recommendation:
        "לבדוק ב־QA Trace האם תגמולים ופיצויים מגיעים משתי עמודות שונות בקובץ המקור.",
      metadata: {
        rowsWithBothTracks: trackSimilarity.rowsWithBothTracks,
        sameTrackRows: trackSimilarity.sameTrackRows,
        sameTrackRate: trackSimilarity.sameTrackRate,
      },
    });
  }

  const bySeverity = {
    HIGH: issues.filter((i) => i.severity === "HIGH").length,
    MEDIUM: issues.filter((i) => i.severity === "MEDIUM").length,
    LOW: issues.filter((i) => i.severity === "LOW").length,
    INFO: issues.filter((i) => i.severity === "INFO").length,
  };

  const byCategory = issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: {
      totalRows: rows.length,
      activeRows: activeRows.length,
      issueCount: issues.length,
      highIssues: bySeverity.HIGH,
      mediumIssues: bySeverity.MEDIUM,
      lowIssues: bySeverity.LOW,
      infoIssues: bySeverity.INFO,
      actionableIssues: bySeverity.HIGH + bySeverity.MEDIUM + bySeverity.LOW,
      trackSimilarity,
      validation: validationReport.summary,
    },
    bySeverity,
    byCategory,
    validation: validationReport,
    issues: issues.sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        String(a.category).localeCompare(String(b.category), "he")
    ),
  };
}

export default buildDataQuality;
