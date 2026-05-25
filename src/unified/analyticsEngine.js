// NEW FILE
// Path: src/unified/analyticsEngine.js

function emptyIssuerRow(label, issuers) {
  const row = { label };

  issuers.forEach((issuer) => {
    row[issuer] = 0;
  });

  return row;
}

export function buildManagementFeesAudit(unifiedRows = []) {
  const issuers = Array.from(
    new Set(unifiedRows.map((row) => row.issuerCanonical || "לא מזוהה"))
  ).sort((a, b) => a.localeCompare(b, "he"));

  const rows = {
    matchModelA: emptyIssuerRow("תקין לפי מודל א", issuers),
    matchModelB: emptyIssuerRow("תקין לפי מודל ב", issuers),
    matchTier: emptyIssuerRow("תקין לפי מודל צבירות גבוהות / מדרגה", issuers),
    matchAccumulationFee: emptyIssuerRow("תקין לפי מצבירה מאושרת", issuers),
    baselineNoAgreement: emptyIssuerRow("תקין לפי כלל בסיס ללא הסדר", issuers),
    invalid: emptyIssuerRow("ד.נ תקולים", issuers),
    excluded: emptyIssuerRow("הוחרגו - תפעול בלבד / חסר מידע", issuers),
    totalAudited: emptyIssuerRow("סה״כ נבדקו", issuers),
    compliance: emptyIssuerRow("אחוז ד.נ תקין", issuers),
  };

  unifiedRows.forEach((row) => {
    const issuer = row.issuerCanonical || "לא מזוהה";

    if (
      row.isExcludedFromFeeAudit ||
      row.auditStatus === "excluded"
    ) {
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

    if (
      /צביר|מדרג|MIN_ACCUMULATION|MAX_ACCUMULATION/.test(
        `${row.auditMatchModelName || ""} ${row.auditMatchRuleType || ""}`
      )
    ) {
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

export function buildActionCenter(unifiedRows = []) {
  return unifiedRows.filter((row) => {
    return (
      row.auditStatus === "invalid" ||
      !row.agreementIssuerFound ||
      row.tierPotentialNotUsed
    ) && row.auditStatus !== "excluded";
  });
}

export function buildKpi(unifiedRows = []) {
  const audited = unifiedRows.filter(
    (row) => !row.isExcludedFromFeeAudit && row.auditStatus !== "excluded"
  );

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

export function buildMatrix({
  rows = [],
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
    const item = { [rowLabelName]: rowKey };

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

export function buildInsuranceTrackMarital(unifiedRows = []) {
  return buildMatrix({
    rows: unifiedRows,
    rowGetter: (row) => row.insuranceTrack || "מסלול ביטוח לא צוין",
    colGetter: (row) => row.maritalStatus || "לא צוין",
    rowLabelName: "מסלול ביטוח",
  });
}

export function buildInvestmentTrackRewardsIssuer(unifiedRows = []) {
  return buildMatrix({
    rows: unifiedRows,
    rowGetter: (row) => row.investmentTrackRewards || "ללא מסלול השקעה",
    colGetter: (row) => row.issuerCanonical || "לא מזוהה",
    rowLabelName: "מסלול השקעה תגמולים",
  });
}

export function buildInvestmentTrackCompensationIssuer(unifiedRows = []) {
  return buildMatrix({
    rows: unifiedRows,
    rowGetter: (row) => row.investmentTrackCompensation || "ללא מסלול השקעה",
    colGetter: (row) => row.issuerCanonical || "לא מזוהה",
    rowLabelName: "מסלול השקעה פיצויים",
  });
}

export function buildAccumulationTierAnalysis(unifiedRows = []) {
  const buckets = [
    "0-50K",
    "50K-100K",
    "100K-300K",
    "300K-500K",
    "500K+",
    "לא צוין",
  ];

  return buckets.map((bucket) => {
    const rows = unifiedRows.filter((row) => row.accumulationBucket === bucket);

    return {
      "מדרגת צבירה": bucket,
      "כמות לקוחות": rows.length,
      "סך צבירה": rows.reduce(
        (sum, row) => sum + Number(row.accumulation || 0),
        0
      ),
      "קיים מודל צבירות גבוהות": rows.filter((row) => row.hasTierModel).length,
      "נמצאים בפועל במודל צבירות גבוהות": rows.filter(
        (row) => row.actualInTierModel
      ).length,
      "פוטנציאל שלא מומש": rows.filter(
        (row) => row.tierPotentialNotUsed
      ).length,
    };
  });
}

export function buildPensionAnalytics(unifiedRows = []) {
  return {
    kpi: buildKpi(unifiedRows),
    managementAudit: buildManagementFeesAudit(unifiedRows),
    insuranceTrackMarital: buildInsuranceTrackMarital(unifiedRows),
    investmentTrackRewardsIssuer: buildInvestmentTrackRewardsIssuer(unifiedRows),
    investmentTrackCompensationIssuer: buildInvestmentTrackCompensationIssuer(unifiedRows),
    accumulationTierAnalysis: buildAccumulationTierAnalysis(unifiedRows),
    actionDrilldown: buildActionCenter(unifiedRows),
  };
}
