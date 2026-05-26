// Path: src/unified/analyticsEngine.js

function accumulationBucket(v) {
  if (!v) return "לא צוין";
  if (v < 50_000)  return "0-50K";
  if (v < 100_000) return "50K-100K";
  if (v < 300_000) return "100K-300K";
  if (v < 500_000) return "300K-500K";
  return "500K+";
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

export function buildKpi(rows = []) {
  const audited  = rows.filter((r) => r.auditStatus !== "excluded");
  const valid    = audited.filter((r) => r.auditStatus === "valid");
  const invalid  = audited.filter((r) => r.auditStatus === "invalid");
  const excluded = rows.filter((r) => r.auditStatus === "excluded");
  const tier     = rows.filter((r) => r.tierPotentialNotUsed);
  const noAgree  = audited.filter((r) => !r.agreementIssuerFound);

  return {
    totalRows:         rows.length,
    auditedRows:       audited.length,
    validRows:         valid.length,
    invalidRows:       invalid.length,
    excludedRows:      excluded.length,
    noAgreementRows:   noAgree.length,
    tierPotentialRows: tier.length,
    actionItems:       invalid.length + tier.length,
    complianceRate:    audited.length ? valid.length / audited.length : 0,
    totalAccumulation: audited.reduce((s, r) => s + (r.accumulation || 0), 0),
  };
}

// ─── Management Fees Audit ────────────────────────────────────────────────────

export function buildManagementFeesAudit(rows = []) {
  const issuers = [...new Set(rows.map((r) => r.issuerCanonical || "לא מזוהה"))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "he"));

  const init = () => Object.fromEntries(issuers.map((i) => [i, 0]));
  const counts = {
    valid:      init(), invalid: init(), excluded: init(),
    tier:       init(), total:   init(), compliance: init(),
  };

  for (const row of rows) {
    const iss = row.issuerCanonical || "לא מזוהה";
    if (row.auditStatus === "excluded") { counts.excluded[iss]++; continue; }
    counts.total[iss]++;
    if (row.auditStatus === "valid")    counts.valid[iss]++;
    if (row.auditStatus === "invalid")  counts.invalid[iss]++;
    if (row.tierPotentialNotUsed)       counts.tier[iss]++;
  }
  for (const iss of issuers) {
    const t = counts.total[iss];
    counts.compliance[iss] = t > 0 ? counts.valid[iss] / t : null;
  }

  const LABELS = [
    { key: "valid",      label: "תקין" },
    { key: "invalid",    label: "לא תקין" },
    { key: "excluded",   label: "תפעול בלבד" },
    { key: "tier",       label: "Tier Potential" },
    { key: "total",      label: "סה\"כ נבדקו" },
    { key: "compliance", label: "% עמידה" },
  ];

  return {
    issuers,
    rows: LABELS.map(({ key, label }) => ({ key, label, ...counts[key] })),
  };
}

// ─── Insurance Track × Marital Status ────────────────────────────────────────

export function buildInsuranceTrackMarital(rows = []) {
  const active = rows.filter((r) => r.auditStatus !== "excluded");
  const maritalVals = [...new Set(active.map((r) =>
    r.personal_maritalStatus || r.maritalStatus || "לא צוין"
  ))].filter(Boolean).sort((a, b) => a.localeCompare(b, "he"));

  const tracks = [...new Set(active.map((r) => r.insuranceTrack || "לא צוין"))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "he"));

  const matrixRows = tracks.map((track) => {
    const item = { "מסלול ביטוח": track };
    let total = 0;
    for (const m of maritalVals) {
      const count = active.filter(
        (r) => (r.insuranceTrack || "לא צוין") === track &&
               (r.personal_maritalStatus || r.maritalStatus || "לא צוין") === m
      ).length;
      item[m] = count;
      total += count;
    }
    item["סה\"כ"] = total;
    return item;
  }).sort((a, b) => b["סה\"כ"] - a["סה\"כ"]);

  return { columns: maritalVals, rows: matrixRows };
}

// ─── Investment Track × Marital Status (Rewards + Compensation separate) ─────
// תיקון: ציר X = מצב משפחתי, חלוקה לתגמולים ופיצויים בנפרד

function buildInvestmentMatrix(rows, trackGetter, rowLabel) {
  const active = rows.filter((r) => r.auditStatus !== "excluded");
  const maritalVals = [...new Set(active.map((r) =>
    r.personal_maritalStatus || r.maritalStatus || "לא צוין"
  ))].filter(Boolean).sort((a, b) => a.localeCompare(b, "he"));

  const tracks = [...new Set(active.map(trackGetter))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "he"));

  const matrixRows = tracks.map((track) => {
    const item = { [rowLabel]: track };
    let total = 0;
    for (const m of maritalVals) {
      const count = active.filter(
        (r) => trackGetter(r) === track &&
               (r.personal_maritalStatus || r.maritalStatus || "לא צוין") === m
      ).length;
      item[m] = count;
      total += count;
    }
    item["סה\"כ"] = total;
    return item;
  }).sort((a, b) => b["סה\"כ"] - a["סה\"כ"]);

  return { columns: maritalVals, rows: matrixRows };
}

