// Path: src/components/AnalysisWorkspace.jsx
// v40 — Executive Analytics Layer
// Central Analysis Workspace — Multi Product Results
//
// Adds a global executive layer above the product tabs:
// - Executive KPI Strip
// - Unified Risk Center without severity
// - Product Contribution
//
// Privacy rule:
// In aggregate mode the executive layer shows only aggregated data.
// Product-level detailed rows remain inside the product screens and should be
// exposed only by the product components when a single arrangement manager is selected.

import React, { useEffect, useMemo, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import EducationFundAnalysisView from "./EducationFundAnalysisView.jsx";
import { PRODUCT_MODES, getProductModeLabel } from "./ProductModeSelector.jsx";

const PRODUCT_LABELS = {
  [PRODUCT_MODES.PENSION]: "פנסיה",
  [PRODUCT_MODES.HISHTALMUT]: "קרן השתלמות",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
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
  const numeric = toNumber(value);
  return `${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 }).format(numeric)}%`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function uniqueCount(values) {
  return new Set(values.map(normalizeText).filter(Boolean)).size;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
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
      row?.sourceManagerName
    )
  );
}

function getIssuerName(row) {
  return normalizeText(
    firstDefined(
      row?.issuerCanonical,
      row?.issuerOriginal,
      row?.issuer,
      row?.companyName,
      row?.manager,
      row?.fundManager
    )
  );
}

