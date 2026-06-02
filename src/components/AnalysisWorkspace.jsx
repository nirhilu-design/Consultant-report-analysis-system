// Path: src/components/AnalysisWorkspace.jsx
// V73 — Unified Dashboard Hardening
// Scope: executive home only. No parser changes and no product-screen changes.
// Goal: focused consultant dashboard with KPI, product health, data quality, managers and upload readiness.

import React, { useEffect, useMemo, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import EducationFundAnalysisView from "./EducationFundAnalysisView.jsx";
import ExecutiveInsuranceAnalysisView from "./ExecutiveInsuranceAnalysisView.jsx";
import { PRODUCT_MODES, getProductModeLabel } from "./ProductModeSelector.jsx";

const PRODUCT_LABELS = {
  [PRODUCT_MODES.PENSION]: "קרן פנסיה",
  [PRODUCT_MODES.HISHTALMUT]: "קרן השתלמות",
  [PRODUCT_MODES.EXECUTIVE_INSURANCE]: "ביטוח מנהלים",
};

const FUTURE_PRODUCTS = [
  { key: "gemel", label: "קופות גמל", description: "ניתוח קופות גמל", status: "עתידי" },
  { key: "aca", label: "אכ\"ע", description: "ניתוח כיסוי אובדן כושר עבודה", status: "עתידי" },
  { key: "meetings", label: "פגישות", description: "מעקב פגישות ולקוחות באיחור", status: "עתידי" },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/%/g, "").replace(/₪/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function fmtNumber(value) {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(toNumber(value));
}

function fmtMoney(value) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function fmtPct(value) {
  return `${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 }).format(toNumber(value))}%`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function uniqueCount(values) {
  return new Set(values.map(normalizeText).filter(Boolean)).size;
}

function getAvailableProducts(analysisData) {
  const productResults = analysisData?.productResults || {};
  const products = [];

  if (productResults[PRODUCT_MODES.PENSION] || analysisData?.pensionSummary || analysisData?.pensionRows) {
    products.push(PRODUCT_MODES.PENSION);
  }

  if (
    productResults[PRODUCT_MODES.HISHTALMUT] ||
    analysisData?.educationFundSummary ||
    analysisData?.educationFundRows ||
    analysisData?.productSummary?.productType === PRODUCT_MODES.HISHTALMUT
  ) {
    products.push(PRODUCT_MODES.HISHTALMUT);
  }

  if (
    productResults[PRODUCT_MODES.EXECUTIVE_INSURANCE] ||
    analysisData?.executiveInsuranceSummary ||
    analysisData?.executiveInsuranceRows ||
    analysisData?.productSummary?.productType === PRODUCT_MODES.EXECUTIVE_INSURANCE
  ) {
    products.push(PRODUCT_MODES.EXECUTIVE_INSURANCE);
  }

  return products.length ? products : [PRODUCT_MODES.PENSION];
}

function getArrangementManagerName(row) {
  return normalizeText(
    firstDefined(
      row?.arrangementManagerName,
      row?.uploadManagerName,
      row?.arrangementManager,
      row?.managerName,
      row?.manager,
      row?.sourceManagerName,
      row?.sourceManagerId
    )
  ) || "לא שויך";
}

function getIssuerName(row) {
  return normalizeText(
    firstDefined(
      row?.issuerCanonical,
      row?.issuerOriginal,
      row?.issuer,
      row?.companyName,
      row?.insuranceCompany,
      row?.fundManager,
      row?.manager
    )
  ) || "לא ידוע";
}

function getEmployeeKey(row) {
  return normalizeText(
    firstDefined(
      row?.employeeKey,
      row?.employeeId,
      row?.employeeCode,
      row?.workerId,
      row?.customerId,
      row?.idNumber,
      row?.tz,
      row?.memberId,
      row?.memberName,
      row?.policyNumber,
      row?.policyId,
      row?.accountNumber
    )
  );
}

function getAccumulation(row) {
  return toNumber(
    firstDefined(
      row?.accumulation,
      row?.currentBalance,
      row?.balance,
      row?.totalAccumulation,
      row?.savingBalance,
      row?.redemptionValue,
      row?.צבירה
    )
  );
}

function getMonthlyDeposit(row) {
  return toNumber(
    firstDefined(
      row?.monthlyDeposit,
      row?.lastPremium,
      row?.premium,
      row?.deposit,
      row?.totalMonthlyDeposits,
      row?.monthlyContribution
    )
  );
}

function getPensionRows(result) {
  return asArray(
    result?.pensionRows ||
      result?.pensionSummary?.unifiedRows ||
      result?.unifiedPensionPersonalData?.rows ||
      result?.unifiedEmployeeData?.rows
  );
}

function getEducationRows(result) {
  const directRows = asArray(result?.educationFundRows || result?.unifiedRows || result?.productSummary?.rows);
  if (directRows.length) return directRows;

  return asArray(result?.managerResults).flatMap((managerResult) => [
    ...asArray(managerResult?.unifiedRows),
    ...asArray(managerResult?.educationFundRows),
    ...asArray(managerResult?.rawRows),
    ...asArray(managerResult?.rowsRaw),
  ]);
}

function getExecutiveInsuranceRows(result) {
  const directRows = asArray(
    result?.executiveInsuranceRows ||
      result?.unifiedRows ||
      result?.productSummary?.rows ||
      result?.rawRows
  );
  if (directRows.length) return directRows;

  return asArray(result?.managerResults).flatMap((managerResult) => [
    ...asArray(managerResult?.executiveInsuranceRows),
    ...asArray(managerResult?.unifiedRows),
    ...asArray(managerResult?.rawRows),
    ...asArray(managerResult?.rowsRaw),
  ]);
}

function getRowsForProduct(productMode, productResult) {
  if (productMode === PRODUCT_MODES.HISHTALMUT) return getEducationRows(productResult);
  if (productMode === PRODUCT_MODES.EXECUTIVE_INSURANCE) return getExecutiveInsuranceRows(productResult);
  return getPensionRows(productResult);
}

function getProductDiagnosticsWarnings(result) {
  const diagnosticsWarnings = asArray(result?.diagnostics?.warnings);
  const managerWarnings = asArray(result?.managerResults).flatMap((managerResult) => asArray(managerResult?.warnings));
  return [...diagnosticsWarnings, ...managerWarnings].filter(Boolean);
}

function isOperatorOnly(row) {
  const status = normalizeText(firstDefined(row?.feeStatusKind, row?.feeStatus, row?.auditStatus, row?.status));
  const code = normalizeText(firstDefined(row?.feeIssueCode, row?.auditMatchRuleType, row?.auditMatchResult));
  return (
    row?.isOperatorOnly === true ||
    row?.operatorOnly === true ||
    status === "מתפעל בלבד" ||
    status === "תפעול בלבד" ||
    status === "operatorOnly" ||
    status === "operator_only" ||
    code === "operatorOnly" ||
    code === "operator_only"
  );
}

function isMissingAgreement(row) {
  const code = normalizeText(firstDefined(row?.feeIssueCode, row?.auditIssueCode, row?.issueCode, row?.auditMatchResult));
  const reason = normalizeText(firstDefined(row?.feeIssue, row?.auditReason, row?.issueLabel, row?.reason));
  return (
    row?.agreementIssuerFound === false ||
    row?.missingAgreement === true ||
    code === "missingAgreement" ||
    code === "noAgreement" ||
    code === "no_agreement" ||
    reason.includes("חסר הסכם") ||
    reason.includes("לא נמצא הסכם")
  );
}

function isMissingFeeData(row) {
  const code = normalizeText(firstDefined(row?.feeIssueCode, row?.auditIssueCode, row?.issueCode));
  return (
    row?.missingData === true ||
    row?.hasMissingCriticalData === true ||
    code === "missingData" ||
    code === "missingFeeData" ||
    code === "missing_fee_data"
  );
}

function isUnknownPeriod(row) {
  const period = normalizeText(firstDefined(row?.agreementPeriod, row?.executiveInsurancePeriod, row?.periodKey));
  return period === "unknown" || row?.unknownPeriod === true || row?.missingStartYear === true;
}

function isFeeWarning(row, productMode) {
  if (isOperatorOnly(row)) return false;
  const status = normalizeText(firstDefined(row?.calculatedFeeStatus, row?.auditStatus, row?.feeStatus, row?.status));
  const warningStatuses = ["warning", "invalid", "not_ok", "לא תקין", "חריגה", "exception"];
  if (warningStatuses.includes(status)) return true;
  if (row?.isFeeException === true) return true;
  if (productMode === PRODUCT_MODES.EXECUTIVE_INSURANCE) return isMissingAgreement(row) || isMissingFeeData(row);
  return false;
}

function isAgeTrackWarning(row) {
  const status = normalizeText(
    firstDefined(
      row?.ageTrackStatus,
      row?.trackAgeFitStatus,
      row?.ageFitStatus,
      row?.ageAnalysisStatus,
      row?.ageTrackFit?.status
    )
  );
  return ["review", "warning", "invalid", "not_ok", "לא תואם גיל", "לא תקין"].includes(status);
}

function isMissingDataRow(row) {
  return (
    !getEmployeeKey(row) ||
    !getIssuerName(row) ||
    getAccumulation(row) <= 0 ||
    row?.hasMissingCriticalData === true ||
    row?.missingData === true
  );
}

function groupBy(items, getKey, createBase) {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeText(getKey(item)) || "לא מסווג";
    if (!map.has(key)) map.set(key, createBase(key));
    const current = map.get(key);
    current.rows += 1;
    current.accumulation += getAccumulation(item);
    current.monthlyDeposits += getMonthlyDeposit(item);
    current.employeeKeys.add(getEmployeeKey(item));
    current.products.add(item.__productLabel || "-");
  });
  return [...map.values()].map((item) => ({
    ...item,
    employees: [...item.employeeKeys].filter(Boolean).length || item.rows,
    productCount: [...item.products].filter(Boolean).length,
    productLabels: [...item.products].filter(Boolean),
  }));
}

function buildProductExecutiveSummary(productMode, productResult) {
  const label = PRODUCT_LABELS[productMode] || getProductModeLabel(productMode);
  const rows = getRowsForProduct(productMode, productResult);
  const summary = productResult?.productSummary || productResult?.educationFundSummary || productResult?.pensionSummary || productResult?.executiveInsuranceSummary || {};
  const diagnosticsCounts = productResult?.diagnostics?.counts || {};
  const warnings = getProductDiagnosticsWarnings(productResult);

  const managerCount =
    toNumber(summary.managers) ||
    toNumber(diagnosticsCounts.managers) ||
    asArray(productResult?.managerResults).length ||
    uniqueCount(rows.map(getArrangementManagerName));

  const employeeCount = uniqueCount(rows.map(getEmployeeKey)) || rows.length;
  const totalAccumulation = rows.reduce((sum, row) => sum + getAccumulation(row), 0) || toNumber(summary.totalAccumulation);
  const totalMonthlyDeposits = rows.reduce((sum, row) => sum + getMonthlyDeposit(row), 0) || toNumber(summary.totalMonthlyDeposits);

  const feeWarnings = rows.filter((row) => isFeeWarning(row, productMode)).length;
  const operatorOnlyRows = rows.filter(isOperatorOnly).length;
  const missingAgreementRows = rows.filter(isMissingAgreement).length;
  const missingFeeDataRows = rows.filter(isMissingFeeData).length;
  const unknownPeriodRows = productMode === PRODUCT_MODES.EXECUTIVE_INSURANCE ? rows.filter(isUnknownPeriod).length : 0;
  const ageWarnings = productMode === PRODUCT_MODES.HISHTALMUT ? rows.filter(isAgeTrackWarning).length : 0;
  const missingDataRows = rows.filter(isMissingDataRow).length;
  const dataWarnings = warnings.length;

  const exceptionRows = rows.filter((row) => {
    if (isOperatorOnly(row)) return false;
    if (isFeeWarning(row, productMode)) return true;
    if (productMode === PRODUCT_MODES.HISHTALMUT && isAgeTrackWarning(row)) return true;
    return isMissingDataRow(row);
  }).length;

  const activeRows = Math.max(0, rows.length - exceptionRows);
  const complianceRate = rows.length ? Math.max(0, (activeRows / rows.length) * 100) : 0;

  return {
    productMode,
    label,
    managerCount,
    rowCount: rows.length,
    employeeCount,
    activeRows,
    totalAccumulation,
    totalMonthlyDeposits,
    averageAccumulation: employeeCount ? totalAccumulation / employeeCount : 0,
    exceptionRows,
    feeWarnings,
    ageWarnings,
    dataWarnings,
    missingDataRows,
    missingAgreementRows,
    missingFeeDataRows,
    unknownPeriodRows,
    operatorOnlyRows,
    issuerCount: uniqueCount(rows.map(getIssuerName)),
    complianceRate,
    rows,
  };
}

function buildExecutiveAnalytics(analysisData) {
  const productResults = analysisData?.productResults || {};
  const productSummaries = Object.entries(productResults)
    .map(([productMode, productResult]) => buildProductExecutiveSummary(productMode, productResult))
    .filter((item) => item.rowCount || item.managerCount || item.totalAccumulation || item.totalMonthlyDeposits);

  const allRows = productSummaries.flatMap((item) => item.rows.map((row) => ({ ...row, __productMode: item.productMode, __productLabel: item.label })));
  const uploadSession = analysisData?.uploadSession || analysisData?.diagnostics?.uploadSession || {};
  const uploadManagers = asArray(uploadSession?.managers);

  const managerDistribution = groupBy(
    allRows,
    getArrangementManagerName,
    (label) => ({ label, rows: 0, accumulation: 0, monthlyDeposits: 0, employeeKeys: new Set(), products: new Set() })
  ).sort((a, b) => b.accumulation - a.accumulation || b.rows - a.rows);

  const managersFromUpload = uploadManagers.map((manager) => {
    const productLabels = Object.entries(manager.products || {})
      .filter(([, product]) => product?.hasDataFile || product?.hasAgreementsFile || product?.hasPersonalDetailsFile)
      .map(([productMode]) => PRODUCT_LABELS[productMode] || getProductModeLabel(productMode));
    const existing = managerDistribution.find((item) => item.label === normalizeText(manager.name));
    return {
      label: normalizeText(manager.name) || manager.id || "מנהל הסדר",
      rows: existing?.rows || 0,
      employees: existing?.employees || 0,
      accumulation: existing?.accumulation || 0,
      productCount: productLabels.length || existing?.productCount || 0,
      productLabels: productLabels.length ? productLabels : existing?.productLabels || [],
      uploadStatus: manager.status || "draft",
    };
  });

  const managerSummary = managersFromUpload.length ? managersFromUpload : managerDistribution;
  const managerCount = managerSummary.length || uniqueCount(allRows.map(getArrangementManagerName));

  const totals = productSummaries.reduce(
    (acc, item) => {
      acc.rowCount += item.rowCount;
      acc.employeeCount += item.employeeCount;
      acc.activeRows += item.activeRows;
      acc.totalAccumulation += item.totalAccumulation;
      acc.totalMonthlyDeposits += item.totalMonthlyDeposits;
      acc.exceptionRows += item.exceptionRows;
      acc.feeWarnings += item.feeWarnings;
      acc.ageWarnings += item.ageWarnings;
      acc.dataWarnings += item.dataWarnings;
      acc.missingDataRows += item.missingDataRows;
      acc.missingAgreementRows += item.missingAgreementRows;
      acc.missingFeeDataRows += item.missingFeeDataRows;
      acc.unknownPeriodRows += item.unknownPeriodRows;
      acc.operatorOnlyRows += item.operatorOnlyRows;
      return acc;
    },
    {
      managerCount: 0,
      rowCount: 0,
      employeeCount: 0,
      activeRows: 0,
      totalAccumulation: 0,
      totalMonthlyDeposits: 0,
      exceptionRows: 0,
      feeWarnings: 0,
      ageWarnings: 0,
      dataWarnings: 0,
      missingDataRows: 0,
      missingAgreementRows: 0,
      missingFeeDataRows: 0,
      unknownPeriodRows: 0,
      operatorOnlyRows: 0,
    }
  );

  totals.managerCount = managerCount;
  const complianceRate = totals.rowCount ? Math.max(0, ((totals.rowCount - totals.exceptionRows) / totals.rowCount) * 100) : 0;

  const dataQualityItems = [
    { key: "missingAgreement", label: "חסר הסכם", count: totals.missingAgreementRows, note: "נדרש דוח הסכמים מתאים" },
    { key: "missingFeeData", label: "חסר נתון דמי ניהול", count: totals.missingFeeDataRows, note: "לא ניתן להשוות להסכם" },
    { key: "unknownPeriod", label: "תקופה לא מזוהה", count: totals.unknownPeriodRows, note: "רלוונטי בעיקר לביטוח מנהלים" },
    { key: "missingData", label: "עובדים / רשומות עם חוסר", count: totals.missingDataRows, note: "זיהוי, יצרן או צבירה" },
    { key: "operatorOnly", label: "מתפעל בלבד", count: totals.operatorOnlyRows, note: "לא נספר כחריגה" },
  ];

  const uploadReadiness = buildUploadReadiness(uploadSession, productSummaries);

  return {
    productSummaries,
    totals,
    complianceRate,
    dataQualityItems,
    managerSummary,
    uploadReadiness,
  };
}

function buildUploadReadiness(uploadSession, productSummaries) {
  const activeProductModes = new Set(productSummaries.map((item) => item.productMode));
  const overview = asArray(uploadSession?.productOverview);

  return [PRODUCT_MODES.PENSION, PRODUCT_MODES.HISHTALMUT, PRODUCT_MODES.EXECUTIVE_INSURANCE].map((productMode) => {
    const overviewItem = overview.find((item) => item.productMode === productMode) || {};
    const productSummary = productSummaries.find((item) => item.productMode === productMode);
    const readyManagers = toNumber(overviewItem.readyManagers) || (activeProductModes.has(productMode) ? productSummary?.managerCount || 1 : 0);
    const activeManagers = toNumber(overviewItem.activeManagers) || (activeProductModes.has(productMode) ? productSummary?.managerCount || 1 : 0);
    const hasProduct = activeProductModes.has(productMode);

    return {
      productMode,
      label: PRODUCT_LABELS[productMode] || getProductModeLabel(productMode),
      ready: hasProduct && readyManagers > 0,
      partial: !hasProduct && activeManagers > 0,
      readyManagers,
      activeManagers,
      rows: productSummary?.rowCount || 0,
    };
  });
}

function ExecutiveKpiCard({ label, value, subtext, tone = "neutral", icon }) {
  return (
    <article className={`executiveKpiCard v41 ${tone}`}>
      <div className="executiveKpiIcon" aria-hidden="true">{icon || "•"}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {subtext ? <small>{subtext}</small> : null}
      </div>
    </article>
  );
}

function ProductHealthCard({ item, selectedProduct, onOpenProduct }) {
  const isHealthy = item.complianceRate >= 90;
  const metricLabel = item.productMode === PRODUCT_MODES.EXECUTIVE_INSURANCE ? "פוליסות" : "עובדים";

  return (
    <button
      type="button"
      className={`unifiedProductHealthCard ${selectedProduct === item.productMode ? "active" : ""}`}
      onClick={() => onOpenProduct(item.productMode)}
    >
      <span className={`productHealthStatus ${isHealthy ? "good" : "warn"}`}>{isHealthy ? "תקין" : "דורש בדיקה"}</span>
      <strong>{item.label}</strong>
      <small>כניסה למסך המוצר והבקרות הקיימות</small>
      <div className="productHealthMetrics">
        <span><b>{fmtNumber(item.productMode === PRODUCT_MODES.EXECUTIVE_INSURANCE ? item.rowCount : item.employeeCount)}</b><em>{metricLabel}</em></span>
        <span><b>{fmtMoney(item.totalAccumulation)}</b><em>צבירה</em></span>
        <span><b>{fmtPct(item.complianceRate)}</b><em>תקינות</em></span>
        <span><b>{fmtNumber(item.exceptionRows)}</b><em>מוקדי טיפול</em></span>
      </div>
    </button>
  );
}

function ProductHealthCenter({ productSummaries, selectedProduct, onOpenProduct }) {
  const futureCards = FUTURE_PRODUCTS.map((item) => ({ ...item, enabled: false }));

  return (
    <section className="executivePanel v41 unifiedProductHealthPanel">
      <div className="executivePanelTitle">
        <h3>מוצרים פעילים</h3>
        <span>כניסה מהירה למוצר</span>
      </div>
      <div className="unifiedProductHealthGrid">
        {productSummaries.map((item) => (
          <ProductHealthCard key={item.productMode} item={item} selectedProduct={selectedProduct} onOpenProduct={onOpenProduct} />
        ))}
        {futureCards.map((item) => (
          <button type="button" key={item.key} className="unifiedProductHealthCard disabled" disabled>
            <span className="productHealthStatus future">{item.status}</span>
            <strong>{item.label}</strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function DataQualityCenter({ dataQualityItems, onOpenProduct }) {
  const hasIssues = dataQualityItems.some((item) => item.count > 0);

  return (
    <section className="executivePanel v41 dataQualityCenterPanel">
      <div className="executivePanelTitle">
        <h3>מרכז איכות נתונים</h3>
        <span>{hasIssues ? "נדרש טיפול" : "נקי"}</span>
      </div>
      <div className="executiveRiskTableWrap">
        <table className="executiveTable v41">
          <thead>
            <tr>
              <th>סוג בעיה</th>
              <th>כמות</th>
              <th>משמעות</th>
            </tr>
          </thead>
          <tbody>
            {dataQualityItems.map((item) => (
              <tr key={item.key}>
                <td><strong>{item.label}</strong></td>
                <td>{fmtNumber(item.count)}</td>
                <td>{item.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dataQualityActions">
        <button type="button" className="secondaryButton" onClick={() => onOpenProduct(PRODUCT_MODES.PENSION)}>בדיקת פנסיה</button>
        <button type="button" className="secondaryButton" onClick={() => onOpenProduct(PRODUCT_MODES.HISHTALMUT)}>בדיקת השתלמות</button>
        <button type="button" className="secondaryButton" onClick={() => onOpenProduct(PRODUCT_MODES.EXECUTIVE_INSURANCE)}>בדיקת ביטוח מנהלים</button>
      </div>
    </section>
  );
}

function ManagersSummary({ managerSummary }) {
  const rows = managerSummary.slice(0, 12);

  return (
    <section className="executivePanel v41 managersSummaryPanel">
      <div className="executivePanelTitle">
        <h3>מנהלי הסדר בטעינה</h3>
        <span>אגרגציה לפי מקור</span>
      </div>
      <div className="executiveRiskTableWrap">
        <table className="executiveTable v41">
          <thead>
            <tr>
              <th>מנהל הסדר</th>
              <th>עובדים</th>
              <th>רשומות</th>
              <th>מוצרים</th>
              <th>צבירה</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.label}>
                <td><strong>{item.label}</strong></td>
                <td>{fmtNumber(item.employees)}</td>
                <td>{fmtNumber(item.rows)}</td>
                <td>{item.productLabels?.length ? item.productLabels.join(" · ") : fmtNumber(item.productCount)}</td>
                <td>{fmtMoney(item.accumulation)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan="5">אין עדיין נתוני מנהלי הסדר להצגה.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UploadReadinessPanel({ uploadReadiness }) {
  return (
    <section className="executivePanel v41 uploadReadinessPanel">
      <div className="executivePanelTitle">
        <h3>סטטוס טעינה</h3>
        <span>לפי מוצרים</span>
      </div>
      <div className="uploadReadinessList">
        {uploadReadiness.map((item) => (
          <article key={item.productMode} className={`uploadReadinessItem ${item.ready ? "ready" : item.partial ? "partial" : "missing"}`}>
            <b>{item.ready ? "✓" : item.partial ? "!" : "–"}</b>
            <div>
              <strong>{item.label}</strong>
              <small>
                {item.ready
                  ? `${fmtNumber(item.readyManagers)}/${fmtNumber(item.activeManagers || item.readyManagers)} מנהלים מוכנים · ${fmtNumber(item.rows)} רשומות`
                  : item.partial
                    ? "טעינה חלקית"
                    : "לא נטען"}
              </small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExecutivePortalHome({ analysisData, selectedProduct, onOpenProduct }) {
  const analytics = useMemo(() => buildExecutiveAnalytics(analysisData), [analysisData]);
  const { totals, productSummaries, complianceRate, dataQualityItems, managerSummary, uploadReadiness } = analytics;

  if (!productSummaries.length) return null;

  return (
    <div className="executivePortalHome v73" dir="rtl">
      <section className="executiveAnalyticsLayer v41 v73" dir="rtl">
        <div className="executiveLayerHeader v41">
          <div>
            <p className="eyebrow">Unified Dashboard</p>
            <h2>תמונת הנהלה מאוחדת</h2>
            <p>
              מסך ניהולי ממוקד לכל מנהלי ההסדר והמוצרים: KPI, בריאות מוצרים, איכות נתונים, מנהלי הסדר וסטטוס טעינה.
              פירוט עובדים נשאר בתוך מסכי המוצר בלבד.
            </p>
          </div>
        </div>

        <div className="executiveKpiGrid v41 v73-main">
          <ExecutiveKpiCard label="עובדים" value={fmtNumber(totals.employeeCount)} subtext="ייחודיים לפי זיהוי זמין" tone="blue" icon="👥" />
          <ExecutiveKpiCard label="נכסים / פוליסות" value={fmtNumber(totals.rowCount)} subtext="כלל רשומות המוצרים" tone="blue" icon="≡" />
          <ExecutiveKpiCard label="צבירה כוללת" value={fmtMoney(totals.totalAccumulation)} subtext="פנסיה + השתלמות + ביטוח מנהלים" tone="gold" icon="₪" />
          <ExecutiveKpiCard label="מנהלי הסדר" value={fmtNumber(totals.managerCount)} subtext="לפי טעינה / שיוך רשומות" tone="neutral" icon="◫" />
          <ExecutiveKpiCard label="תקינות נתונים" value={fmtPct(complianceRate)} subtext="רשומות ללא מוקדי טיפול" tone={complianceRate >= 90 ? "green" : "warning"} icon="✓" />
          <ExecutiveKpiCard label="שגיאות" value={fmtNumber(totals.exceptionRows)} subtext="מוקדי טיפול בכלל המוצרים" tone={totals.exceptionRows ? "warning" : "green"} icon="!" />
        </div>

        <ProductHealthCenter productSummaries={productSummaries} selectedProduct={selectedProduct} onOpenProduct={onOpenProduct} />

        <div className="executivePanelsGrid v41 v73-management">
          <DataQualityCenter dataQualityItems={dataQualityItems} onOpenProduct={onOpenProduct} />
          <UploadReadinessPanel uploadReadiness={uploadReadiness} />
        </div>

        <ManagersSummary managerSummary={managerSummary} />
      </section>
    </div>
  );
}

function ProductDetailHeader({ selectedProduct, onBackHome, availableProducts, onSelectProduct }) {
  return (
    <header className="productDetailHeader" dir="rtl">
      <div>
        <p className="eyebrow">Product Analysis</p>
        <h2>{getProductModeLabel(selectedProduct)}</h2>
        <p>מצב פירוט מוצר. במוצר עצמו ניתן להיכנס לנתונים פרטניים בהתאם לבחירת מנהל הסדר.</p>
      </div>
      <div className="productDetailActions">
        <div className="analysisProductTabs compact" dir="rtl">
          {availableProducts.map((productMode) => (
            <button
              key={productMode}
              type="button"
              className={selectedProduct === productMode ? "active" : ""}
              onClick={() => onSelectProduct(productMode)}
            >
              {getProductModeLabel(productMode)}
            </button>
          ))}
        </div>
        <button type="button" className="secondaryButton" onClick={onBackHome}>
          חזרה למסך הנהלה
        </button>
      </div>
    </header>
  );
}

export default function AnalysisWorkspace({ files, analysisData, onBack }) {
  const availableProducts = useMemo(() => getAvailableProducts(analysisData), [analysisData]);

  const [selectedProduct, setSelectedProduct] = useState(
    availableProducts.includes(analysisData?.activeProductMode)
      ? analysisData.activeProductMode
      : availableProducts[0]
  );
  const [viewMode, setViewMode] = useState("portal");

  useEffect(() => {
    if (!availableProducts.includes(selectedProduct)) {
      setSelectedProduct(
        availableProducts.includes(analysisData?.activeProductMode)
          ? analysisData.activeProductMode
          : availableProducts[0]
      );
      setViewMode("portal");
    }
  }, [analysisData?.activeProductMode, availableProducts, selectedProduct]);

  function openProduct(productMode) {
    if (!availableProducts.includes(productMode)) return;
    setSelectedProduct(productMode);
    setViewMode("product");
  }

  const pensionAnalysisData =
    analysisData?.productResults?.[PRODUCT_MODES.PENSION] ||
    (analysisData?.productMode === PRODUCT_MODES.PENSION ? analysisData : null) ||
    analysisData;

  return (
    <section className="analysisWorkspace v41" dir="rtl">
      <header className="analysisWorkspaceHeader v41">
        <div>
          <p className="eyebrow">Analysis Portal</p>
          <h1>מרכז ניתוח יועץ</h1>
          <p>
            מסך הבית מציג תמונת הנהלה מאוחדת. דרך כרטיסי המוצרים נכנסים לניתוחי המוצרים.
          </p>
        </div>

        <button type="button" className="secondaryButton" onClick={onBack}>
          חזרה להעלאה
        </button>
      </header>

      {viewMode === "portal" ? (
        <ExecutivePortalHome
          analysisData={analysisData}
          selectedProduct={selectedProduct}
          onOpenProduct={openProduct}
        />
      ) : (
        <div className="analysisWorkspaceBody productModeBody">
          <ProductDetailHeader
            selectedProduct={selectedProduct}
            availableProducts={availableProducts}
            onSelectProduct={setSelectedProduct}
            onBackHome={() => setViewMode("portal")}
          />
          {selectedProduct === PRODUCT_MODES.PENSION ? (
            <Dashboard
              files={files}
              analysisData={pensionAnalysisData}
              onBackToProductPortal={() => setViewMode("portal")}
              onBackToUpload={onBack}
            />
          ) : selectedProduct === PRODUCT_MODES.EXECUTIVE_INSURANCE ? (
            <ExecutiveInsuranceAnalysisView
              analysisData={analysisData}
              onBackToProductPortal={() => setViewMode("portal")}
              onBackToUpload={onBack}
            />
          ) : (
            <EducationFundAnalysisView
              analysisData={analysisData}
              onBackToProductPortal={() => setViewMode("portal")}
              onBackToUpload={onBack}
            />
          )}
        </div>
      )}
    </section>
  );
}
