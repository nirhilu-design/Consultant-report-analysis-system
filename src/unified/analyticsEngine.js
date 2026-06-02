// Path: src/unified/analyticsEngine.js

import {
  AUDIT_STATUS,
  PRODUCT_CONFIGS,
  PRODUCT_TYPES,
  ensureUnifiedRows,
  getProductConfig,
} from "./unifiedSchema.js";

const UNKNOWN = "לא צוין";
const NO_TRACK = "ללא מסלול";
const NO_INSURANCE_TRACK = "מסלול ביטוח לא צוין";

function safeRows(rows) {
  return ensureUnifiedRows(Array.isArray(rows) ? rows.filter(Boolean) : []);
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

function normalizeText(value, fallback = "") {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();

  return text || fallback;
}

function normalizeTrack(value) {
  return normalizeText(value, NO_TRACK);
}

function getAuditStatus(row) {
  return row?.auditStatus || "";
}

function isExcluded(row) {
  return getAuditStatus(row) === AUDIT_STATUS.EXCLUDED;
}

function isValid(row) {
  return getAuditStatus(row) === AUDIT_STATUS.VALID;
}

function isInvalid(row) {
  return getAuditStatus(row) === AUDIT_STATUS.INVALID;
}

function getProductType(row) {
  return PRODUCT_CONFIGS[row?.productType] ? row.productType : PRODUCT_TYPES.PENSION;
}

function productSupports(row, flag) {
  return Boolean(getProductConfig(getProductType(row))?.[flag]);
}

function getClientKey(row) {
  return (
    row.employeeCode ||
    row.clientId ||
    row.personal_fullName ||
    row.clientName ||
    row.policyNumber ||
    ""
  );
}

function accumulationBucket(value) {
  const num = toSafeNumber(value);
  if (!num || num <= 0) return UNKNOWN;
  if (num < 50_000) return "0-50K";
  if (num < 100_000) return "50K-100K";
  if (num < 300_000) return "100K-300K";
  if (num < 500_000) return "300K-500K";
  return "500K+";
}

function hasTierModel(row) {
  return Boolean(row.hasTierModel);
}

function isEligibleForTier(row) {
  return Boolean(row.eligibleTierModel ?? row.eligibleForTier);
}

function isInTierModel(row) {
  return Boolean(row.actualInTierModel ?? row.inTierModel);
}

function countUnique(rows, getter) {
  const values = new Set();

  for (const row of rows) {
    const value = getter(row);
    if (value) values.add(value);
  }

  return values.size;
}

function groupBy(rows, getter) {
  const map = new Map();

  for (const row of rows) {
    const key = getter(row) || UNKNOWN;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  return map;
}

export function buildDrilldownKey({ statusKey = "", issuer = "" } = {}) {
  return `${normalizeText(statusKey, "ALL")}__${normalizeText(issuer, UNKNOWN)}`;
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

export function buildKpi(rows = []) {
  rows = safeRows(rows);

  const valid = rows.filter(isValid);
  const invalid = rows.filter(isInvalid);
  const excluded = rows.filter(isExcluded);
  const audited = [...valid, ...invalid];
  const tier = audited.filter((row) => row.tierPotentialNotUsed);
  return {
    totalRows: rows.length,
    auditedRows: audited.length,
    validRows: valid.length,
    invalidRows: invalid.length,
    excludedRows: excluded.length,
    noAgreementRows: 0,
    tierPotentialRows: tier.length,
    actionItems: invalid.length + tier.length,
    complianceRate: audited.length ? valid.length / audited.length : 0,
    totalAccumulation: audited.reduce((sum, row) => sum + toSafeNumber(row.accumulation), 0),
    uniqueClients: countUnique(audited, getClientKey),
    productTypes: countUnique(audited, getProductType),
    brokerManagers: countUnique(audited, (row) => row.brokerName || row.arrangementManagerName),
  };
}

export function buildProductDistribution(rows = []) {
  rows = safeRows(rows).filter((row) => !isExcluded(row));
  const byProduct = groupBy(rows, (row) => getProductConfig(getProductType(row)).label || getProductType(row));

  return [...byProduct.entries()]
    .map(([productTypeLabel, productRows]) => ({
      productTypeLabel,
      policies: productRows.length,
      clients: countUnique(productRows, getClientKey),
      accumulation: productRows.reduce((sum, row) => sum + toSafeNumber(row.accumulation), 0),
    }))
    .sort((a, b) => b.accumulation - a.accumulation || b.policies - a.policies);
}

export function buildBrokerDistribution(rows = []) {
  rows = safeRows(rows).filter((row) => !isExcluded(row));
  const byBroker = groupBy(rows, (row) => row.brokerName || row.arrangementManagerName || UNKNOWN);

  return [...byBroker.entries()]
    .map(([brokerName, brokerRows]) => ({
      brokerName,
      policies: brokerRows.length,
      clients: countUnique(brokerRows, getClientKey),
      accumulation: brokerRows.reduce((sum, row) => sum + toSafeNumber(row.accumulation), 0),
    }))
    .sort((a, b) => b.accumulation - a.accumulation || b.policies - a.policies);
}

// ─── Management Fees Audit ────────────────────────────────────────────────────

function initCounter(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function addDrilldown(drilldown, statusKey, issuer, row) {
  const key = buildDrilldownKey({ statusKey, issuer });

  if (!drilldown[key]) {
    drilldown[key] = {
      statusKey,
      issuer,
      rows: [],
    };
  }

  drilldown[key].rows.push(row);
}

export function buildManagementFeesAudit(rows = []) {
  rows = safeRows(rows);

  const issuers = [...new Set(rows.map((row) => row.issuerCanonical || row.issuerOriginal || UNKNOWN))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "he"));

  const counts = {
    valid: initCounter(issuers),
    invalid: initCounter(issuers),
    excluded: initCounter(issuers),
    tier: initCounter(issuers),
    total: initCounter(issuers),
    compliance: initCounter(issuers),
  };

  const drilldown = {};
  const qa = {
    valid: 0,
    invalid: 0,
    excluded: 0,
    unknown: 0,
  };

  for (const row of rows) {
    const issuer = row.issuerCanonical || row.issuerOriginal || UNKNOWN;

    if (isExcluded(row)) {
      qa.excluded += 1;
      counts.excluded[issuer] += 1;
      addDrilldown(drilldown, "excluded", issuer, row);
      addDrilldown(drilldown, "EXCLUDED", issuer, row);
      continue;
    }

    if (isValid(row)) {
      qa.valid += 1;
      counts.total[issuer] += 1;
      counts.valid[issuer] += 1;
      addDrilldown(drilldown, "total", issuer, row);
      addDrilldown(drilldown, "valid", issuer, row);
      addDrilldown(drilldown, row.auditMatchRuleType || row.auditMatchResult || "VALID", issuer, row);
      if (row.tierPotentialNotUsed) {
        counts.tier[issuer] += 1;
        addDrilldown(drilldown, "tier", issuer, row);
        addDrilldown(drilldown, "TIER", issuer, row);
      }
      continue;
    }

    if (isInvalid(row)) {
      qa.invalid += 1;
      counts.total[issuer] += 1;
      counts.invalid[issuer] += 1;
      addDrilldown(drilldown, "total", issuer, row);
      addDrilldown(drilldown, "invalid", issuer, row);
      addDrilldown(drilldown, "INVALID", issuer, row);
      if (row.tierPotentialNotUsed) {
        counts.tier[issuer] += 1;
        addDrilldown(drilldown, "tier", issuer, row);
        addDrilldown(drilldown, "TIER", issuer, row);
      }
      continue;
    }

    qa.unknown += 1;
    addDrilldown(drilldown, "UNKNOWN_AUDIT_STATUS", issuer, row);

    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("UNKNOWN AUDIT STATUS", {
        auditStatus: getAuditStatus(row),
        issuer,
        row,
      });
    }
  }

  const counted = qa.valid + qa.invalid + qa.excluded;

  if ((counted !== rows.length || qa.unknown > 0) && typeof console !== "undefined" && typeof console.error === "function") {
    console.error("AUDIT COUNT MISMATCH", {
      rows: rows.length,
      counted,
      valid: qa.valid,
      invalid: qa.invalid,
      excluded: qa.excluded,
      unknown: qa.unknown,
    });
  }

  for (const issuer of issuers) {
    const total = counts.valid[issuer] + counts.invalid[issuer];
    counts.total[issuer] = total;
    counts.compliance[issuer] = total > 0 ? counts.valid[issuer] / total : null;
  }

  const labels = [
    { key: "valid", label: "תקין" },
    { key: "invalid", label: "לא תקין" },
    { key: "excluded", label: "תפעול בלבד" },
    { key: "tier", label: "פוטנציאל מודל צבירה" },
    { key: "total", label: "סה\"כ נבדקו" },
    { key: "compliance", label: "% עמידה" },
  ];

  return {
    issuers,
    rows: labels.map(({ key, label }) => ({
      key,
      label,
      ...counts[key],
    })),
    drilldown,
  };
}

// ─── Insurance Track × Marital Status ────────────────────────────────────────

export function buildInsuranceTrackMarital(rows = []) {
  rows = safeRows(rows);
  const active = rows.filter((row) => !isExcluded(row) && productSupports(row, "hasInsuranceTrack"));

  const maritalValues = [...new Set(active.map((row) => row.personal_maritalStatus || row.maritalStatus || UNKNOWN))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "he"));

  const tracks = [...new Set(active.map((row) => row.insuranceTrack || NO_INSURANCE_TRACK))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "he"));

  const matrixRows = tracks
    .map((track) => {
      const item = { "מסלול ביטוח": track };
      let total = 0;

      for (const maritalStatus of maritalValues) {
        const count = active.filter(
          (row) =>
            (row.insuranceTrack || NO_INSURANCE_TRACK) === track &&
            (row.personal_maritalStatus || row.maritalStatus || UNKNOWN) === maritalStatus
        ).length;

        item[maritalStatus] = count;
        total += count;
      }

      item["סה\"כ"] = total;
      return item;
    })
    .sort((a, b) => b["סה\"כ"] - a["סה\"כ"]);

  return {
    columns: maritalValues,
    rows: matrixRows,
  };
}

