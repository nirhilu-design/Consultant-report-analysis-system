// Path: src/unified/analyticsEngine.js

function safeRows(rows) {
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

function toSafeNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value)
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function accumulationBucket(v) {
  const num = toSafeNumber(v);
  if (!num || num <= 0) return "לא צוין";
  if (num < 50_000)  return "0-50K";
  if (num < 100_000) return "50K-100K";
  if (num < 300_000) return "100K-300K";
  if (num < 500_000) return "300K-500K";
  return "500K+";
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

function normalizeTrack(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
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

// ─── KPI ──────────────────────────────────────────────────────────────────────

export function buildKpi(rows = []) {
  rows = safeRows(rows);
  const audited  = rows.filter((r) => r.auditStatus !== "excluded");
  const valid    = audited.filter((r) => r.auditStatus === "valid");
  const invalid  = audited.filter((r) => r.auditStatus === "invalid");
  const excluded = rows.filter((r) => r.auditStatus === "excluded");
  const tier     = rows.filter((r) => r.tierPotentialNotUsed);
  const noAgree  = audited.filter((r) => !hasAnyAgreement(r));

  return {
    totalRows:         rows.length,
    auditedRows:       audited.length,
    validRows:         valid.length,
    invalidRows:       invalid.length,
    excludedRows:      excluded.length,
    noAgreementRows:   noAgree.length,
    tierPotentialRows: tier.length,
    actionItems:       invalid.length + tier.length + noAgree.length,
    complianceRate:    audited.length ? valid.length / audited.length : 0,
    totalAccumulation: audited.reduce((s, r) => s + toSafeNumber(r.accumulation), 0),
  };
}

// ─── Management Fees Audit ────────────────────────────────────────────────────

export function buildManagementFeesAudit(rows = []) {
  rows = safeRows(rows);
  const issuers = [...new Set(rows.map((r) => r.issuerCanonical || "לא מזוהה"))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "he"));

  const init = () => Object.fromEntries(issuers.map((i) => [i, 0]));

  const counts = {
    valid:       init(),
    invalid:     init(),
    excluded:    init(),
    noAgreement: init(),
    tier:        init(),
    total:       init(),
    compliance:  init(),
  };

  for (const row of rows) {
    const iss = row.issuerCanonical || "לא מזוהה";

    if (row.auditStatus === "excluded") {
      counts.excluded[iss]++;
      continue;
    }

    counts.total[iss]++;

    if (row.auditStatus === "valid") counts.valid[iss]++;
    if (row.auditStatus === "invalid") counts.invalid[iss]++;
    if (!hasAnyAgreement(row)) counts.noAgreement[iss]++;
    if (row.tierPotentialNotUsed) counts.tier[iss]++;
  }

  for (const iss of issuers) {
    const t = counts.total[iss];
    counts.compliance[iss] = t > 0 ? counts.valid[iss] / t : null;
  }

  const LABELS = [
    { key: "valid",       label: "תקין" },
    { key: "invalid",     label: "לא תקין" },
    { key: "excluded",    label: "תפעול בלבד" },
    { key: "noAgreement", label: "ללא הסכם" },
    { key: "tier",        label: "פוטנציאל מודל צבירה" },
    { key: "total",       label: "סה\"כ נבדקו" },
    { key: "compliance",  label: "% עמידה" },
  ];

  return {
    issuers,
    rows: LABELS.map(({ key, label }) => ({
      key,
      label,
      ...counts[key],
    })),
  };
}

// ─── Insurance Track × Marital Status ────────────────────────────────────────

export function buildInsuranceTrackMarital(rows = []) {
  rows = safeRows(rows);
  const active = rows.filter((r) => r.auditStatus !== "excluded");

  const maritalVals = [...new Set(active.map((r) =>
    r.personal_maritalStatus || r.maritalStatus || "לא צוין"
  ))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "he"));

  const tracks = [...new Set(active.map((r) =>
    r.insuranceTrack || "לא צוין"
  ))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "he"));

  const matrixRows = tracks
    .map((track) => {
      const item = { "מסלול ביטוח": track };
      let total = 0;

      for (const m of maritalVals) {
        const count = active.filter(
          (r) =>
            (r.insuranceTrack || "לא צוין") === track &&
            (r.personal_maritalStatus || r.maritalStatus || "לא צוין") === m
        ).length;

        item[m] = count;
        total += count;
      }

      item["סה\"כ"] = total;
      return item;
    })
    .sort((a, b) => b["סה\"כ"] - a["סה\"כ"]);

  return {
    columns: maritalVals,
    rows: matrixRows,
  };
}

