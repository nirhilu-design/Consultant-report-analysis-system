export function buildAnalytics(unifiedRows = []) {
  const rows = Array.isArray(unifiedRows) ? unifiedRows : [];

  const auditedRows = rows.filter((r) => r.auditStatus !== "EXCLUDED");

  const validRows = auditedRows.filter((r) =>
    String(r.auditStatus || "").startsWith("VALID")
  );

  const invalidRows = auditedRows.filter(
    (r) => r.auditStatus === "INVALID"
  );

  const noAgreementRows = auditedRows.filter(
    (r) => r.auditModel === "BASELINE"
  );

  const complianceRate = auditedRows.length
    ? ((validRows.length / auditedRows.length) * 100).toFixed(1)
    : "0.0";

  return {
    kpi: buildKpi({
      totalRows: rows.length,
      auditedRows: auditedRows.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      noAgreementRows: noAgreementRows.length,
      complianceRate,
    }),

    managementFeesAudit: buildManagementFeeAudit(auditedRows),

    investmentTrackRewards: buildTrackTable(
      rows,
      "investmentTrackRewards"
    ),

    investmentTrackCompensation: buildTrackTable(
      rows,
      "investmentTrackCompensation"
    ),

    insuranceTrackVsMarital: buildInsuranceVsMarital(rows),

    accumulationTierAnalysis: buildAccumulationTiers(rows),

    actionCenter: buildActionCenter(rows),
  };
}

function buildKpi(data) {
  return {
    totalRows: data.totalRows,
    auditedRows: data.auditedRows,
    validRows: data.validRows,
    invalidRows: data.invalidRows,
    noAgreementRows: data.noAgreementRows,
    complianceRate: data.complianceRate,
  };
}

function buildManagementFeeAudit(rows) {
  const grouped = {};

  rows.forEach((row) => {
    const issuer = row.issuerCanonical || "לא ידוע";

    if (!grouped[issuer]) {
      grouped[issuer] = {
        issuer,
        total: 0,
        valid: 0,
        invalid: 0,
      };
    }

    grouped[issuer].total += 1;

    if (String(row.auditStatus || "").startsWith("VALID")) {
      grouped[issuer].valid += 1;
    }

    if (row.auditStatus === "INVALID") {
      grouped[issuer].invalid += 1;
    }
  });

  return Object.values(grouped).map((item) => ({
    ...item,
    complianceRate: item.total
      ? ((item.valid / item.total) * 100).toFixed(1)
      : "0.0",
  }));
}

function buildTrackTable(rows, fieldName) {
  const grouped = {};

  rows.forEach((row) => {
    const issuer = row.issuerCanonical || "לא ידוע";

    const track =
      row[fieldName] &&
      !/^\d+$/.test(String(row[fieldName]).trim())
        ? row[fieldName]
        : "ללא מסלול השקעה";

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

    grouped[key].accumulation += Number(row.accumulation || 0);
  });

  return Object.values(grouped);
}

function buildInsuranceVsMarital(rows) {
  const grouped = {};

  rows.forEach((row) => {
    if (row.productType !== "pension") return;

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

function buildAccumulationTiers(rows) {
  const buckets = {
    "0-50K": 0,
    "50K-100K": 0,
    "100K-300K": 0,
    "300K-500K": 0,
    "500K+": 0,
    "notSpecified": 0,
  };

  rows.forEach((row) => {
    const value = Number(row.accumulation || 0);

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
      if (row.auditStatus === "INVALID") return true;

      if (
        Number(row.accumulation || 0) >= 500000 &&
        row.auditModel !== "TIER_MODEL"
      ) {
        return true;
      }

      return false;
    })
    .map((row) => ({
      clientId: row.clientId,
      fullName: row.fullName,
      issuer: row.issuerCanonical,
      productType: row.productType,
      accumulation: row.accumulation,
      auditStatus: row.auditStatus,
      auditModel: row.auditModel,
    }));
}