// ─── Investment Tracks ────────────────────────────────────────────────────────

function buildInvestmentTrackSummary(rows, trackGetter, rowLabel) {
  rows = safeRows(rows);
  const active = rows.filter((row) => !isExcluded(row) && productSupports(row, "hasInvestmentTracks"));
  const byTrack = new Map();

  for (const row of active) {
    const track = normalizeTrack(trackGetter(row));

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

    const clientKey = getClientKey(row);
    if (clientKey) item._employees.add(clientKey);
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
  const active = rows.filter(
    (row) =>
      !isExcluded(row) &&
      productSupports(row, "hasRewardsTrack") &&
      productSupports(row, "hasCompensationTrack")
  );

  const byClient = new Map();

  for (const row of active) {
    const clientKey = getClientKey(row);
    if (!clientKey) continue;

    if (!byClient.has(clientKey)) {
      byClient.set(clientKey, {
        employeeCode: row.employeeCode || row.clientId || "",
        clientName: row.personal_fullName || row.clientName || "",
        rewardsTracks: new Set(),
        compensationTracks: new Set(),
        accumulation: 0,
        policies: 0,
      });
    }

    const item = byClient.get(clientKey);
    const rewardsTrack = normalizeTrack(row.investmentTrackRewards);
    const compensationTrack = normalizeTrack(row.investmentTrackCompensation);

    if (rewardsTrack && rewardsTrack !== NO_TRACK) item.rewardsTracks.add(rewardsTrack);
    if (compensationTrack && compensationTrack !== NO_TRACK) item.compensationTracks.add(compensationTrack);

    item.accumulation += toSafeNumber(row.accumulation);
    item.policies += 1;
  }

  const details = [...byClient.values()].map((item) => {
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
      rewardsTracks: rewardsKey || NO_TRACK,
      compensationTracks: compensationKey || NO_TRACK,
      status,
      policies: item.policies,
      accumulation: item.accumulation,
    };
  });

  const same = details.filter((item) => item.status === "same");
  const different = details.filter((item) => item.status === "different");
  const missingCompensation = details.filter((item) => item.status === "missingCompensation");
  const missingRewards = details.filter((item) => item.status === "missingRewards");
  const missingBoth = details.filter((item) => item.status === "missing");

  return {
    totalEmployees: details.length,
    sameCount: same.length,
    differentCount: different.length,
    missingCompensationCount: missingCompensation.length,
    missingRewardsCount: missingRewards.length,
    missingBothCount: missingBoth.length,
    sameAccumulation: same.reduce((sum, item) => sum + item.accumulation, 0),
    differentAccumulation: different.reduce((sum, item) => sum + item.accumulation, 0),
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
    (row) => row.investmentTrackRewards || NO_TRACK,
    "מסלול השקעה תגמולים"
  );
}

