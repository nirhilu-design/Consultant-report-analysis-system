// REPLACE EXISTING FILE
// Path: src/parsers/buildPensionSummary.js

import {
  buildUnifiedAudit,
  buildManagementFeesAudit,
  buildActionDrilldown,
  buildAccumulationTierAnalysis,
  buildInvestmentTrackAccumulation,
} from "../audit/buildUnifiedAudit";

import { PRODUCT_TYPES } from "../config/productConfigs";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyMap(columns) {
  return columns.reduce((acc, col) => {
    acc[col] = 0;
    return acc;
  }, {});
}

function getRawValue(row, keys = []) {
  const raw = row?.raw?.raw || row?.raw || {};

  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && normalizeText(raw[key])) {
      return raw[key];
    }
  }

  return "";
}

function getServiceStatus(row) {
  return normalizeText(
    row.serviceStatus ||
      row.raw?.serviceStatus ||
      getRawValue(row, [
        "סטטוס שיווקי",
        "סטטוס לקוח",
        "סוג שירות",
        "סטטוס טיפול",
      ])
  );
}

function getMaritalStatus(row) {
  const marital = normalizeText(
    row.maritalStatus ||
      row.raw?.maritalStatus ||
      getRawValue(row, [
        "מצב משפחתי",
        "סטטוס משפחתי",
        "מצב משפחתי עובד",
      ])
  );

  return marital || "לא צוין";
}

function getAge(row) {
  const rawAge =
    row.age ||
    row.raw?.age ||
    getRawValue(row, [
      "גיל מחושב",
      "גיל",
    ]);

  return normalizeNumber(rawAge);
}

function getInvestmentTrackRewards(row) {
  const value = normalizeText(
    row.investmentTrackRewards ||
      row.investmentTrack ||
      row.track ||
      getRawValue(row, [
        "שם מסלול השקעה - תגמולים",
        " שם מסלול השקעה - תגמולים",
        "מסלול השקעה תגמולים",
        "מסלול תגמולים",
      ])
  );

  return value || "מסלול תגמולים לא צוין";
}

function getInvestmentTrackCompensation(row) {
  const value = normalizeText(
    row.investmentTrackCompensation ||
      getRawValue(row, [
        "שם מסלול השקעה - פיצויים",
        "מסלול השקעה פיצויים",
        "מסלול פיצויים",
      ])
  );

  return value || "מסלול פיצויים לא צוין";
}

function getInsuranceTrack(row) {
  const value = normalizeText(
    row.insuranceTrack ||
      row.insuranceWaiver ||
      getRawValue(row, [
        "מסלול ביטוח בקרן הפנסיה",
        "מסלול ביטוח",
        "כיסוי שארים",
        "ויתור שארים",
      ])
  );

  return value || "מסלול ביטוח לא צוין";
}

function ageBucket(age) {
  const value = Number(age);

  if (!Number.isFinite(value)) return "לא צוין";
  if (value < 30) return "עד 30";
  if (value < 40) return "30-39";
  if (value < 50) return "40-49";
  if (value < 60) return "50-59";

  return "60+";
}

function accumulationBucket(accumulation) {
  const value = Number(accumulation || 0);

  if (value < 50000) return "0-50K";
  if (value < 100000) return "50K-100K";
  if (value < 300000) return "100K-300K";
  if (value < 500000) return "300K-500K";

  return "500K+";
}

function isOperationOnly(row) {
  const service = normalizeText(row.serviceStatus || "");
  return /תפעול בלבד|ללא שיווק/.test(service);
}

function enrichUnifiedRows(unifiedRows = []) {
  return unifiedRows.map((row) => {
    const serviceStatus = getServiceStatus(row);
    const maritalStatus = getMaritalStatus(row);
    const age = getAge(row);
    const insuranceTrack = getInsuranceTrack(row);
    const investmentTrackRewards = getInvestmentTrackRewards(row);
    const investmentTrackCompensation = getInvestmentTrackCompensation(row);
    const excluded = /תפעול בלבד|ללא שיווק/.test(serviceStatus);

    return {
      ...row,
      serviceStatus,
      maritalStatus,
      age,
      ageBucket: ageBucket(age),
      insuranceTrack,
      investmentTrackRewards,
      investmentTrackCompensation,
      accumulationBucket: accumulationBucket(row.accumulation),
      isExcludedFromFeeAudit: excluded,
      auditDisplayStatus:
        excluded ? "הוחרג" : row.auditStatusHe,
    };
  });
}

