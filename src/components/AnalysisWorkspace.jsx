// Path: src/components/AnalysisWorkspace.jsx
// CORE HARDENING v27C
// Central Analysis Workspace — Multi Product Results
//
// Purpose:
// One central post-analysis screen for all analyzed products.
// Product tabs are derived from analysisData.productResults.

import React, { useEffect, useMemo, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import { PRODUCT_MODES, getProductModeLabel } from "./ProductModeSelector.jsx";

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(number);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toFixed(2)}%`;
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

function getEducationFundData(analysisData) {
  const productResult =
    analysisData?.productResults?.[PRODUCT_MODES.HISHTALMUT] ||
    (analysisData?.productMode === PRODUCT_MODES.HISHTALMUT ? analysisData : null) ||
    {};

  const unifiedRows =
    productResult.unifiedRows ||
    productResult.educationFundRows ||
    analysisData?.educationFundRows ||
    [];

  const summary =
    productResult.productSummary ||
    productResult.summary ||
    productResult.educationFundSummary ||
    analysisData?.educationFundSummary ||
    analysisData?.productSummary ||
    {};

  const warnings =
    productResult?.diagnostics?.warnings ||
    productResult?.warnings ||
    [];

  return {
    productResult,
    unifiedRows: Array.isArray(unifiedRows) ? unifiedRows : [],
    summary,
    warnings: Array.isArray(warnings) ? warnings : [],
  };
}

function EducationFundAnalysisPlaceholder({ analysisData }) {
  const { unifiedRows, summary, warnings } = getEducationFundData(analysisData);

  return (
    <section className="productAnalysisPanel" dir="rtl">
      <div className="productAnalysisHeader">
        <div>
          <p className="eyebrow">Education Fund</p>
          <h2>ניתוח קרן השתלמות</h2>
          <p>
            זהו שלד התצוגה המרכזי לקרן השתלמות. בשלב הבא נגדיר יחד אילו ניתוחים
            יופיעו כאן ונחליף את התצוגה הזו למסך ניתוח מלא.
          </p>
        </div>
      </div>

      <div className="productAnalysisKpiGrid">
        <article>
          <span>שורות שנקלטו</span>
          <strong>{summary.unifiedRowCount || unifiedRows.length || 0}</strong>
        </article>

        <article>
          <span>סה״כ צבירה</span>
          <strong>{formatCurrency(summary.totalAccumulation)}</strong>
        </article>

        <article>
          <span>הפקדה / פרמיה אחרונה</span>
          <strong>{formatCurrency(summary.totalMonthlyDeposits)}</strong>
        </article>

        <article>
          <span>חריגות דמי ניהול</span>
          <strong>{summary.feeWarnings || 0}</strong>
        </article>
      </div>

      {warnings.length > 0 && (
        <section className="workspaceCard">
          <h3>אזהרות</h3>
          <ul className="warningList">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="workspaceCard">
        <h3>דגימת נתונים</h3>

        {unifiedRows.length ? (
          <div className="tableScroll">
            <table className="miniTable productRowsTable">
              <thead>
                <tr>
                  <th>גוף מנהל</th>
                  <th>שם קופה</th>
                  <th>מספר פוליסה</th>
                  <th>צבירה</th>
                  <th>דמי ניהול בפועל</th>
                  <th>דמי ניהול הסכם</th>
                  <th>סטטוס</th>
                </tr>
              </thead>

              <tbody>
                {unifiedRows.slice(0, 25).map((row, index) => (
                  <tr key={`${row.policyNumber || row.fundName || "row"}-${index}`}>
                    <td>{row.issuerOriginal || row.issuer || "-"}</td>
                    <td>{row.fundName || row.productName || "-"}</td>
                    <td>{row.policyNumber || "-"}</td>
                    <td>{formatCurrency(row.currentBalance)}</td>
                    <td>{formatPercent(row.accumulationFee)}</td>
                    <td>{formatPercent(row.accumulationFeeAgreement)}</td>
                    <td>{row.feeStatus || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">עדיין אין נתונים להצגה עבור קרן השתלמות.</p>
        )}
      </section>
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
            כאן בוחרים איזה מוצר לנתח ולהציג. הנתונים נשמרים לפי מוצר ומנהל הסדר,
            כך שפנסיה וקרן השתלמות לא דורסות אחת את השנייה.
          </p>
        </div>

        <button type="button" className="secondaryButton" onClick={onBack}>
          חזרה להעלאה
        </button>
      </header>

      <ProductTabs
        products={availableProducts}
        selectedProduct={selectedProduct}
        onSelect={setSelectedProduct}
      />

      <div className="analysisWorkspaceBody">
        {selectedProduct === PRODUCT_MODES.PENSION ? (
          <Dashboard files={files} analysisData={pensionAnalysisData} />
        ) : (
          <EducationFundAnalysisPlaceholder analysisData={analysisData} />
        )}
      </div>
    </section>
  );
}