export function buildInvestmentTrackCompensationMarital(rows = []) {
  return buildInvestmentTrackSummary(
    rows,
    (row) => row.investmentTrackCompensation || NO_TRACK,
    "מסלול השקעה פיצויים"
  );
}

// ─── Accumulation Tier Analysis ───────────────────────────────────────────────

export function buildAccumulationTierAnalysis(rows = []) {
  rows = safeRows(rows);

  const buckets = ["0-50K", "50K-100K", "100K-300K", "300K-500K", "500K+", UNKNOWN];
  const audited = rows.filter((row) => !isExcluded(row));

  return buckets
    .map((bucket) => {
      const inBucket = audited.filter((row) => accumulationBucket(row.accumulation) === bucket);
      const withTier = inBucket.filter(hasTierModel);
      const eligible = inBucket.filter(isEligibleForTier);
      const inTier = inBucket.filter(isInTierModel);
      const unused = inBucket.filter((row) => row.tierPotentialNotUsed);

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
    .filter((row) => row._hasAny || row["סה\"כ פוליסות"] > 0);
}

// ─── Action Center ────────────────────────────────────────────────────────────

export function buildActionCenter(rows = []) {
  rows = safeRows(rows);

  return rows
    .filter(
      (row) =>
        !isExcluded(row) &&
        (isInvalid(row) || row.tierPotentialNotUsed)
    )
    .map((row) => {
      const missingAgreement = false;

      return {
        employeeCode: row.employeeCode || "",
        clientName: row.personal_fullName || row.clientName || "",
        issuer: row.issuerCanonical || row.issuerOriginal || "",
        productType: getProductType(row),
        productTypeLabel: getProductConfig(getProductType(row)).label,
        accumulation: row.accumulation || 0,
        depositFee: row.depositFee ?? null,
        accumulationFee: row.accumulationFee ?? null,
        approvedDepositFee: row.auditReferenceDepositFee ?? row.depositFeeAgreement ?? null,
        approvedAccumulationFee: row.auditReferenceAccumulationFee ?? row.accumulationFeeAgreement ?? null,
        auditStatus: row.auditStatus,
        auditStatusHe: row.auditStatusHe || "",
        issueCategory: missingAgreement ? "MISSING_AGREEMENT" : row.issueCategory || "",
        requiredAction: missingAgreement
          ? "חסר הסכם דמי ניהול — יש לבדוק מול קובץ הסכמים / מנהל הסדר"
          : row.requiredAction || "",
        priority: missingAgreement ? "MEDIUM" : row.priority || "",
        tierPotentialNotUsed: row.tierPotentialNotUsed || false,
        auditReason: missingAgreement
          ? "לא נמצא הסכם חיצוני ולא נמצאו דמי ניהול מאושרים מתוך דוח היועץ"
          : row.auditReason || "",
      };
    })
    .sort(
      (a, b) =>
        ({ HIGH: 0, MEDIUM: 1, LOW: 2, "": 3 }[a.priority] ?? 3) -
        ({ HIGH: 0, MEDIUM: 1, LOW: 2, "": 3 }[b.priority] ?? 3)
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function buildUnifiedAnalytics(rows = []) {
  rows = safeRows(rows);

  const managementAudit = buildManagementFeesAudit(rows);
  const actionCenter = buildActionCenter(rows);
  const investmentTrackComparison = buildInvestmentTrackComparison(rows);

  return {
    kpi: buildKpi(rows),

    productDistribution: buildProductDistribution(rows),
    brokerDistribution: buildBrokerDistribution(rows),

    managementAudit,
    managementFeesAudit: managementAudit,
    managementFeesAuditDrilldown: managementAudit.drilldown,

    insuranceTrackMarital: buildInsuranceTrackMarital(rows),

    investmentTrackRewardsMarital: buildInvestmentTrackRewardsMarital(rows),
    investmentTrackCompensationMarital: buildInvestmentTrackCompensationMarital(rows),
    investmentTrackComparison,

    // Legacy alias for existing dashboard compatibility.
    investmentTrackRewardsIssuer: buildInvestmentTrackRewardsMarital(rows),

    accumulationTierAnalysis: buildAccumulationTierAnalysis(rows),

    actionDrilldown: actionCenter,
    actionCenter,
  };
}

export function buildPensionAnalytics(rows = []) {
  return buildUnifiedAnalytics(rows);
}
