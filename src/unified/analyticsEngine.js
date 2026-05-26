import {
  AUDIT_STATUS,
  AUDIT_MODELS,
} from "./unifiedSchema.js";

export function buildPensionAnalytics({
  unifiedRows = [],
} = {}) {
  return buildAnalytics(unifiedRows);
}

export function buildAnalytics(unifiedRows = []) {
  const rows = Array.isArray(unifiedRows)
    ? unifiedRows
    : [];

  const auditedRows = rows.filter(
    (row) => row.auditStatus !== AUDIT_STATUS.EXCLUDED
  );

  const validRows = auditedRows.filter((row) =>
    isValidAuditStatus(row.auditStatus)
  );

  const invalidRows = auditedRows.filter(
    (row) => row.auditStatus === AUDIT_STATUS.INVALID
  );

  const excludedRows = rows.filter(
    (row) => row.auditStatus === AUDIT_STATUS.EXCLUDED
  );

  const noAgreementRows = auditedRows.filter(
    (row) => row.auditModel === AUDIT_MODELS.BASELINE
  );

  const complianceRate = auditedRows.length
    ? roundPercent((validRows.length / auditedRows.length) * 100)
    : 0;

  const managementFeesAudit =
    buildManagementFeesAuditTable(auditedRows);

  return {
    kpi: {
      totalRows: rows.length,
      auditedRows: auditedRows.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      excludedRows: excludedRows.length,
      noAgreementRows: noAgreementRows.length,
      complianceRate,
    },

    managementFeesAudit,

    managementFeesAuditDrilldown:
      buildManagementFeesAuditDrilldown(auditedRows),

    investmentTrackRewards:
      buildTrackTable(rows, "investmentTrackRewards"),

    investmentTrackCompensation:
      buildTrackTable(rows, "investmentTrackCompensation"),

    insuranceTrackVsMarital:
      buildInsuranceVsMarital(rows),

    accumulationTierAnalysis:
      buildAccumulationTierAnalysis(rows),

    actionCenter:
      buildActionCenter(rows),
  };
}

function buildManagementFeesAuditTable(rows) {
  const issuers = getIssuers(rows);

  const statusRows = getManagementAuditStatusRows();

  return statusRows.map((statusRow) => {
    const result = {
      key: statusRow.key,
      label: statusRow.label,
      total: 0,
    };

    issuers.forEach((issuer) => {
      const count = rows.filter((row) =>
        rowMatchesManagementAuditStatus(row, statusRow.key) &&
        getIssuer(row) === issuer
      ).length;

      result[issuer] = count;
      result.total += count;
    });

    return result;
  });
}

function buildManagementFeesAuditDrilldown(rows) {
  const drilldown = {};

  rows.forEach((row) => {
    const issuer = getIssuer(row);
    const statusKey = getManagementAuditStatusKey(row);

    if (!issuer || !statusKey) return;

    const key = buildDrilldownKey({
      issuer,
      statusKey,
    });

    if (!drilldown[key]) {
      drilldown[key] = {
        issuer,
        statusKey,
        statusLabel:
          getManagementAuditStatusLabel(statusKey),
        rows: [],
      };
    }

    drilldown[key].rows.push(
      buildDrilldownRow(row)
    );
  });

  return drilldown;
}

export function buildDrilldownKey({
  issuer,
  statusKey,
}) {
  return `${statusKey}__${issuer}`;
}

function buildDrilldownRow(row) {
  const matchedOption =
    row.auditDetails?.matchedOption || null;

  return {
    clientId: row.clientId || "",
    employeeId: row.employeeId || "",
    fullName: row.fullName || "",
    policyNumber: row.policyNumber || "",

    issuer: getIssuer(row),
    productType: row.productType || "",

    accumulation: normalizeNumber(row.accumulation),
    monthlyDeposit: normalizeNumber(row.monthlyDeposit),

    actualAccumulationFee:
      normalizeNumber(row.accumulationFee),

    actualDepositFee:
      normalizeNumber(row.depositFee),

    auditStatus: row.auditStatus,
    auditStatusHe: row.auditStatusHe || "",
    auditModel: row.auditModel || "",
    auditReason: row.auditReason || "",

    ruleUsed:
      row.auditDetails?.ruleUsed || "",

    approvedAccumulationFee:
      matchedOption
        ? normalizeNumber(matchedOption.approvedAccumulationFee)
        : null,

    approvedDepositFee:
      matchedOption
        ? normalizeNumber(matchedOption.approvedDepositFee)
        : null,

    matchedModel:
      matchedOption?.modelName || "",

    failedReasons:
      row.auditDetails?.failedReasons || [],

    checkedOptions:
      row.auditDetails?.checkedOptions || [],
  };
}

function getManagementAuditStatusRows() {
  return [
    {
      key: "VALID_MODEL_A",
      label: "תקין לפי מודל א",
    },
    {
      key: "VALID_MODEL_B",
      label: "תקין לפי מודל ב",
    },
    {
      key: "VALID_TIER",
      label: "תקין לפי מודל צבירות גבוהות / מדרגה",
    },
    {
      key: "VALID_APPROVED_ACCUMULATION",
      label: "תקין לפי צבירה מאושרת",
    },
    {
      key: "VALID_BASELINE",
      label: "תקין לפי כלל בסיס ללא הסדר",
    },
    {
      key: "INVALID",
      label: "חריג / לא תקין",
    },
    {
      key: "EXCLUDED",
      label: "שורת תפעול בלבד / חסר מידע",
    },
    {
      key: "TOTAL_AUDITED",
      label: "סה״כ נבדקו",
    },
    {
      key: "COMPLIANCE_RATE",
      label: "אחוזי תקינות",
    },
  ];
}

