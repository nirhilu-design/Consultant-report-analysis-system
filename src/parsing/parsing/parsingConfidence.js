export function asArray(value) {
  return Array.isArray(value) ? value : [];
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

export function buildParsingConfidence({
  dataWorkbook,
  agreementsWorkbook,
  personalDetailsWorkbook,
  pensionRowsRaw = [],
  agreements = [],
  personalDetails,
  unifiedRows = [],
  warnings = [],
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
  const score = Math.max(0, Math.min(100, Math.round((passedWeight / totalWeight) * 100) - warningPenalty));

  return {
    score,
    status: score >= 85 ? "high" : score >= 65 ? "medium" : "low",
    checks,
    warnings: asArray(warnings),
  };
}

export function runParsingStage(stageKey, label, callback) {
  try {
    return callback();
  } catch (error) {
    console.error(`parsing stage failed: ${stageKey}`, { label, error });

    const wrapped = new Error(`ANALYSIS_STAGE_FAILED:${stageKey}`);
    wrapped.cause = error;
    wrapped.stageLabel = label;
    throw wrapped;
  }
}