function getEmployeeKey(row) {
  return normalizeText(
    firstDefined(
      row?.employeeKey,
      row?.employeeId,
      row?.workerId,
      row?.customerId,
      row?.idNumber,
      row?.tz,
      row?.memberId,
      row?.policyNumber,
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

function isPensionFeeWarning(row) {
  const status = normalizeText(firstDefined(row?.auditStatus, row?.feeStatus, row?.status));
  return ["warning", "invalid", "not_ok", "לא תקין", "חריגה"].includes(status) || row?.isFeeException === true;
}

function isEducationFeeWarning(row) {
  const status = normalizeText(firstDefined(row?.calculatedFeeStatus, row?.feeStatus, row?.status));
  return ["warning", "invalid", "not_ok", "לא תקין", "חריגה"].includes(status) || row?.isFeeException === true;
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

function getProductDiagnosticsWarnings(result) {
  const diagnosticsWarnings = asArray(result?.diagnostics?.warnings);
  const managerWarnings = asArray(result?.managerResults).flatMap((managerResult) => asArray(managerResult?.warnings));
  return [...diagnosticsWarnings, ...managerWarnings].filter(Boolean);
}

function buildProductExecutiveSummary(productMode, productResult) {
  const label = PRODUCT_LABELS[productMode] || getProductModeLabel(productMode);
  const rows = productMode === PRODUCT_MODES.HISHTALMUT ? getEducationRows(productResult) : getPensionRows(productResult);

  const summary = productResult?.productSummary || productResult?.educationFundSummary || productResult?.pensionSummary || {};
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

  const feeWarnings = rows.filter(productMode === PRODUCT_MODES.HISHTALMUT ? isEducationFeeWarning : isPensionFeeWarning).length;
  const ageWarnings = rows.filter(isAgeTrackWarning).length;
  const missingDataRows = rows.filter(isMissingDataRow).length;
  const dataWarnings = warnings.length;
  const exceptionRows = rows.filter((row) => {
    if (productMode === PRODUCT_MODES.HISHTALMUT) return isEducationFeeWarning(row) || isAgeTrackWarning(row) || isMissingDataRow(row);
    return isPensionFeeWarning(row) || isAgeTrackWarning(row) || isMissingDataRow(row);
  }).length;

  return {
    productMode,
    label,
    managerCount,
    rowCount: rows.length,
    employeeCount,
    totalAccumulation,
    totalMonthlyDeposits,
    averageAccumulation: employeeCount ? totalAccumulation / employeeCount : 0,
    exceptionRows,
    feeWarnings,
    ageWarnings,
    dataWarnings,
    missingDataRows,
    issuerCount: uniqueCount(rows.map(getIssuerName)),
  };
}

function buildExecutiveAnalytics(analysisData) {
  const productResults = analysisData?.productResults || {};
  const productSummaries = Object.entries(productResults)
    .map(([productMode, productResult]) => buildProductExecutiveSummary(productMode, productResult))
    .filter((item) => item.rowCount || item.managerCount || item.totalAccumulation || item.totalMonthlyDeposits);

  const totals = productSummaries.reduce(
    (acc, item) => {
      acc.managerCount += item.managerCount;
      acc.rowCount += item.rowCount;
      acc.employeeCount += item.employeeCount;
      acc.totalAccumulation += item.totalAccumulation;
      acc.totalMonthlyDeposits += item.totalMonthlyDeposits;
      acc.exceptionRows += item.exceptionRows;
      acc.feeWarnings += item.feeWarnings;
      acc.ageWarnings += item.ageWarnings;
      acc.dataWarnings += item.dataWarnings;
      acc.missingDataRows += item.missingDataRows;
      return acc;
    },
    {
      managerCount: 0,
      rowCount: 0,
      employeeCount: 0,
      totalAccumulation: 0,
      totalMonthlyDeposits: 0,
      exceptionRows: 0,
      feeWarnings: 0,
      ageWarnings: 0,
      dataWarnings: 0,
      missingDataRows: 0,
    }
  );

  const complianceBase = totals.rowCount || 0;
  const complianceRate = complianceBase ? Math.max(0, ((complianceBase - totals.exceptionRows) / complianceBase) * 100) : 0;

  const riskItems = [
    {
      key: "fees",
      label: "דמי ניהול",
      count: totals.feeWarnings,
      products: productSummaries.filter((item) => item.feeWarnings > 0).map((item) => `${item.label}: ${fmtNumber(item.feeWarnings)}`),
    },
    {
      key: "ageTracks",
      label: "מסלול גיל",
      count: totals.ageWarnings,
      products: productSummaries.filter((item) => item.ageWarnings > 0).map((item) => `${item.label}: ${fmtNumber(item.ageWarnings)}`),
    },
    {
      key: "dataQuality",
      label: "שגיאות נתונים",
      count: totals.dataWarnings,
      products: productSummaries.filter((item) => item.dataWarnings > 0).map((item) => `${item.label}: ${fmtNumber(item.dataWarnings)}`),
    },
    {
      key: "missingData",
      label: "נתונים חסרים",
      count: totals.missingDataRows,
      products: productSummaries.filter((item) => item.missingDataRows > 0).map((item) => `${item.label}: ${fmtNumber(item.missingDataRows)}`),
    },
  ];

  return {
    productSummaries,
    totals,
    complianceRate,
    riskItems,
  };
}

function ExecutiveKpiCard({ label, value, subtext, tone = "neutral" }) {
  return (
    <article className={`executiveKpiCard ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subtext ? <small>{subtext}</small> : null}
    </article>
  );
}

function ExecutiveAnalyticsLayer({ analysisData }) {
  const analytics = useMemo(() => buildExecutiveAnalytics(analysisData), [analysisData]);
  const { totals, productSummaries, riskItems, complianceRate } = analytics;

  if (!productSummaries.length) return null;

  return (
    <section className="executiveAnalyticsLayer" dir="rtl">
      <div className="executiveLayerHeader">
        <div>
          <p className="eyebrow">Executive Analytics</p>
          <h2>תמונת הנהלה מאוחדת</h2>
          <p>
            סיכום אגרגטיבי לכל המוצרים ומנהלי ההסדר. אין כאן רשימות עובדים או פרטים מזהים;
            פירוט פרטני נשאר בתוך מוצר לאחר בחירת מנהל הסדר יחיד.
          </p>
        </div>
      </div>

      <div className="executiveKpiGrid">
        <ExecutiveKpiCard label="מנהלי הסדר" value={fmtNumber(totals.managerCount)} subtext="לפי כל המוצרים שהועלו" tone="blue" />
        <ExecutiveKpiCard label="רשומות שנקלטו" value={fmtNumber(totals.rowCount)} subtext="פוליסות / קופות / שורות ניתוח" tone="blue" />
        <ExecutiveKpiCard label="עובדים / לקוחות" value={fmtNumber(totals.employeeCount)} subtext="ספירה אגרגטיבית ללא פירוט" tone="neutral" />
        <ExecutiveKpiCard label="צבירה כוללת" value={fmtMoney(totals.totalAccumulation)} subtext="על בסיס המוצרים שנקלטו" tone="gold" />
        <ExecutiveKpiCard label="הפקדות חודשיות" value={fmtMoney(totals.totalMonthlyDeposits)} subtext="סך הפקדות מזוהות" tone="gold" />
        <ExecutiveKpiCard label="צבירה ממוצעת" value={fmtMoney(totals.employeeCount ? totals.totalAccumulation / totals.employeeCount : 0)} subtext="לעובד / לקוח מזוהה" tone="neutral" />
        <ExecutiveKpiCard label="מוקדי טיפול" value={fmtNumber(totals.exceptionRows)} subtext="דמי ניהול, גיל, נתונים" tone={totals.exceptionRows ? "warning" : "green"} />
        <ExecutiveKpiCard label="אחוז תקינות" value={fmtPct(complianceRate)} subtext="חישוב אגרגטיבי ראשוני" tone={complianceRate >= 90 ? "green" : "warning"} />
      </div>

      <div className="executivePanelsGrid">
        <section className="executivePanel">
          <div className="executivePanelTitle">
            <h3>Unified Risk Center</h3>
            <span>ללא חומרה בשלב זה</span>
          </div>
          <div className="executiveRiskTableWrap">
            <table className="executiveTable">
              <thead>
                <tr>
                  <th>סוג חריגה</th>
                  <th>כמות</th>
                  <th>מוצרים רלוונטיים</th>
                </tr>
              </thead>
              <tbody>
                {riskItems.map((item) => (
                  <tr key={item.key}>
                    <td>{item.label}</td>
                    <td>{fmtNumber(item.count)}</td>
                    <td>{item.products.length ? item.products.join(" · ") : "אין חריגות"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="executivePanel">
          <div className="executivePanelTitle">
            <h3>תרומת מוצרים</h3>
            <span>סיכום לפי מוצר</span>
          </div>
          <div className="executiveRiskTableWrap">
            <table className="executiveTable">
              <thead>
                <tr>
                  <th>מוצר</th>
                  <th>מנהלי הסדר</th>
                  <th>רשומות</th>
                  <th>צבירה</th>
                  <th>מוקדי טיפול</th>
                </tr>
              </thead>
              <tbody>
                {productSummaries.map((item) => (
                  <tr key={item.productMode}>
                    <td>{item.label}</td>
                    <td>{fmtNumber(item.managerCount)}</td>
                    <td>{fmtNumber(item.rowCount)}</td>
                    <td>{fmtMoney(item.totalAccumulation)}</td>
                    <td>{fmtNumber(item.exceptionRows)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function ProductTabs({ products, selectedProduct, onSelect }) {
  return (
    <div className="analysisProductTabs" dir="rtl">
      {products.map((productMode) => (
        <button
          key={productMode}
          type="button"
          className={selectedProduct === productMode ? "active" : ""}
          onClick={() => onSelect(productMode)}
        >
          {getProductModeLabel(productMode)}
        </button>
      ))}
    </div>
  );
}

export default function AnalysisWorkspace({ files, analysisData, onBack }) {
  const availableProducts = useMemo(() => getAvailableProducts(analysisData), [analysisData]);

  const [selectedProduct, setSelectedProduct] = useState(
    availableProducts.includes(analysisData?.activeProductMode)
      ? analysisData.activeProductMode
      : availableProducts[0]
  );

  useEffect(() => {
    if (!availableProducts.includes(selectedProduct)) {
      setSelectedProduct(
        availableProducts.includes(analysisData?.activeProductMode)
          ? analysisData.activeProductMode
          : availableProducts[0]
      );
    }
  }, [analysisData?.activeProductMode, availableProducts, selectedProduct]);

  const pensionAnalysisData =
    analysisData?.productResults?.[PRODUCT_MODES.PENSION] ||
    (analysisData?.productMode === PRODUCT_MODES.PENSION ? analysisData : null) ||
    analysisData;

  return (
    <section className="analysisWorkspace" dir="rtl">
      <header className="analysisWorkspaceHeader">
        <div>
          <p className="eyebrow">Analysis Workspace</p>
          <h1>מרכז ניתוח מוצרים</h1>
          <p>
            כאן בוחרים איזה מוצר לנתח ולהציג. מעל המוצרים מוצגת תמונת הנהלה מאוחדת
            ואגרגטיבית בלבד, ללא עובדים או מספרי לקוח.
          </p>
        </div>

        <button type="button" className="secondaryButton" onClick={onBack}>
          חזרה להעלאה
        </button>
      </header>

      <ExecutiveAnalyticsLayer analysisData={analysisData} />

      <ProductTabs
        products={availableProducts}
        selectedProduct={selectedProduct}
        onSelect={setSelectedProduct}
      />

      <div className="analysisWorkspaceBody">
        {selectedProduct === PRODUCT_MODES.PENSION ? (
          <Dashboard files={files} analysisData={pensionAnalysisData} />
        ) : (
          <EducationFundAnalysisView analysisData={analysisData} />
        )}
      </div>
    </section>
  );
}
