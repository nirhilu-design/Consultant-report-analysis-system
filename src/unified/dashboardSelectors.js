// Path: src/unified/dashboardSelectors.js

export function getArrangementManager(row) {
  const value =
    row?.arrangementManager ||
    row?.arrangementManagerName ||
    row?.personal_arrangementManagerName ||
    row?.raw?.arrangementManager ||
    row?.raw?.arrangementManagerName ||
    row?.raw?.["מנהל הסדר"] ||
    row?.raw?.["שם מנהל ההסדר"] ||
    "מנהל הסדר לא מזוהה";

  const text = String(value || "").trim();
  return text || "מנהל הסדר לא מזוהה";
}

export function filterRowsByManager(rows = [], managerFilter = "all") {
  if (!Array.isArray(rows)) return [];
  if (!managerFilter || managerFilter === "all") return rows;
  return rows.filter((row) => getArrangementManager(row) === managerFilter);
}

export function buildManagerBreakdown(rows = []) {
  const map = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const manager = getArrangementManager(row);
    if (!map.has(manager)) {
      map.set(manager, {
        manager,
        total: 0,
        valid: 0,
        invalid: 0,
        excluded: 0,
        accumulation: 0,
      });
    }

    const item = map.get(manager);
    item.total += 1;
    item.accumulation += Number(row?.accumulation || 0);

    if (row?.auditStatus === "valid") item.valid += 1;
    else if (row?.auditStatus === "invalid") item.invalid += 1;
    else if (row?.auditStatus === "excluded") item.excluded += 1;
  });

  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function buildManagerOptions(rows = []) {
  return buildManagerBreakdown(rows).map((item) => item.manager);
}

export function buildKpiFromRows(rows = [], actions = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeActions = Array.isArray(actions) ? actions : [];
  const totalRows = safeRows.length;
  const validRows = safeRows.filter((row) => row?.auditStatus === "valid").length;
  const invalidRows = safeRows.filter((row) => row?.auditStatus === "invalid").length;
  const excludedRows = safeRows.filter((row) => row?.auditStatus === "excluded").length;
  const auditedRows = validRows + invalidRows;
  const totalAccumulation = safeRows.reduce(
    (sum, row) => sum + Number(row?.accumulation || 0),
    0
  );

  return {
    totalRows,
    auditedRows,
    validRows,
    invalidRows,
    excludedRows,
    complianceRate: auditedRows ? validRows / auditedRows : 0,
    actionItems: safeActions.length,
    totalAccumulation,
  };
}

export function filterDataQualityByRows(dataQuality, scopedRows = [], managerFilter = "all") {
  if (!dataQuality || !managerFilter || managerFilter === "all") return dataQuality;

  const safeScopedRows = Array.isArray(scopedRows) ? scopedRows : [];
  const issues = Array.isArray(dataQuality.issues) ? dataQuality.issues : [];
  const allowedEmployeeCodes = new Set(
    safeScopedRows
      .map((row) => String(row?.employeeCode || row?.clientId || "").trim())
      .filter(Boolean)
  );
  const allowedIssuers = new Set(
    safeScopedRows
      .map((row) => String(row?.issuerCanonical || row?.issuerOriginal || "").trim())
      .filter(Boolean)
  );

  const filteredIssues = issues.filter((issue) => {
    const employeeCode = String(issue?.employeeCode || issue?.clientId || "").trim();
    const issuer = String(issue?.issuer || issue?.issuerCanonical || issue?.issuerOriginal || "").trim();

    if (employeeCode && allowedEmployeeCodes.has(employeeCode)) return true;
    if (issuer && allowedIssuers.has(issuer)) return true;

    return false;
  });

  const byCategory = filteredIssues.reduce((acc, issue) => {
    const category = issue?.category || "לא מסווג";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  return {
    ...dataQuality,
    issues: filteredIssues,
    byCategory,
    summary: {
      ...(dataQuality.summary || {}),
      issueCount: filteredIssues.length,
      highIssues: filteredIssues.filter((issue) => issue?.severity === "HIGH").length,
      mediumIssues: filteredIssues.filter((issue) => issue?.severity === "MEDIUM").length,
      lowIssues: filteredIssues.filter((issue) => issue?.severity === "LOW").length,
    },
  };
}