export function buildInvestmentTrackRewardsMarital(rows = []) {
  return buildInvestmentMatrix(
    rows,
    (r) => r.investmentTrackRewards || "ללא מסלול",
    "מסלול השקעה תגמולים"
  );
}

export function buildInvestmentTrackCompensationMarital(rows = []) {
  return buildInvestmentMatrix(
    rows,
    (r) => r.investmentTrackCompensation || "ללא מסלול",
    "מסלול השקעה פיצויים"
  );
}

// ─── Accumulation Tier Analysis ───────────────────────────────────────────────
// תיקון: רק עמודות רלוונטיות — מי שיש לו מודל גבוה

export function buildAccumulationTierAnalysis(rows = []) {
  const BUCKETS = ["0-50K", "50K-100K", "100K-300K", "300K-500K", "500K+", "לא צוין"];
  const audited = rows.filter((r) => r.auditStatus !== "excluded");

  return BUCKETS.map((bucket) => {
    const inBucket    = audited.filter((r) => accumulationBucket(r.accumulation) === bucket);
    const withTier    = inBucket.filter((r) => r.hasTierModel);
    const eligible    = inBucket.filter((r) => r.eligibleForTier);
    const inTier      = inBucket.filter((r) => r.inTierModel);
    const unused      = inBucket.filter((r) => r.tierPotentialNotUsed);

    // הצג שורה רק אם יש מישהו עם מודל גבוה באותה מדרגה
    return {
      "מדרגת צבירה":       bucket,
      "סה\"כ פוליסות":     inBucket.length,
      "יש מודל גבוה":      withTier.length,
      "זכאי למודל גבוה":   eligible.length,
      "נמצא במודל גבוה":   inTier.length,
      "פוטנציאל לא מנוצל": unused.length,
      _hasAny: withTier.length > 0,
    };
  }).filter((r) => r._hasAny || r["סה\"כ פוליסות"] > 0);
}

// ─── Action Center ────────────────────────────────────────────────────────────

export function buildActionCenter(rows = []) {
  return rows
    .filter((r) =>
      r.auditStatus !== "excluded" &&
      (r.auditStatus === "invalid" || r.tierPotentialNotUsed)
    )
    .map((r) => ({
      employeeCode:            r.employeeCode || "",
      clientName:              r.personal_fullName || r.clientName || "",
      issuer:                  r.issuerCanonical || r.issuerOriginal || "",
      accumulation:            r.accumulation || 0,
      depositFee:              r.depositFee ?? null,
      accumulationFee:         r.accumulationFee ?? null,
      approvedDepositFee:      r.auditReferenceDepositFee ?? null,
      approvedAccumulationFee: r.auditReferenceAccumulationFee ?? null,
      auditStatus:             r.auditStatus,
      auditStatusHe:           r.auditStatusHe || "",
      issueCategory:           r.issueCategory || "",
      requiredAction:          r.requiredAction || "",
      priority:                r.priority || "",
      tierPotentialNotUsed:    r.tierPotentialNotUsed || false,
      auditReason:             r.auditReason || "",
    }))
    .sort((a, b) => ({ HIGH: 0, MEDIUM: 1, "": 2 }[a.priority] ?? 2) -
                    ({ HIGH: 0, MEDIUM: 1, "": 2 }[b.priority] ?? 2));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function buildPensionAnalytics(rows = []) {
  const managementAudit = buildManagementFeesAudit(rows);
  return {
    kpi:                      buildKpi(rows),
    managementAudit,
    managementFeesAudit:      managementAudit,
    insuranceTrackMarital:    buildInsuranceTrackMarital(rows),
    // שני tabs נפרדים לתגמולים ופיצויים
    investmentTrackRewardsMarital:      buildInvestmentTrackRewardsMarital(rows),
    investmentTrackCompensationMarital: buildInvestmentTrackCompensationMarital(rows),
    // alias ישן לתאימות
    investmentTrackRewardsIssuer:       buildInvestmentTrackRewardsMarital(rows),
    accumulationTierAnalysis:           buildAccumulationTierAnalysis(rows),
    actionDrilldown:                    buildActionCenter(rows),
    actionCenter:                       buildActionCenter(rows),
  };
}
