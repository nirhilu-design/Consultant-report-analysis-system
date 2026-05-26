// Path: src/unified/analyticsEngine.js

const MANAGEMENT_AUDIT_STATUS = {
  MODEL_A: "MODEL_A",
  MODEL_B: "MODEL_B",
  TIER: "TIER",
  ACCUMULATION_FEE_ONLY: "ACCUMULATION_FEE_ONLY",
  BASELINE: "BASELINE",
  INVALID: "INVALID",
  EXCLUDED: "EXCLUDED",
};

const MANAGEMENT_AUDIT_LABELS = {
  [MANAGEMENT_AUDIT_STATUS.MODEL_A]: "תקין לפי מודל א",
  [MANAGEMENT_AUDIT_STATUS.MODEL_B]: "תקין לפי מודל ב",
  [MANAGEMENT_AUDIT_STATUS.TIER]: "תקין לפי מודל צבירות גבוהות / מדרגה",
  [MANAGEMENT_AUDIT_STATUS.ACCUMULATION_FEE_ONLY]: "תקין לפי מצבירה מאושרת",
  [MANAGEMENT_AUDIT_STATUS.BASELINE]: "תקין לפי כלל בסיס ללא הסדר",
  [MANAGEMENT_AUDIT_STATUS.INVALID]: "ד.נ תקולים",
  [MANAGEMENT_AUDIT_STATUS.EXCLUDED]: "הוחרגו - תפעול בלבד / חסר מידע",
};

function emptyIssuerRow(key, label, issuers) {
  const row = {
    key,
    label,
  };

  issuers.forEach((issuer) => {
    row[issuer] = 0;
  });

  return row;
}

export function buildDrilldownKey({
  issuer,
  statusKey,
}) {
  return `${statusKey}__${issuer}`;
}

export function getManagementAuditStatusKey(row) {
  if (
    row.isExcludedFromFeeAudit ||
    row.auditStatus === "excluded"
  ) {
    return MANAGEMENT_AUDIT_STATUS.EXCLUDED;
  }

  if (row.auditStatus === "invalid") {
    return MANAGEMENT_AUDIT_STATUS.INVALID;
  }

  if (row.auditMatchRuleType === "WITHOUT_AGREEMENT") {
    return MANAGEMENT_AUDIT_STATUS.BASELINE;
  }

  if (row.auditMatchRuleType === "ACCUMULATION_FEE_ONLY") {
    return MANAGEMENT_AUDIT_STATUS.ACCUMULATION_FEE_ONLY;
  }

  if (
    /צביר|מדרג|MIN_ACCUMULATION|MAX_ACCUMULATION/.test(
      `${row.auditMatchModelName || ""} ${row.auditMatchRuleType || ""}`
    )
  ) {
    return MANAGEMENT_AUDIT_STATUS.TIER;
  }

  if (/מודל\s*ב|model\s*b/i.test(row.auditMatchModelName || "")) {
    return MANAGEMENT_AUDIT_STATUS.MODEL_B;
  }

  if (row.auditStatus === "valid") {
    return MANAGEMENT_AUDIT_STATUS.MODEL_A;
  }

  return null;
}

