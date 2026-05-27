// src/parsing/parsingConfidence.js
// CORE HARDENING v19B
// Full backward-compatible Parsing Confidence Engine
//
// Why this file exists:
// Existing project files import legacy helpers from this module:
// - asArray
// - createEmptyPersonalDetails
// - runParsingStage
// - buildParsingConfidence
//
// v19 adds a richer confidence report, but this file keeps all legacy exports
// so parseManagerFile.js and safeRowBuilder.js continue to build.

export function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function uniqueArray(value) {
  return Array.from(
    new Set(
      asArray(value)
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  );
}

export function createEmptyPersonalDetails(warning = "") {
  return {
    hasFile: false,
    rows: [],
    rawRows: [],
    clientProfiles: [],
    metadata: {
      rowCount: 0,
      warning,
    },
  };
}

export function runParsingStage(stageKey, label, callback) {
  try {
    return callback();
  } catch (error) {
    console.error(`parsing stage failed: ${stageKey}`, { label, error });

    const wrapped = new Error(`ANALYSIS_STAGE_FAILED:${stageKey}`);
    wrapped.cause = error;
    wrapped.stageKey = stageKey;
    wrapped.stageLabel = label;
    throw wrapped;
  }
}

export function isMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== "" && text !== "-" && text !== "—" && text.toLowerCase() !== "nan";
}

export function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/[₪,\s]/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const DEFAULT_REQUIRED_HEADERS = [
  "memberName",
  "idNumber",
  "policyNumber",
  "managerName",
  "productType",
  "currentBalance",
];

export const HEADER_LABELS_HE = {
  memberName: "שם מבוטח",
  idNumber: "תעודת זהות",
  policyNumber: "מספר פוליסה / חשבון",
  managerName: "גוף מנהל",
  productType: "סוג מוצר",
  currentBalance: "צבירה נוכחית",
  monthlyDeposit: "הפקדה חודשית",
  employerDeposit: "הפקדת מעסיק",
  employeeDeposit: "הפקדת עובד",
  compensationBalance: "יתרת פיצויים",
  savingsBalance: "יתרת תגמולים",
};

export function getFieldLabel(fieldName) {
  return HEADER_LABELS_HE[fieldName] || fieldName;
}

export function getConfidenceLevel(score) {
  const numericScore = Number(score || 0);

  if (numericScore >= 90) return "excellent";
  if (numericScore >= 75) return "good";
  if (numericScore >= 55) return "partial";
  return "risky";
}

export function getConfidenceStatus(score) {
  const numericScore = Number(score || 0);

  if (numericScore >= 85) return "high";
  if (numericScore >= 65) return "medium";
  return "low";
}

export function getConfidenceTitle(levelOrStatus) {
  switch (levelOrStatus) {
    case "excellent":
      return "קליטה מצוינת";
    case "good":
    case "high":
      return "קליטה תקינה";
    case "partial":
    case "medium":
      return "קליטה חלקית";
    case "risky":
    case "low":
    default:
      return "קליטה דורשת בדיקה";
  }
}

export function calculateCompletenessScore({ unifiedRows = [], requiredHeaders = DEFAULT_REQUIRED_HEADERS } = {}) {
  const rows = asArray(unifiedRows);
  const required = asArray(requiredHeaders);

  if (!rows.length) return 0;
  if (!required.length) return 100;

  let totalCells = 0;
  let filledCells = 0;

  rows.forEach((row) => {
    required.forEach((field) => {
      totalCells += 1;
      if (isMeaningfulValue(row?.[field])) filledCells += 1;
    });
  });

  if (!totalCells) return 0;
  return Math.round((filledCells / totalCells) * 100);
}

export function calculateHeaderScore({
  detectedHeaders = [],
  requiredHeaders = DEFAULT_REQUIRED_HEADERS,
  missingRequiredHeaders = [],
} = {}) {
  const required = asArray(requiredHeaders);
  if (!required.length) return 100;

  const missingCount = asArray(missingRequiredHeaders).length;
  const detectedRequiredCount = Math.max(required.length - missingCount, 0);

  return Math.round((detectedRequiredCount / required.length) * 100);
}