function buildPensionManagementFeesAudit(unifiedRows = []) {
  const auditedRows = unifiedRows.filter((row) => !row.isExcludedFromFeeAudit);

  const issuers = Array.from(
    new Set(unifiedRows.map((row) => row.issuerCanonical || "לא מזוהה"))
  ).sort((a, b) => a.localeCompare(b, "he"));

  const rows = {
    matchModelA: { label: "תקין לפי מודל א" },
    matchModelB: { label: "תקין לפי מודל ב" },
    matchTier: { label: "תקין לפי מודל צבירות גבוהות / מדרגה" },
    matchAccumulationFee: { label: "תקין לפי מצבירה מאושרת" },
    baselineNoAgreement: { label: "תקין לפי כלל בסיס ללא הסדר" },
    invalid: { label: "ד.נ תקולים" },
    excluded: { label: "הוחרגו - תפעול בלבד / חסר מידע" },
    totalAudited: { label: "סה״כ נבדקו" },
    compliance: { label: "אחוז ד.נ תקין" },
  };

  Object.keys(rows).forEach((key) => {
    issuers.forEach((issuer) => {
      rows[key][issuer] = 0;
    });
  });

  unifiedRows.forEach((row) => {
    const issuer = row.issuerCanonical || "לא מזוהה";

    if (row.isExcludedFromFeeAudit) {
      rows.excluded[issuer] += 1;
      return;
    }

    rows.totalAudited[issuer] += 1;

    if (row.auditStatus === "invalid") {
      rows.invalid[issuer] += 1;
      return;
    }

    if (row.auditMatchRuleType === "WITHOUT_AGREEMENT") {
      rows.baselineNoAgreement[issuer] += 1;
      return;
    }

    if (row.auditMatchRuleType === "ACCUMULATION_FEE_ONLY") {
      rows.matchAccumulationFee[issuer] += 1;
      return;
    }

    if (/ב|B/i.test(row.auditMatchModelName || "")) {
      rows.matchModelB[issuer] += 1;
      return;
    }

    if (/צביר|מדרג|MIN_ACCUMULATION|MAX_ACCUMULATION/.test(
      `${row.auditMatchModelName || ""} ${row.auditMatchRuleType || ""}`
    )) {
      rows.matchTier[issuer] += 1;
      return;
    }

    if (row.auditStatus === "valid") {
      rows.matchModelA[issuer] += 1;
    }
  });

  issuers.forEach((issuer) => {
    const valid =
      rows.matchModelA[issuer] +
      rows.matchModelB[issuer] +
      rows.matchTier[issuer] +
      rows.matchAccumulationFee[issuer] +
      rows.baselineNoAgreement[issuer];

    const total = rows.totalAudited[issuer];

    rows.compliance[issuer] = total ? valid / total : 0;
  });

  return {
    issuers,
    rows: Object.values(rows),
  };
}

function buildMatrix({
  rows,
  rowGetter,
  colGetter,
  rowLabelName,
  totalLabel = "סה״כ",
}) {
  const rowKeys = Array.from(
    new Set(rows.map(rowGetter).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "he"));

  const colKeys = Array.from(
    new Set(rows.map(colGetter).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "he"));

  const output = rowKeys.map((rowKey) => {
    const item = {
      [rowLabelName]: rowKey,
    };

    colKeys.forEach((colKey) => {
      item[colKey] = 0;
    });

    item[totalLabel] = 0;

    return item;
  });

  const byRow = new Map(output.map((item) => [item[rowLabelName], item]));

  rows.forEach((row) => {
    const rowKey = rowGetter(row);
    const colKey = colGetter(row);

    if (!rowKey || !colKey || !byRow.has(rowKey)) return;

    byRow.get(rowKey)[colKey] += 1;
    byRow.get(rowKey)[totalLabel] += 1;
  });

  return {
    columns: colKeys,
    rows: output.sort((a, b) => b[totalLabel] - a[totalLabel]),
  };
}

function buildInsuranceTrackMarital(unifiedRows = []) {
  return buildMatrix({
    rows: unifiedRows,
    rowGetter: (row) => row.insuranceTrack || "מסלול ביטוח לא צוין",
    colGetter: (row) => row.maritalStatus || "לא צוין",
    rowLabelName: "מסלול ביטוח",
  });
}

function buildInvestmentTrackIssuer(unifiedRows = [], trackType = "rewards") {
  return buildMatrix({
    rows: unifiedRows,
    rowGetter: (row) =>
      trackType === "compensation"
        ? row.investmentTrackCompensation || "מסלול פיצויים לא צוין"
        : row.investmentTrackRewards || "מסלול תגמולים לא צוין",
    colGetter: (row) => row.issuerCanonical || "לא מזוהה",
    rowLabelName:
      trackType === "compensation"
        ? "מסלול השקעה פיצויים"
        : "מסלול השקעה תגמולים",
  });
}

function buildAccumulationTierPension(unifiedRows = []) {
  const buckets = ["0-50K", "50K-100K", "100K-300K", "300K-500K", "500K+"];

  return buckets.map((bucket) => {
    const rows = unifiedRows.filter((row) => row.accumulationBucket === bucket);

    return {
      "מדרגת צבירה": bucket,
      "כמות לקוחות": rows.length,
      "סך צבירה": rows.reduce((sum, row) => sum + Number(row.accumulation || 0), 0),
      "קיים מודל צבירות גבוהות": rows.filter((row) => row.hasTierModel).length,
      "נמצאים בפועל במודל צבירות גבוהות": rows.filter((row) => row.actualInTierModel).length,
      "פוטנציאל שלא מומש": rows.filter((row) => row.tierPotentialNotUsed).length,
    };
  });
}

