// Path: src/unified/analyticsEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS ENGINE — בניית KPI, Matrices ו-Action Center
//
// קלט:  unifiedRows[] — פלט של evaluateUnifiedRows (כולל audit results)
// פלט:  אובייקט analytics מלא עם כל מה ש-Dashboard צריך
//
// תוצאות מאומתות (2025-10):
//   KPI: total=73, valid=36, invalid=3, excluded=34, tier=7, compliance=92.3%
//   Action Center: 10 פריטים
// ─────────────────────────────────────────────────────────────────────────────

// ─── Accumulation bucket ──────────────────────────────────────────────────────

function accumulationBucket(accum) {
  if (accum === null || accum === undefined) return "לא צוין";
  if (accum < 50_000)  return "0-50K";
  if (accum < 100_000) return "50K-100K";
  if (accum < 300_000) return "100K-300K";
  if (accum < 500_000) return "300K-500K";
  return "500K+";
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

export function buildKpi(unifiedRows = []) {
  const audited  = unifiedRows.filter((r) => r.auditStatus !== "excluded");
  const valid    = audited.filter((r) => r.auditStatus === "valid");
  const invalid  = audited.filter((r) => r.auditStatus === "invalid");
  const excluded = unifiedRows.filter((r) => r.auditStatus === "excluded");
  const tierPot  = unifiedRows.filter((r) => r.tierPotentialNotUsed);
  const noAgree  = audited.filter((r) => !r.agreementIssuerFound);

  return {
    totalRows:      unifiedRows.length,
    auditedRows:    audited.length,
    validRows:      valid.length,
    invalidRows:    invalid.length,
    excludedRows:   excluded.length,
    noAgreementRows: noAgree.length,
    tierPotentialRows: tierPot.length,
    actionItems:    invalid.length + tierPot.length,
    complianceRate: audited.length > 0 ? valid.length / audited.length : 0,

    // סכומי כסף
    totalAccumulation: unifiedRows
      .filter((r) => r.auditStatus !== "excluded")
      .reduce((s, r) => s + (r.accumulation || 0), 0),
  };
}

// ─── Management Fees Audit Matrix ─────────────────────────────────────────────
// טבלה: שורות = סטטוס, עמודות = יצרן

const AUDIT_ROW_KEYS = [
  { key: "valid",    label: "תקין" },
  { key: "invalid",  label: "לא תקין" },
  { key: "excluded", label: "תפעול בלבד" },
  { key: "tier",     label: "Tier Potential" },
  { key: "total",    label: "סה\"כ נבדקו" },
  { key: "compliance", label: "% עמידה" },
];

export function buildManagementFeesAudit(unifiedRows = []) {
  const issuers = [...new Set(unifiedRows.map((r) => r.issuerCanonical || "לא מזוהה"))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "he"));

  // אתחול
  const counts = {};
  for (const { key } of AUDIT_ROW_KEYS) {
    counts[key] = {};
    for (const iss of issuers) counts[key][iss] = 0;
  }

  for (const row of unifiedRows) {
    const iss = row.issuerCanonical || "לא מזוהה";
    if (row.auditStatus === "excluded") {
      counts.excluded[iss]++;
    } else {
      counts.total[iss]++;
      if (row.auditStatus === "valid")   counts.valid[iss]++;
      if (row.auditStatus === "invalid") counts.invalid[iss]++;
      if (row.tierPotentialNotUsed)      counts.tier[iss]++;
    }
  }

  // compliance rate per issuer
  for (const iss of issuers) {
    const tot = counts.total[iss];
    counts.compliance[iss] = tot > 0 ? counts.valid[iss] / tot : null;
  }

  const rows = AUDIT_ROW_KEYS.map(({ key, label }) => ({
    key,
    label,
    ...counts[key],
  }));

  return { issuers, rows };
}

// ─── Generic matrix builder ───────────────────────────────────────────────────

function buildMatrix({ rows = [], rowGetter, colGetter, rowLabel }) {
  const filteredRows = rows.filter((r) => r.auditStatus !== "excluded");

  const rowKeys = [...new Set(filteredRows.map(rowGetter).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "he"));
  const colKeys = [...new Set(filteredRows.map(colGetter).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "he"));

  const matrix = rowKeys.map((rk) => {
    const item = { [rowLabel]: rk };
    let total = 0;
    for (const ck of colKeys) {
      const count = filteredRows.filter(
        (r) => rowGetter(r) === rk && colGetter(r) === ck
      ).length;
      item[ck] = count;
      total += count;
    }
    item["סה\"כ"] = total;
    return item;
  }).sort((a, b) => b["סה\"כ"] - a["סה\"כ"]);

  return { columns: colKeys, rows: matrix };
}

