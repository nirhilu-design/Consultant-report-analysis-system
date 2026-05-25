import {
  buildUnifiedAudit,
  buildManagementFeesAudit,
  buildActionDrilldown,
  buildAccumulationTierAnalysis,
  buildInvestmentTrackAccumulation,
} from "../audit/buildUnifiedAudit";

import { PRODUCT_TYPES } from "../config/productConfigs";

function emptyManagerMap(managerColumns) {
  return managerColumns.reduce((acc, manager) => {
    acc[manager] = 0;
    return acc;
  }, {});
}

function formatLegacyManagementFees(managementAudit) {
  const managerColumns = managementAudit.issuers || [];

  const managementFees = {
    valid: emptyManagerMap(managerColumns),
    invalid: emptyManagerMap(managerColumns),
    total: emptyManagerMap(managerColumns),

    matchModelA: emptyManagerMap(managerColumns),
    matchModelB: emptyManagerMap(managerColumns),
    matchTier: emptyManagerMap(managerColumns),
    matchAccumulationFee: emptyManagerMap(managerColumns),
    baselineNoAgreement: emptyManagerMap(managerColumns),

    over500k: emptyManagerMap(managerColumns),
    highAccumulationTrack: emptyManagerMap(managerColumns),
    totalFocus: emptyManagerMap(managerColumns),
  };

  (managementAudit.rows || []).forEach((row) => {
    managerColumns.forEach((issuer) => {
      if (row.label === "תקין לפי מודל א") {
        managementFees.matchModelA[issuer] = row[issuer] || 0;
        managementFees.valid[issuer] += row[issuer] || 0;
      }

      if (row.label === "תקין לפי מודל ב") {
        managementFees.matchModelB[issuer] = row[issuer] || 0;
        managementFees.valid[issuer] += row[issuer] || 0;
      }

      if (row.label === "תקין לפי מודל צבירות / מדרגה") {
        managementFees.matchTier[issuer] = row[issuer] || 0;
        managementFees.valid[issuer] += row[issuer] || 0;
      }

      if (row.label === "תקין לפי מצבירה מאושרת") {
        managementFees.matchAccumulationFee[issuer] = row[issuer] || 0;
        managementFees.valid[issuer] += row[issuer] || 0;
      }

      if (row.label === "תקין לפי כלל בסיס ללא הסדר") {
        managementFees.baselineNoAgreement[issuer] = row[issuer] || 0;
        managementFees.valid[issuer] += row[issuer] || 0;
      }

      if (row.label === "ד.נ תקולים") {
        managementFees.invalid[issuer] = row[issuer] || 0;
      }

      if (row.label === "סה״כ נבדקו") {
        managementFees.total[issuer] = row[issuer] || 0;
      }
    });
  });

  return managementFees;
}

function buildInsurancePath(unifiedRows, managerColumns) {
  const labels = Array.from(
    new Set(
      unifiedRows.map((row) => row.insuranceTrack || "מסלול ביטוח לא צוין")
    )
  ).sort((a, b) => a.localeCompare(b, "he"));

  const insurancePath = {};
  const insurancePathTotals = {};
  const insuranceManagerTotals = emptyManagerMap(managerColumns);

  labels.forEach((label) => {
    insurancePath[label] = emptyManagerMap(managerColumns);
    insurancePathTotals[label] = 0;
  });

  unifiedRows.forEach((row) => {
    const label = row.insuranceTrack || "מסלול ביטוח לא צוין";
    const issuer = row.issuerCanonical || "לא מזוהה";

    if (!insurancePath[label]) {
      insurancePath[label] = emptyManagerMap(managerColumns);
      insurancePathTotals[label] = 0;
    }

    if (!insurancePath[label][issuer]) {
      insurancePath[label][issuer] = 0;
    }

    insurancePath[label][issuer] += 1;
    insurancePathTotals[label] += 1;

    if (insuranceManagerTotals[issuer] === undefined) {
      insuranceManagerTotals[issuer] = 0;
    }

    insuranceManagerTotals[issuer] += 1;
  });

  return {
    insuranceRows: labels,
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

  const { unifiedRows, agreementOptionsByIssuer } = buildUnifiedAudit({
    rows: pensionRows,
    agreements,
    broker,
    productType,
    issuerAliases,
  });

  const managementAudit = buildManagementFeesAudit(unifiedRows);
  const managerColumns = managementAudit.issuers;

  const managementFees = formatLegacyManagementFees(managementAudit);

  const validFeePolicies = unifiedRows.filter((row) => row.auditStatus === "valid").length;
  const invalidFeePolicies = unifiedRows.filter((row) => row.auditStatus === "invalid").length;
  const noAgreementPolicies = unifiedRows.filter((row) => !row.agreementIssuerFound).length;

  const noAgreementDetails = Array.from(
    new Set(
      unifiedRows
        .filter((row) => !row.agreementIssuerFound)
        .map((row) => row.issuerCanonical)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "he"));

  const insurance = buildInsurancePath(unifiedRows, managerColumns);

  const actionDrilldown = buildActionDrilldown(unifiedRows);
  const accumulationTierAnalysis = buildAccumulationTierAnalysis(unifiedRows);
  const investmentTrackAccumulation = buildInvestmentTrackAccumulation(unifiedRows);

  return {
    // Legacy fields used by existing Dashboard.jsx
    managerColumns,

    totalPolicies: unifiedRows.length,
    validFeePolicies,
    invalidFeePolicies,
    noAgreementPolicies,
    noAgreementDetails,

    insurancePath: insurance.insurancePath,
    insurancePathTotals: insurance.insurancePathTotals,
    insuranceManagerTotals: insurance.insuranceManagerTotals,

    managementFees,

    // New outputs for next dashboard steps
    unifiedRows,
    managementAudit,
    actionDrilldown,
    accumulationTierAnalysis,
    investmentTrackAccumulation,
    agreementOptionsByIssuer,
  };
}