// ─── Investment Track Summary ─────────────────────────────────────────────────

function buildInvestmentTrackSummary(rows, trackGetter, rowLabel) {
  rows = safeRows(rows);
  const active = rows.filter((r) => r.auditStatus !== "excluded");
  const byTrack = new Map();

  for (const row of active) {
    const track = normalizeTrack(trackGetter(row)) || "ללא מסלול";

    if (!byTrack.has(track)) {
      byTrack.set(track, {
        [rowLabel]: track,
        "כמות פוליסות": 0,
        "כמות עובדים": 0,
        "סך צבירה": 0,
        _employees: new Set(),
      });
    }

    const item = byTrack.get(track);
    item["כמות פוליסות"] += 1;
    item["סך צבירה"] += toSafeNumber(row.accumulation);

    if (row.employeeCode || row.clientId) {
      item._employees.add(row.employeeCode || row.clientId);
    }
  }

  return [...byTrack.values()]
    .map((item) => {
      const { _employees, ...clean } = item;
      return {
        ...clean,
        "כמות עובדים": _employees.size,
      };
    })
    .sort((a, b) => b["סך צבירה"] - a["סך צבירה"]);
}

function buildInvestmentTrackComparison(rows = []) {
  rows = safeRows(rows);
  const active = rows.filter((r) => r.auditStatus !== "excluded");
  const byEmployee = new Map();

  for (const row of active) {
    const employeeKey = row.employeeCode || row.clientId || row.personal_fullName || row.clientName;
    if (!employeeKey) continue;

    if (!byEmployee.has(employeeKey)) {
      byEmployee.set(employeeKey, {
        employeeCode: row.employeeCode || row.clientId || "",
        clientName: row.personal_fullName || row.clientName || "",
        rewardsTracks: new Set(),
        compensationTracks: new Set(),
        accumulation: 0,
        policies: 0,
      });
    }

    const item = byEmployee.get(employeeKey);

    const rewardsTrack = normalizeTrack(row.investmentTrackRewards);
    const compensationTrack = normalizeTrack(row.investmentTrackCompensation);

    if (rewardsTrack && rewardsTrack !== "ללא מסלול") {
      item.rewardsTracks.add(rewardsTrack);
    }

    if (compensationTrack && compensationTrack !== "ללא מסלול") {
      item.compensationTracks.add(compensationTrack);
    }

    item.accumulation += toSafeNumber(row.accumulation);
    item.policies += 1;
  }

  const details = [...byEmployee.values()].map((item) => {
    const rewards = [...item.rewardsTracks].sort();
    const compensation = [...item.compensationTracks].sort();

    const rewardsKey = rewards.join(" | ");
    const compensationKey = compensation.join(" | ");

    let status = "missing";

    if (rewards.length && compensation.length) {
      status = rewardsKey === compensationKey ? "same" : "different";
    } else if (rewards.length && !compensation.length) {
      status = "missingCompensation";
    } else if (!rewards.length && compensation.length) {
      status = "missingRewards";
    }

    return {
      employeeCode: item.employeeCode,
      clientName: item.clientName,
      rewardsTracks: rewardsKey || "ללא מסלול",
      compensationTracks: compensationKey || "ללא מסלול",
      status,
      policies: item.policies,
      accumulation: item.accumulation,
    };
  });

  const same = details.filter((d) => d.status === "same");
  const different = details.filter((d) => d.status === "different");
  const missingCompensation = details.filter((d) => d.status === "missingCompensation");
  const missingRewards = details.filter((d) => d.status === "missingRewards");
  const missingBoth = details.filter((d) => d.status === "missing");

  return {
    totalEmployees: details.length,
    sameCount: same.length,
    differentCount: different.length,
    missingCompensationCount: missingCompensation.length,
    missingRewardsCount: missingRewards.length,
    missingBothCount: missingBoth.length,
    sameAccumulation: same.reduce((s, d) => s + d.accumulation, 0),
    differentAccumulation: different.reduce((s, d) => s + d.accumulation, 0),
    details: details.sort((a, b) => {
      const order = {
        different: 0,
        missingCompensation: 1,
        missingRewards: 2,
        same: 3,
        missing: 4,
      };

      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    }),
  };
}

export function buildInvestmentTrackRewardsMarital(rows = []) {
  return buildInvestmentTrackSummary(
    rows,
    (r) => r.investmentTrackRewards || "ללא מסלול",
    "מסלול השקעה תגמולים"
  );
}