// ─── Insurance Track × Marital Status ────────────────────────────────────────

export function buildInsuranceTrackMarital(unifiedRows = []) {
  return buildMatrix({
    rows: unifiedRows,
    rowGetter: (r) => r.insuranceTrack || "לא צוין",
    colGetter: (r) => r.maritalStatus  || r.personal_maritalStatus || "לא צוין",
    rowLabel:  "מסלול ביטוח",
  });
}

// ─── Investment Track × Issuer ────────────────────────────────────────────────

export function buildInvestmentTrackIssuer(unifiedRows = []) {
  return buildMatrix({
    rows: unifiedRows,
    rowGetter: (r) => r.investmentTrackRewards || "ללא מסלול",
    colGetter: (r) => r.issuerCanonical        || "לא מזוהה",
    rowLabel:  "מסלול השקעה",
  });
}

// ─── Accumulation Tier Analysis ───────────────────────────────────────────────

export function buildAccumulationTierAnalysis(unifiedRows = []) {
  const BUCKETS = ["0-50K", "50K-100K", "100K-300K", "300K-500K", "500K+", "לא צוין"];
  const audited = unifiedRows.filter((r) => r.auditStatus !== "excluded");

  return BUCKETS.map((bucket) => {
    const inBucket = audited.filter(
      (r) => accumulationBucket(r.accumulation) === bucket
    );
    return {
      "מדרגת צבירה":           bucket,
      "מספר פוליסות":          inBucket.length,
      "סך צבירה":              inBucket.reduce((s, r) => s + (r.accumulation || 0), 0),
      "יש מודל גבוה":          inBucket.filter((r) => r.hasTierModel).length,
      "זכאי למודל גבוה":       inBucket.filter((r) => r.eligibleForTier).length,
      "נמצא במודל גבוה":       inBucket.filter((r) => r.inTierModel).length,
      "פוטנציאל לא מנוצל":     inBucket.filter((r) => r.tierPotentialNotUsed).length,
    };
  });
}

// ─── Action Center ────────────────────────────────────────────────────────────
// כל הפוליסות שדורשות טיפול — invalid + tier potential

export function buildActionCenter(unifiedRows = []) {
  return unifiedRows
    .filter((r) =>
      r.auditStatus !== "excluded" &&
      (r.auditStatus === "invalid" || r.tierPotentialNotUsed)
    )
    .map((r) => ({
      employeeCode:    r.employeeCode     || "",
      clientName:      r.personal_fullName || r.clientName || "",
      issuer:          r.issuerCanonical   || r.issuerOriginal || "",
      accumulation:    r.accumulation      || 0,
      depositFee:      r.depositFee        ?? null,
      accumulationFee: r.accumulationFee   ?? null,
      auditStatus:     r.auditStatus,
      auditStatusHe:   r.auditStatusHe     || r.auditDisplayStatus || "",
      issueCategory:   r.issueCategory     || "",
      requiredAction:  r.requiredAction    || "",
      priority:        r.priority          || "",
      tierPotentialNotUsed: r.tierPotentialNotUsed || false,
      auditReason:     r.auditReason       || "",
      // reference fees from agreement
      approvedDepositFee:      r.auditReferenceDepositFee      ?? null,
      approvedAccumulationFee: r.auditReferenceAccumulationFee ?? null,
    }))
    .sort((a, b) => {
      // HIGH קודם, אחר כך MEDIUM
      const p = { HIGH: 0, MEDIUM: 1, "": 2 };
      return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
    });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildPensionAnalytics(unifiedRows = []) {
  const kpi                    = buildKpi(unifiedRows);
  const managementAudit        = buildManagementFeesAudit(unifiedRows);
  const insuranceTrackMarital  = buildInsuranceTrackMarital(unifiedRows);
  const investmentTrackIssuer  = buildInvestmentTrackIssuer(unifiedRows);
  const accumulationTierAnalysis = buildAccumulationTierAnalysis(unifiedRows);
  const actionCenter           = buildActionCenter(unifiedRows);

  return {
    kpi,
    managementAudit,
    managementFeesAudit: managementAudit,   // alias לתאימות
    insuranceTrackMarital,
    investmentTrackIssuer,
    investmentTrackRewardsIssuer: investmentTrackIssuer, // alias
    accumulationTierAnalysis,
    actionDrilldown: actionCenter,
    actionCenter,
  };
}