export function calculateRowScore({ rawRows = [], unifiedRows = [] } = {}) {
  const rawCount = asArray(rawRows).length;
  const unifiedCount = asArray(unifiedRows).length;

  if (!rawCount && !unifiedCount) return 0;
  if (!rawCount && unifiedCount) return 80;

  const ratio = Math.min(unifiedCount / rawCount, 1);
  return Math.round(ratio * 100);
}

export function buildWarnings({
  rawRows = [],
  unifiedRows = [],
  detectedHeaders = [],
  missingRequiredHeaders = [],
  aliasMatchedHeaders = [],
  invalidRows = [],
  customWarnings = [],
} = {}) {
  const warnings = [];

  const rawCount = asArray(rawRows).length;
  const unifiedCount = asArray(unifiedRows).length;
  const detectedCount = asArray(detectedHeaders).length;
  const missing = asArray(missingRequiredHeaders);
  const aliasMatches = asArray(aliasMatchedHeaders);
  const invalid = asArray(invalidRows);
  const externalWarnings = asArray(customWarnings);

  if (!rawCount) {
    warnings.push("לא נמצאו שורות מקור בקובץ.");
  }

  if (rawCount && !unifiedCount) {
    warnings.push("נמצאו שורות בקובץ, אבל לא נוצרו שורות Unified.");
  }

  if (detectedHeaders !== null && detectedHeaders !== undefined && !detectedCount) {
    warnings.push("לא זוהו כותרות מתאימות בקובץ.");
  }

  if (missing.length) {
    warnings.push(`חסרות כותרות חובה: ${missing.map(getFieldLabel).join(", ")}.`);
  }

  if (aliasMatches.length) {
    warnings.push(`חלק מהכותרות זוהו לפי Alias ולא לפי שם מדויק: ${aliasMatches.join(", ")}.`);
  }

  if (invalid.length) {
    warnings.push(`נמצאו ${invalid.length} שורות עם ערכים חריגים או חסרים.`);
  }

  externalWarnings.forEach((warning) => {
    if (warning) warnings.push(String(warning));
  });

  return uniqueArray(warnings);
}

export function buildParsingConfidenceReport(options = {}) {
  const {
    rawRows = [],
    unifiedRows = [],
    detectedHeaders = [],
    requiredHeaders = DEFAULT_REQUIRED_HEADERS,
    missingRequiredHeaders,
    aliasMatchedHeaders = [],
    invalidRows = [],
    customWarnings = [],
    managerName = "",
    fileName = "",
  } = options;

  const safeDetectedHeaders = uniqueArray(detectedHeaders);
  const safeRequiredHeaders = uniqueArray(requiredHeaders);

  const calculatedMissing = Array.isArray(missingRequiredHeaders)
    ? uniqueArray(missingRequiredHeaders)
    : safeRequiredHeaders.filter((field) => !safeDetectedHeaders.includes(field));

  const headerScore = calculateHeaderScore({
    detectedHeaders: safeDetectedHeaders,
    requiredHeaders: safeRequiredHeaders,
    missingRequiredHeaders: calculatedMissing,
  });

  const rowScore = calculateRowScore({ rawRows, unifiedRows });

  const completenessScore = calculateCompletenessScore({
    unifiedRows,
    requiredHeaders: safeRequiredHeaders,
  });

  const score = Math.round(
    headerScore * 0.4 +
    rowScore * 0.25 +
    completenessScore * 0.35
  );

  const level = getConfidenceLevel(score);
  const status = getConfidenceStatus(score);

  const warnings = buildWarnings({
    rawRows,
    unifiedRows,
    detectedHeaders: safeDetectedHeaders,
    missingRequiredHeaders: calculatedMissing,
    aliasMatchedHeaders,
    invalidRows,
    customWarnings,
  });

  return {
    version: "v19B",
    managerName,
    fileName,
    score,
    status,
    level,
    title: getConfidenceTitle(level),
    rowCount: asArray(unifiedRows).length,
    rawRowCount: asArray(rawRows).length,
    detectedHeaders: safeDetectedHeaders,
    requiredHeaders: safeRequiredHeaders,
    missingRequiredHeaders: calculatedMissing,
    aliasMatchedHeaders: uniqueArray(aliasMatchedHeaders),
    invalidRowCount: asArray(invalidRows).length,
    warnings,
    checks: [],
    metrics: {
      headerScore,
      rowScore,
      completenessScore,
    },
    summary: {
      detectedHeaderCount: safeDetectedHeaders.length,
      requiredHeaderCount: safeRequiredHeaders.length,
      missingRequiredHeaderCount: calculatedMissing.length,
      aliasMatchedHeaderCount: uniqueArray(aliasMatchedHeaders).length,
      totalBalance: asArray(unifiedRows).reduce((sum, row) => {
        return sum + safeNumber(row?.currentBalance);
      }, 0),
    },
  };
}