export function buildManagementFeesAudit(unifiedRows = []) {
  const issuers = Array.from(
    new Set(unifiedRows.map((row) => row.issuerCanonical || "לא מזוהה"))
  ).sort((a, b) => a.localeCompare(b, "he"));

  const rows = {
    matchModelA: emptyIssuerRow(
      MANAGEMENT_AUDIT_STATUS.MODEL_A,
      MANAGEMENT_AUDIT_LABELS[MANAGEMENT_AUDIT_STATUS.MODEL_A],
      issuers
    ),

    matchModelB: emptyIssuerRow(
      MANAGEMENT_AUDIT_STATUS.MODEL_B,
      MANAGEMENT_AUDIT_LABELS[MANAGEMENT_AUDIT_STATUS.MODEL_B],
      issuers
    ),

    matchTier: emptyIssuerRow(
      MANAGEMENT_AUDIT_STATUS.TIER,
      MANAGEMENT_AUDIT_LABELS[MANAGEMENT_AUDIT_STATUS.TIER],
      issuers
    ),

    matchAccumulationFee: emptyIssuerRow(
      MANAGEMENT_AUDIT_STATUS.ACCUMULATION_FEE_ONLY,
      MANAGEMENT_AUDIT_LABELS[MANAGEMENT_AUDIT_STATUS.ACCUMULATION_FEE_ONLY],
      issuers
    ),

    baselineNoAgreement: emptyIssuerRow(
      MANAGEMENT_AUDIT_STATUS.BASELINE,
      MANAGEMENT_AUDIT_LABELS[MANAGEMENT_AUDIT_STATUS.BASELINE],
      issuers
    ),

    invalid: emptyIssuerRow(
      MANAGEMENT_AUDIT_STATUS.INVALID,
      MANAGEMENT_AUDIT_LABELS[MANAGEMENT_AUDIT_STATUS.INVALID],
      issuers
    ),

    excluded: emptyIssuerRow(
      MANAGEMENT_AUDIT_STATUS.EXCLUDED,
      MANAGEMENT_AUDIT_LABELS[MANAGEMENT_AUDIT_STATUS.EXCLUDED],
      issuers
    ),

    totalAudited: emptyIssuerRow(
      "TOTAL_AUDITED",
      "סה״כ נבדקו",
      issuers
    ),

    compliance: emptyIssuerRow(
      "COMPLIANCE_RATE",
      "אחוז ד.נ תקין",
      issuers
    ),
  };

  unifiedRows.forEach((row) => {
    const issuer = row.issuerCanonical || "לא מזוהה";
    const statusKey = getManagementAuditStatusKey(row);

    if (statusKey === MANAGEMENT_AUDIT_STATUS.EXCLUDED) {
      rows.excluded[issuer] += 1;
      return;
    }

    rows.totalAudited[issuer] += 1;

    if (statusKey === MANAGEMENT_AUDIT_STATUS.INVALID) {
      rows.invalid[issuer] += 1;
      return;
    }

    if (statusKey === MANAGEMENT_AUDIT_STATUS.BASELINE) {
      rows.baselineNoAgreement[issuer] += 1;
      return;
    }

    if (statusKey === MANAGEMENT_AUDIT_STATUS.ACCUMULATION_FEE_ONLY) {
      rows.matchAccumulationFee[issuer] += 1;
      return;
    }

    if (statusKey === MANAGEMENT_AUDIT_STATUS.TIER) {
      rows.matchTier[issuer] += 1;
      return;
    }

    if (statusKey === MANAGEMENT_AUDIT_STATUS.MODEL_B) {
      rows.matchModelB[issuer] += 1;
      return;
    }

    if (statusKey === MANAGEMENT_AUDIT_STATUS.MODEL_A) {
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

export function buildManagementFeesAuditDrilldown(unifiedRows = []) {
  const drilldown = {};

  unifiedRows.forEach((row) => {
    const issuer = row.issuerCanonical || "לא מזוהה";
    const statusKey = getManagementAuditStatusKey(row);

    if (!statusKey) return;

    const key = buildDrilldownKey({
      issuer,
      statusKey,
    });

    if (!drilldown[key]) {
      drilldown[key] = {
        issuer,
        statusKey,
        statusLabel: MANAGEMENT_AUDIT_LABELS[statusKey] || statusKey,
        rows: [],
      };
    }

    drilldown[key].rows.push(
      buildDrilldownRow(row)
    );
  });

  return drilldown;
}

function buildDrilldownRow(row) {
  const matchedOption =
    row.auditDetails?.matchedOption ||
    row.auditMatchedOption ||
    null;

  return {
    auditRowId: row.auditRowId,
    clientId: row.clientId || "",
    employeeId: row.employeeId || "",
    fullName: row.fullName || row.clientName || "",
    policyNumber: row.policyNumber || "",

    issuer: row.issuerCanonical || row.issuerOriginal || "לא מזוהה",
    productType: row.productType || "",

    accumulation: Number(row.accumulation || 0),
    monthlyDeposit: Number(row.monthlyDeposit || 0),

    actualAccumulationFee: Number(row.accumulationFee || 0),
    actualDepositFee: Number(row.depositFee || 0),

    approvedAccumulationFee:
      matchedOption?.approvedAccumulationFee ??
      matchedOption?.accumulationFee ??
      row.auditMatchedAccumulationFee ??
      null,

    approvedDepositFee:
      matchedOption?.approvedDepositFee ??
      matchedOption?.depositFee ??
      row.auditMatchedDepositFee ??
      null,

    auditStatus: row.auditStatus,
    auditStatusHe: row.auditStatusHe || row.auditDisplayStatus || "",
    auditModel: row.auditMatchRuleType || "",
    matchedModel: row.auditMatchModelName || matchedOption?.modelName || "",

    auditReason: row.auditReason || "",
    requiredAction: row.requiredAction || "",
    priority: row.priority || "",

    failedReasons:
      row.auditDetails?.failedReasons ||
      row.auditFailedReasons ||
      [],
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

export function buildPensionAnalytics(input = []) {
  const unifiedRows = Array.isArray(input)
    ? input
    : input?.unifiedRows || [];

  const managementAudit = buildManagementFeesAudit(unifiedRows);
  const managementFeesAuditDrilldown =
    buildManagementFeesAuditDrilldown(unifiedRows);

  return {
    kpi: buildKpi(unifiedRows),
    managementAudit,
    managementFeesAudit: managementAudit,
    managementFeesAuditDrilldown,
    insuranceTrackMarital: buildInsuranceTrackMarital(unifiedRows),
    investmentTrackRewardsIssuer: buildInvestmentTrackRewardsIssuer(unifiedRows),
    investmentTrackCompensationIssuer: buildInvestmentTrackCompensationIssuer(unifiedRows),
    accumulationTierAnalysis: buildAccumulationTierAnalysis(unifiedRows),
    actionDrilldown: buildActionCenter(unifiedRows),
    actionCenter: buildActionCenter(unifiedRows),
  };
}