function rowMatchesManagementAuditStatus(row, statusKey) {
  return getManagementAuditStatusKey(row) === statusKey;
}

function getManagementAuditStatusKey(row) {
  if (!row) return null;

  if (row.auditStatus === AUDIT_STATUS.EXCLUDED) {
    return "EXCLUDED";
  }

  if (row.auditStatus === AUDIT_STATUS.INVALID) {
    return "INVALID";
  }

  if (row.auditStatus === AUDIT_STATUS.VALID_BASELINE) {
    return "VALID_BASELINE";
  }

  if (row.auditModel === AUDIT_MODELS.MODEL_A) {
    return "VALID_MODEL_A";
  }

  if (row.auditModel === AUDIT_MODELS.MODEL_B) {
    return "VALID_MODEL_B";
  }

  if (row.auditModel === AUDIT_MODELS.TIER_MODEL) {
    return "VALID_TIER";
  }

  if (row.auditModel === "APPROVED_ACCUMULATION") {
    return "VALID_APPROVED_ACCUMULATION";
  }

  if (isValidAuditStatus(row.auditStatus)) {
    return "VALID_APPROVED_ACCUMULATION";
  }

  return null;
}

function getManagementAuditStatusLabel(statusKey) {
  const row = getManagementAuditStatusRows().find(
    (item) => item.key === statusKey
  );

  return row?.label || statusKey;
}

function buildTrackTable(rows, fieldName) {
  const grouped = {};

  rows.forEach((row) => {
    if (row.auditStatus === AUDIT_STATUS.EXCLUDED) {
      return;
    }

    const issuer = getIssuer(row);
    const track = normalizeTrackName(row[fieldName]);

    const key = `${issuer}__${track}`;

    if (!grouped[key]) {
      grouped[key] = {
        issuer,
        track,
        count: 0,
        accumulation: 0,
      };
    }

    grouped[key].count += 1;
    grouped[key].accumulation += normalizeNumber(
      row.accumulation
    );
  });

  return Object.values(grouped);
}

function buildInsuranceVsMarital(rows) {
  const grouped = {};

  rows.forEach((row) => {
    if (row.productType !== "pension") return;
    if (row.auditStatus === AUDIT_STATUS.EXCLUDED) return;

    const insuranceTrack =
      row.insuranceTrack || "ללא מסלול ביטוח";

    const maritalStatus =
      row.maritalStatus || "לא ידוע";

    const key = `${insuranceTrack}__${maritalStatus}`;

    if (!grouped[key]) {
      grouped[key] = {
        insuranceTrack,
        maritalStatus,
        count: 0,
      };
    }

    grouped[key].count += 1;
  });

  return Object.values(grouped);
}

function buildAccumulationTierAnalysis(rows) {
  const buckets = {
    "0-50K": 0,
    "50K-100K": 0,
    "100K-300K": 0,
    "300K-500K": 0,
    "500K+": 0,
    notSpecified: 0,
  };

  rows.forEach((row) => {
    if (row.auditStatus === AUDIT_STATUS.EXCLUDED) {
      return;
    }

    const value = normalizeNumber(row.accumulation);

    if (!value) {
      buckets.notSpecified += 1;
      return;
    }

    if (value < 50000) {
      buckets["0-50K"] += 1;
    } else if (value < 100000) {
      buckets["50K-100K"] += 1;
    } else if (value < 300000) {
      buckets["100K-300K"] += 1;
    } else if (value < 500000) {
      buckets["300K-500K"] += 1;
    } else {
      buckets["500K+"] += 1;
    }
  });

  return buckets;
}

function buildActionCenter(rows) {
  return rows
    .filter((row) => {
      if (row.auditStatus === AUDIT_STATUS.INVALID) {
        return true;
      }

      if (
        normalizeNumber(row.accumulation) >= 500000 &&
        row.auditModel !== AUDIT_MODELS.TIER_MODEL
      ) {
        return true;
      }

      return false;
    })
    .map((row) => ({
      clientId: row.clientId,
      fullName: row.fullName,
      policyNumber: row.policyNumber,
      issuer: getIssuer(row),
      productType: row.productType,
      accumulation: normalizeNumber(row.accumulation),
      accumulationFee: normalizeNumber(row.accumulationFee),
      depositFee: normalizeNumber(row.depositFee),
      auditStatus: row.auditStatus,
      auditModel: row.auditModel,
      auditReason: row.auditReason,
      issueCategory: row.issueCategory,
      failedReasons:
        row.auditDetails?.failedReasons || [],
    }));
}

function getIssuers(rows) {
  return [
    ...new Set(
      rows
        .map((row) => getIssuer(row))
        .filter(Boolean)
    ),
  ];
}

function getIssuer(row) {
  return (
    row?.issuerCanonical ||
    row?.issuerOriginal ||
    "לא ידוע"
  );
}

function isValidAuditStatus(status) {
  return (
    status === AUDIT_STATUS.VALID ||
    status === AUDIT_STATUS.VALID_BASELINE ||
    status === "VALID"
  );
}

function normalizeTrackName(trackName) {
  if (!trackName) {
    return "ללא מסלול השקעה";
  }

  const cleaned = String(trackName).trim();

  if (/^\d+$/.test(cleaned)) {
    return "ללא מסלול השקעה";
  }

  return cleaned;
}

function normalizeNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const parsed = Number(normalized);

  return Number.isNaN(parsed) ? 0 : parsed;
}

function roundPercent(value) {
  return Math.round(value * 10) / 10;
}