export function buildInvestmentTrackCompensationMarital(rows = []) {
  return buildInvestmentTrackSummary(
    rows,
    (r) => r.investmentTrackCompensation || "ללא מסלול",
    "מסלול השקעה פיצויים"
  );
}

// ─── Accumulation Tier Analysis ───────────────────────────────────────────────

export function buildAccumulationTierAnalysis(rows = []) {
  rows = safeRows(rows);
  const BUCKETS = [
    "0-50K",
    "50K-100K",
    "100K-300K",
    "300K-500K",
    "500K+",
    "לא צוין",
  ];

  const audited = rows.filter((r) => r.auditStatus !== "excluded");

  return BUCKETS
    .map((bucket) => {
      const inBucket = audited.filter(
        (r) => accumulationBucket(r.accumulation) === bucket
      );

      const withTier = inBucket.filter((r) => r.hasTierModel);
      const eligible = inBucket.filter((r) => r.eligibleForTier);
      const inTier   = inBucket.filter((r) => r.inTierModel);
      const unused   = inBucket.filter((r) => r.tierPotentialNotUsed);

      return {
        "מדרגת צבירה": bucket,
        "סה\"כ פוליסות": inBucket.length,
        "יש מודל גבוה": withTier.length,
        "זכאי למודל גבוה": eligible.length,
        "נמצא במודל גבוה": inTier.length,
        "פוטנציאל לא מנוצל": unused.length,
        _hasAny: withTier.length > 0,
      };
    })
    .filter((r) => r._hasAny || r["סה\"כ פוליסות"] > 0);
}

// ─── Action Center ────────────────────────────────────────────────────────────

export function buildActionCenter(rows = []) {
  rows = safeRows(rows);
  return rows
    .filter((r) =>
      r.auditStatus !== "excluded" &&
      (
        r.auditStatus === "invalid" ||
        r.tierPotentialNotUsed ||
        !hasAnyAgreement(r)
      )
    )
    .map((r) => {
      const missingAgreement = !hasAnyAgreement(r);

      return {
        employeeCode:            r.employeeCode || "",
        clientName:              r.personal_fullName || r.clientName || "",
        issuer:                  r.issuerCanonical || r.issuerOriginal || "",
        accumulation:            r.accumulation || 0,
        depositFee:              r.depositFee ?? null,
        accumulationFee:         r.accumulationFee ?? null,
        approvedDepositFee:      r.auditReferenceDepositFee ?? r.depositFeeAgreement ?? null,
        approvedAccumulationFee: r.auditReferenceAccumulationFee ?? r.accumulationFeeAgreement ?? null,
        auditStatus:             r.auditStatus,
        auditStatusHe:           r.auditStatusHe || "",
        issueCategory:           missingAgreement ? "MISSING_AGREEMENT" : (r.issueCategory || ""),
        requiredAction:          missingAgreement
          ? "חסר הסכם דמי ניהול — יש לבדוק מול קובץ הסכמים / מנהל הסדר"
          : (r.requiredAction || ""),
        priority:                missingAgreement ? "MEDIUM" : (r.priority || ""),
        tierPotentialNotUsed:    r.tierPotentialNotUsed || false,
        auditReason:             missingAgreement
          ? "לא נמצא הסכם חיצוני ולא נמצאו דמי ניהול מאושרים מתוך דוח היועץ"
          : (r.auditReason || ""),
      };
    })
    .sort(
      (a, b) =>
        ({ HIGH: 0, MEDIUM: 1, "": 2 }[a.priority] ?? 2) -
        ({ HIGH: 0, MEDIUM: 1, "": 2 }[b.priority] ?? 2)
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function buildPensionAnalytics(rows = []) {
  rows = safeRows(rows);
  const managementAudit = buildManagementFeesAudit(rows);
  const actionCenter = buildActionCenter(rows);
  const investmentTrackComparison = buildInvestmentTrackComparison(rows);

  return {
    kpi: buildKpi(rows),

    managementAudit,
    managementFeesAudit: managementAudit,

    insuranceTrackMarital: buildInsuranceTrackMarital(rows),

    investmentTrackRewardsMarital: buildInvestmentTrackRewardsMarital(rows),
    investmentTrackCompensationMarital: buildInvestmentTrackCompensationMarital(rows),
    investmentTrackComparison,

    // alias ישן לתאימות אחורה
    investmentTrackRewardsIssuer: buildInvestmentTrackRewardsMarital(rows),

    accumulationTierAnalysis: buildAccumulationTierAnalysis(rows),

    actionDrilldown: actionCenter,
    actionCenter,
  };
}
