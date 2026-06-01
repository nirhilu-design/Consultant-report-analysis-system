// Path: src/components/AnalysisWorkspace.jsx
// v42 — Portal Architecture manager counting fix
// Executive Dashboard becomes the home screen after analysis.
// Product Center opens each product only on explicit user selection.
//
// Core UX rule:
// - Home / aggregate mode: KPI, risks, product split, manager split, product cards only.
// - Product detail mode: the selected product analysis screen.
// - No employee/customer lists are shown on the executive home screen.

import React, { useEffect, useMemo, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import EducationFundAnalysisView from "./EducationFundAnalysisView.jsx";
import { PRODUCT_MODES, getProductModeLabel } from "./ProductModeSelector.jsx";

const PRODUCT_LABELS = {
  [PRODUCT_MODES.PENSION]: "פנסיה",
  [PRODUCT_MODES.HISHTALMUT]: "קרן השתלמות",
};

const FUTURE_PRODUCTS = [
  { key: "executiveInsurance", label: "ביטוח מנהלים", description: "המוצר הבא בתור: שלד טעינה וניתוח ייבנה לאחר אישור מבנה הקבצים", status: "הבא בתור" },
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

function groupSum(items, getKey, getValue) {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeText(getKey(item)) || "לא מסווג";
    const current = map.get(key) || { label: key, value: 0, rows: 0 };
    current.value += toNumber(getValue(item));
    current.rows += 1;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
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

  const allRows = productSummaries.flatMap((item) => item.rows.map((row) => ({ ...row, __productLabel: item.label })));

  const distinctArrangementManagerCount = uniqueCount(
    allRows.map(getArrangementManagerName)
  ) || uniqueCount(
    asArray(analysisData?.managerSlots || analysisData?.arrangementManagers || analysisData?.managers).map((manager) =>
      firstDefined(manager?.name, manager?.managerName, manager?.label, manager?.id)
    )
  ) || Math.max(...productSummaries.map((item) => item.managerCount), 0);

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
    }
  );

  totals.managerCount = distinctArrangementManagerCount;

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

  const productDistribution = productSummaries.map((item) => ({
    key: item.productMode,
    label: item.label,
    value: item.totalAccumulation,
    rows: item.rowCount,
    monthly: item.totalMonthlyDeposits,
  }));

  const managerDistribution = groupSum(allRows, getArrangementManagerName, getAccumulation).slice(0, 6);

  return {
    productSummaries,
    totals,
    complianceRate,
    riskItems,
    productDistribution,
    managerDistribution,
  };
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

function DonutBreakdown({ title, centerLabel, centerValue, items, emptyText }) {
  const total = items.reduce((sum, item) => sum + toNumber(item.value), 0);
  let cursor = 0;
  const palette = ["#2563eb", "#16a34a", "#7c3aed", "#f59e0b", "#0f766e", "#64748b"];
  const stops = items.map((item, index) => {
    const percent = total ? (toNumber(item.value) / total) * 100 : 0;
    const start = cursor;
    cursor += percent;
    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });
  const background = total ? `conic-gradient(${stops.join(", ")})` : "#e5e7eb";

  return (
    <section className="executivePanel v41 donutPanel">
      <div className="executivePanelTitle">
        <h3>{title}</h3>
      </div>
      {total ? (
        <div className="donutContent">
          <div className="donutChart" style={{ background }}>
            <div className="donutCenter">
              <span>{centerLabel}</span>
              <strong>{centerValue}</strong>
            </div>
          </div>
          <div className="donutLegend">
            {items.map((item, index) => {
              const pct = total ? (toNumber(item.value) / total) * 100 : 0;
              return (
                <div className="donutLegendRow" key={`${item.label}-${index}`}>
                  <span className="donutColor" style={{ background: palette[index % palette.length] }} />
                  <div>
                    <strong>{item.label}</strong>
                    <small>{fmtMoney(item.value)} · {fmtPct(pct)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="emptyStateText">{emptyText || "אין מספיק נתונים להצגה"}</p>
      )}
    </section>
  );
}

function RiskCenterPanel({ riskItems }) {
  return (
    <section className="executivePanel v41 riskCenterPanel">
      <div className="executivePanelTitle">
        <h3>Unified Risk Center</h3>
        <span>כמות בלבד, ללא חומרה</span>
      </div>
      <div className="executiveRiskTableWrap">
        <table className="executiveTable v41">
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
  );
}

function ProductSummaryTable({ productSummaries }) {
  return (
    <section className="executivePanel v41 productSummaryPanel">
      <div className="executivePanelTitle">
        <h3>סיכום לפי מוצרים</h3>
        <span>נתונים אגרגטיביים בלבד</span>
      </div>
      <div className="executiveRiskTableWrap">
        <table className="executiveTable v41">
          <thead>
            <tr>
              <th>מוצר</th>
              <th>מנהלי הסדר</th>
              <th>עובדים / רשומות</th>
              <th>צבירה</th>
              <th>הפקדות</th>
              <th>מוקדי טיפול</th>
              <th>איכות</th>
            </tr>
          </thead>
          <tbody>
            {productSummaries.map((item) => (
              <tr key={item.productMode}>
                <td><strong>{item.label}</strong></td>
                <td>{fmtNumber(item.managerCount)}</td>
                <td>{fmtNumber(item.rowCount)}</td>
                <td>{fmtMoney(item.totalAccumulation)}</td>
                <td>{fmtMoney(item.totalMonthlyDeposits)}</td>
                <td>{fmtNumber(item.exceptionRows)}</td>
                <td>{fmtPct(item.complianceRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductCenter({ productSummaries, selectedProduct, onOpenProduct }) {
  const activeCards = productSummaries.map((item) => ({
    key: item.productMode,
    label: item.label,
    description: "כניסה למסך ניתוח המוצר",
    status: "פעיל",
    enabled: true,
    metrics: [
      { label: "רשומות", value: fmtNumber(item.rowCount) },
      { label: "צבירה", value: fmtMoney(item.totalAccumulation) },
      { label: "מוקדי טיפול", value: fmtNumber(item.exceptionRows) },
    ],
  }));

  const cards = [
    ...activeCards,
    ...FUTURE_PRODUCTS.map((item) => ({ ...item, enabled: false, metrics: [] })),
  ];

  return (
    <section className="productCenterPanel" dir="rtl">
      <div className="productCenterHeader">
        <div>
          <p className="eyebrow">Product Center</p>
          <h2>כניסה למוצרי הניתוח</h2>
          <p>מסך הבית נשאר אגרגטיבי. פירוט עובדים ולקוחות נפתח רק בתוך מוצר פעיל.</p>
        </div>
      </div>

      <div className="productCenterGrid">
        {cards.map((card) => (
          <button
            type="button"
            key={card.key}
            className={`productPortalCard ${card.enabled ? "enabled" : "disabled"} ${selectedProduct === card.key ? "active" : ""}`}
            onClick={() => card.enabled && onOpenProduct(card.key)}
            disabled={!card.enabled}
          >
            <span className="productPortalStatus">{card.status}</span>
            <strong>{card.label}</strong>
            <small>{card.description}</small>
            {card.metrics.length ? (
              <div className="productPortalMetrics">
                {card.metrics.map((metric) => (
                  <span key={metric.label}>
                    <b>{metric.value}</b>
                    <em>{metric.label}</em>
                  </span>
                ))}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function ExecutivePortalHome({ analysisData, selectedProduct, onOpenProduct }) {
  const analytics = useMemo(() => buildExecutiveAnalytics(analysisData), [analysisData]);
  const { totals, productSummaries, riskItems, complianceRate, productDistribution, managerDistribution } = analytics;

  if (!productSummaries.length) return null;

  return (
    <div className="executivePortalHome" dir="rtl">
      <section className="executiveAnalyticsLayer v41" dir="rtl">
        <div className="executiveLayerHeader v41">
          <div>
            <p className="eyebrow">Executive Analytics</p>
            <h2>תמונת הנהלה מאוחדת</h2>
            <p>
              מסך בית אגרגטיבי לכל המוצרים ומנהלי ההסדר. אין כאן רשימות עובדים או פרטים מזהים.
              כניסה לפרטים מתבצעת דרך Product Center בלבד.
            </p>
          </div>
        </div>

        <div className="executiveKpiSections">
          <div className="kpiSectionBlock">
            <h3>נתונים תפעוליים</h3>
            <div className="executiveKpiGrid v41 compact">
              <ExecutiveKpiCard label="מנהלי הסדר בטעינה" value={fmtNumber(totals.managerCount)} subtext="כמות מנהלי הסדר שהועלו בפועל" tone="blue" icon="👥" />
              <ExecutiveKpiCard label="מוצרים פעילים" value={fmtNumber(productSummaries.length)} subtext="פנסיה / השתלמות / עתידי" tone="blue" icon="◫" />
              <ExecutiveKpiCard label="רשומות שנקלטו" value={fmtNumber(totals.rowCount)} subtext="שורות ניתוח" tone="neutral" icon="≡" />
              <ExecutiveKpiCard label="מוקדי טיפול" value={fmtNumber(totals.exceptionRows)} subtext="דמי ניהול, גיל, נתונים" tone={totals.exceptionRows ? "warning" : "green"} icon="!" />
            </div>
          </div>

          <div className="kpiSectionBlock">
            <h3>נתונים כספיים</h3>
            <div className="executiveKpiGrid v41 compact">
              <ExecutiveKpiCard label="צבירה כוללת" value={fmtMoney(totals.totalAccumulation)} subtext="על בסיס Snapshot נוכחי" tone="gold" icon="₪" />
              <ExecutiveKpiCard label="הפקדות חודשיות" value={fmtMoney(totals.totalMonthlyDeposits)} subtext="סך הפקדות מזוהות" tone="gold" icon="↻" />
              <ExecutiveKpiCard label="צבירה ממוצעת" value={fmtMoney(totals.employeeCount ? totals.totalAccumulation / totals.employeeCount : 0)} subtext="לעובד / לקוח מזוהה" tone="neutral" icon="○" />
            </div>
          </div>

          <div className="kpiSectionBlock">
            <h3>איכות נתונים</h3>
            <div className="executiveKpiGrid v41 compact">
              <ExecutiveKpiCard label="אחוז עובדים תקינים" value={fmtPct(complianceRate)} subtext="לפי רשומות ללא מוקדי טיפול" tone={complianceRate >= 90 ? "green" : "warning"} icon="✓" />
              <ExecutiveKpiCard label="שגיאות נתונים" value={fmtNumber(totals.dataWarnings)} subtext="אזהרות מערכת" tone={totals.dataWarnings ? "warning" : "green"} icon="△" />
              <ExecutiveKpiCard label="נתונים חסרים" value={fmtNumber(totals.missingDataRows)} subtext="רשומות עם חוסר מהותי" tone={totals.missingDataRows ? "warning" : "green"} icon="□" />
            </div>
          </div>
        </div>

        <div className="executivePanelsGrid v41 portal">
          <DonutBreakdown
            title="פילוח לפי מוצרים"
            centerLabel={'סה"כ צבירה'}
            centerValue={fmtMoney(totals.totalAccumulation)}
            items={productDistribution}
          />
          <DonutBreakdown
            title="פילוח לפי מנהלי הסדר בטעינה"
            centerLabel={'סה"כ צבירה'}
            centerValue={fmtMoney(totals.totalAccumulation)}
            items={managerDistribution}
          />
          <RiskCenterPanel riskItems={riskItems} />
        </div>

        <ProductSummaryTable productSummaries={productSummaries} />
      </section>

      <ProductCenter productSummaries={productSummaries} selectedProduct={selectedProduct} onOpenProduct={onOpenProduct} />
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
            מסך הבית מציג תמונת הנהלה מאוחדת. דרך Product Center נכנסים לניתוחי המוצרים.
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
            <Dashboard files={files} analysisData={pensionAnalysisData} />
          ) : (
            <EducationFundAnalysisView analysisData={analysisData} />
          )}
        </div>
      )}
    </section>
  );
}