function buildActionCenter(unifiedRows = []) {
  return unifiedRows
    .filter((row) => {
      return (
        row.auditStatus === "invalid" ||
        !row.agreementIssuerFound ||
        row.tierPotentialNotUsed
      );
    })
    .map((row) => {
      let issueCategory = row.issueCategory;
      let requiredAction = row.requiredAction;
      let priority = row.priority;

      if (row.tierPotentialNotUsed && row.auditStatus !== "invalid") {
        issueCategory = "LARGE_BALANCE_NOT_OPTIMIZED";
        requiredAction = "לבחון מעבר למודל צבירות גבוהות / מדרגה מוזלת";
        priority = "MEDIUM";
      }

      return {
        ...row,
        issueCategory,
        requiredAction,
        priority,
      };
    });
}

function buildKpi(unifiedRows = []) {
  const audited = unifiedRows.filter((row) => !row.isExcludedFromFeeAudit);
  const valid = audited.filter((row) => row.auditStatus === "valid").length;
  const invalid = audited.filter((row) => row.auditStatus === "invalid").length;
  const noAgreement = audited.filter((row) => !row.agreementIssuerFound).length;
  const tierPotential = unifiedRows.filter((row) => row.tierPotentialNotUsed).length;
  const actionItems = buildActionCenter(unifiedRows).length;

  return {
    totalRows: unifiedRows.length,
    auditedRows: audited.length,
    validRows: valid,
    invalidRows: invalid,
    excludedRows: unifiedRows.length - audited.length,
    noAgreementRows: noAgreement,
    complianceRate: audited.length ? valid / audited.length : 0,
    tierPotentialRows: tierPotential,
    actionItems,
  };
}

function buildLegacyInsurancePath(insuranceTrackMarital, managerColumns = []) {
  const insurancePath = {};
  const insurancePathTotals = {};
  const insuranceManagerTotals = emptyMap(managerColumns);

  (insuranceTrackMarital.rows || []).forEach((row) => {
    const label = row["מסלול ביטוח"];

    insurancePath[label] = emptyMap(managerColumns);
    insurancePathTotals[label] = row["סה״כ"] || 0;
  });

  return {
    insurancePath,
    insurancePathTotals,
    insuranceManagerTotals,
  };
}

export function buildPensionSummary(pensionRows = [], agreements = [], options = {}) {
  const {
    broker = {
      brokerId: "broker_001",
      brokerName: "מנהל הסדר 1",
    },
    productType = PRODUCT_TYPES.PENSION,
    issuerAliases = {},
  } = options;

  const { unifiedRows: baseUnifiedRows, agreementOptionsByIssuer } = buildUnifiedAudit({
    rows: pensionRows,
    agreements,
    broker,
    productType,
    issuerAliases,
  });

  const unifiedRows = enrichUnifiedRows(baseUnifiedRows);

  const managementAudit = buildPensionManagementFeesAudit(unifiedRows);
  const managerColumns = managementAudit.issuers;

  const insuranceTrackMarital = buildInsuranceTrackMarital(unifiedRows);
  const investmentTrackRewardsIssuer = buildInvestmentTrackIssuer(unifiedRows, "rewards");
  const investmentTrackCompensationIssuer = buildInvestmentTrackIssuer(unifiedRows, "compensation");
  const accumulationTierAnalysis = buildAccumulationTierPension(unifiedRows);
  const actionDrilldown = buildActionCenter(unifiedRows);
  const kpi = buildKpi(unifiedRows);

  const legacyInsurance = buildLegacyInsurancePath(
    insuranceTrackMarital,
    managerColumns
  );

  const validFeePolicies = kpi.validRows;
  const invalidFeePolicies = kpi.invalidRows;
  const noAgreementPolicies = kpi.noAgreementRows;

  const noAgreementDetails = Array.from(
    new Set(
      unifiedRows
        .filter((row) => !row.agreementIssuerFound)
        .map((row) => row.issuerCanonical)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "he"));

  return {
    managerColumns,

    totalPolicies: unifiedRows.length,
    validFeePolicies,
    invalidFeePolicies,
    noAgreementPolicies,
    noAgreementDetails,

    insurancePath: legacyInsurance.insurancePath,
    insurancePathTotals: legacyInsurance.insurancePathTotals,
    insuranceManagerTotals: legacyInsurance.insuranceManagerTotals,

    managementFees: {},

    unifiedRows,
    kpi,
    managementAudit,
    insuranceTrackMarital,
    investmentTrackRewardsIssuer,
    investmentTrackCompensationIssuer,
    accumulationTierAnalysis,
    actionDrilldown,
    investmentTrackAccumulation: buildInvestmentTrackAccumulation(unifiedRows),
    agreementOptionsByIssuer,
  };
}
