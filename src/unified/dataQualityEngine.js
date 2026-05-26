// Path: src/unified/dataQualityEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// DATA QUALITY ENGINE — בקרת איכות נתונים
//
// המטרה:
// לזהות בעיות DATA לפני שהן הופכות לבעיה עסקית בטבלאות:
//   - חסר קוד עובד
//   - חסר שם לקוח
//   - יצרן לא מזוהה
//   - צבירה חסרה / אפס
//   - דמי ניהול חסרים
//   - מסלול תגמולים חסר
//   - מסלול פיצויים חסר
//   - מסלול תגמולים ופיצויים זהים בצורה חשודה
//   - דמי ניהול חריגים מספרית
// ─────────────────────────────────────────────────────────────────────────────

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

function addIssue(issues, row, issue) {
  issues.push({
    rowNumber: row.sourceRowNumber || "",
    employeeCode: row.employeeCode || row.clientId || "",
    clientName: row.personal_fullName || row.clientName || "",
    issuer: row.issuerCanonical || row.issuerOriginal || "",
    accumulation: row.accumulation || 0,
    ...issue,
  });
}

function severityRank(severity) {
  const rank = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
  };

  return rank[severity] ?? 9;
}

function buildTrackSimilarity(rows = []) {
  const active = rows.filter((r) => r.auditStatus !== "excluded");

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
  const issues = [];
  const active = rows.filter((r) => r.auditStatus !== "excluded");

  for (const row of rows) {
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
        category: "IDENTITY",
        issueCode: "MISSING_EMPLOYEE_CODE",
        issueLabel: "חסר קוד עובד",
        recommendation: "לבדוק מיפוי עמודת קוד מזהה של העובד בקובץ המקור",
      });
    }

    if (!clientName) {
      addIssue(issues, row, {
        severity: "MEDIUM",
        category: "IDENTITY",
        issueCode: "MISSING_CLIENT_NAME",
        issueLabel: "חסר שם לקוח",
        recommendation: "לבדוק חיבור לקובץ פרטים אישיים או עמודת שם בדוח היועץ",
      });
    }

    if (!issuer || issuer === "לא מזוהה") {
      addIssue(issues, row, {
        severity: "HIGH",
        category: "ISSUER",
        issueCode: "MISSING_ISSUER",
        issueLabel: "יצרן לא מזוהה",
        recommendation: "להוסיף alias ליצרן או לבדוק parsing של שם הקרן / היצרן",
      });
    }

    if (!accumulation || accumulation <= 0) {
      addIssue(issues, row, {
        severity: "MEDIUM",
        category: "ACCUMULATION",
        issueCode: "MISSING_OR_ZERO_ACCUMULATION",
        issueLabel: "צבירה חסרה או אפס",
        recommendation: "לבדוק שעמודת סה״כ ערכי פדיון נקראת נכון ולא נלקחת מעמודת דמי ניהול",
      });
    }

    if (row.auditStatus !== "excluded" && !isPresent(row.depositFee)) {
      addIssue(issues, row, {
        severity: "MEDIUM",
        category: "FEES",
        issueCode: "MISSING_DEPOSIT_FEE",
        issueLabel: "חסרים דמי ניהול מהפקדה",
        recommendation: "לבדוק parsing של עמודת דמי ניהול מפרמיה באחוזים",
      });
    }

    if (row.auditStatus !== "excluded" && !isPresent(row.accumulationFee)) {
      addIssue(issues, row, {
        severity: "MEDIUM",
        category: "FEES",
        issueCode: "MISSING_ACCUMULATION_FEE",
        issueLabel: "חסרים דמי ניהול מצבירה",
        recommendation: "לבדוק parsing של עמודת דמי ניהול מצבירה באחוזים",
      });
    }

    if (depositFee !== null && depositFee > 6) {
      addIssue(issues, row, {
        severity: "HIGH",
        category: "FEES",
        issueCode: "SUSPICIOUS_DEPOSIT_FEE",
        issueLabel: "דמי ניהול מהפקדה חריגים",
        recommendation: "ייתכן שהערך לא הומר נכון מאחוז/דצימלי או שהעמודה לא נכונה",
      });
    }

    if (accumulationFee !== null && accumulationFee > 2) {
      addIssue(issues, row, {
        severity: "HIGH",
        category: "FEES",
        issueCode: "SUSPICIOUS_ACCUMULATION_FEE",
        issueLabel: "דמי ניהול מצבירה חריגים",
        recommendation: "ייתכן שהערך לא הומר נכון מאחוז/דצימלי או שהעמודה לא נכונה",
      });
    }

    if (row.auditStatus !== "excluded" && !rewardsTrack) {
      addIssue(issues, row, {
        severity: "LOW",
        category: "INVESTMENT_TRACKS",
        issueCode: "MISSING_REWARDS_TRACK",
        issueLabel: "חסר מסלול תגמולים",
        recommendation: "לבדוק עמודת שם מסלול השקעה - תגמולים",
      });
    }

    if (row.auditStatus !== "excluded" && !compensationTrack) {
      addIssue(issues, row, {
        severity: "LOW",
        category: "INVESTMENT_TRACKS",
        issueCode: "MISSING_COMPENSATION_TRACK",
        issueLabel: "חסר מסלול פיצויים",
        recommendation: "לבדוק עמודת שם מסלול השקעה - פיצויים",
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
      severity: "MEDIUM",
      category: "INVESTMENT_TRACKS",
      issueCode: "REWARDS_COMPENSATION_TRACKS_TOO_SIMILAR",
      issueLabel: "מסלולי תגמולים ופיצויים זהים כמעט בכל השורות",
      recommendation:
        "אם זה לא צפוי עסקית, לבדוק האם pensionFundParser ממפה בטעות את פיצויים מאותה עמודה של תגמולים",
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
  };

  const byCategory = issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: {
      totalRows: rows.length,
      activeRows: active.length,
      issueCount: issues.length,
      highIssues: bySeverity.HIGH,
      mediumIssues: bySeverity.MEDIUM,
      lowIssues: bySeverity.LOW,
      trackSimilarity,
    },
    bySeverity,
    byCategory,
    issues: issues.sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        String(a.category).localeCompare(String(b.category), "he")
    ),
  };
}

export default buildDataQuality;