// Legacy public API.
// parseManagerFile.js already calls this function with workbook-level arguments.
// Keep the legacy shape: score, status, checks, warnings.
// Add v19 fields without removing old fields.
export function buildParsingConfidence({
  dataWorkbook,
  agreementsWorkbook,
  personalDetailsWorkbook,
  pensionRowsRaw = [],
  agreements = [],
  personalDetails,
  unifiedRows = [],
  warnings = [],
  detectedHeaders,
  requiredHeaders,
  missingRequiredHeaders,
  aliasMatchedHeaders,
  invalidRows,
  managerName = "",
  fileName = "",
} = {}) {
  const checks = [
    { key: "dataWorkbook", passed: Boolean(dataWorkbook?.SheetNames?.length), weight: 20 },
    { key: "agreementsWorkbook", passed: Boolean(agreementsWorkbook?.SheetNames?.length), weight: 20 },
    { key: "rawPensionRows", passed: asArray(pensionRowsRaw).length > 0, weight: 20 },
    { key: "agreements", passed: asArray(agreements).length > 0, weight: 20 },
    { key: "unifiedRows", passed: asArray(unifiedRows).length > 0, weight: 15 },
    {
      key: "personalDetails",
      passed: !personalDetailsWorkbook || Boolean(personalDetails?.hasFile || asArray(personalDetails?.clientProfiles).length),
      weight: 5,
      optional: true,
    },
  ];

  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const passedWeight = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const warningPenalty = Math.min(asArray(warnings).length * 5, 20);
  const legacyScore = Math.max(
    0,
    Math.min(100, Math.round((passedWeight / totalWeight) * 100) - warningPenalty)
  );

  const report = buildParsingConfidenceReport({
    rawRows: pensionRowsRaw,
    unifiedRows,
    detectedHeaders: detectedHeaders || [],
    requiredHeaders: requiredHeaders || [],
    missingRequiredHeaders: missingRequiredHeaders || [],
    aliasMatchedHeaders: aliasMatchedHeaders || [],
    invalidRows: invalidRows || [],
    customWarnings: warnings,
    managerName,
    fileName,
  });

  return {
    ...report,
    score: legacyScore,
    status: getConfidenceStatus(legacyScore),
    level: getConfidenceLevel(legacyScore),
    title: getConfidenceTitle(getConfidenceLevel(legacyScore)),
    checks,
    warnings: uniqueArray([...asArray(report.warnings), ...asArray(warnings)]),
    metrics: {
      ...report.metrics,
      legacyPassedWeight: passedWeight,
      legacyTotalWeight: totalWeight,
      warningPenalty,
    },
  };
}

export function createEmptyParsingConfidenceReport(extra = {}) {
  return buildParsingConfidenceReport({
    rawRows: [],
    unifiedRows: [],
    detectedHeaders: [],
    customWarnings: ["טרם בוצעה קליטה לקובץ זה."],
    ...extra,
  });
}

export function isParsingRisky(report) {
  if (!report) return true;
  return report.level === "risky" || report.status === "low" || Number(report.score || 0) < 55;
}

export function isParsingUsable(report) {
  if (!report) return false;
  return Number(report.score || 0) >= 55 && Number(report.rowCount || 0) > 0;
}

export default buildParsingConfidenceReport;
