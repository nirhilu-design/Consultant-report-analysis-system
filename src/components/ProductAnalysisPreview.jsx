// Path: src/components/ProductAnalysisPreview.jsx
// CORE HARDENING v26C
// Product Analysis Preview
//
// Purpose:
// Temporary, safe preview for non-pension products before full Dashboard integration.
// Currently used for קרן השתלמות.

import React from "react";
import { getProductModeLabel } from "./ProductModeSelector.jsx";

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
  return `${Number(value).toFixed(2)}%`;
}

function combineSummary(managerResults = []) {
  const summaries = managerResults.map((result) => result.summary || {});

  const issuers = [
    ...new Set(
      summaries.flatMap((summary) => Array.isArray(summary.issuers) ? summary.issuers : [])
    ),
  ];

  const funds = [
    ...new Set(
      summaries.flatMap((summary) => Array.isArray(summary.funds) ? summary.funds : [])
    ),
  ];

  return {
    managers: managerResults.length,
    unifiedRowCount: summaries.reduce((sum, summary) => sum + Number(summary.unifiedRowCount || 0), 0),
    agreementCount: summaries.reduce((sum, summary) => sum + Number(summary.agreementCount || 0), 0),
    totalAccumulation: summaries.reduce((sum, summary) => sum + Number(summary.totalAccumulation || 0), 0),
    totalMonthlyDeposits: summaries.reduce((sum, summary) => sum + Number(summary.totalMonthlyDeposits || 0), 0),
    feeWarnings: summaries.reduce((sum, summary) => sum + Number(summary.feeWarnings || 0), 0),
    matchedAgreements: summaries.reduce((sum, summary) => sum + Number(summary.matchedAgreements || 0), 0),
    issuers,
    funds,
  };
}

export default function ProductAnalysisPreview({ productMode, analysisData, onBack }) {
  const managerResults = Array.isArray(analysisData?.managerResults) ? analysisData.managerResults : [];
  const unifiedRows = Array.isArray(analysisData?.unifiedRows) ? analysisData.unifiedRows : [];
  const summary = analysisData?.productSummary || combineSummary(managerResults);
  const warnings = Array.isArray(analysisData?.diagnostics?.warnings)
    ? analysisData.diagnostics.warnings
    : [];

  return (
    <section className="productPreviewPage" dir="rtl">
      <div className="productPreviewHeader">
        <div>
          <p className="eyebrow">Product Preview</p>
          <h1>ניתוח {getProductModeLabel(productMode)}</h1>
          <p>
            זהו Preview זמני למוצר החדש. הפנסיה עדיין מוצגת בדשבורד הרגיל, וקרן השתלמות מוצגת כאן עד שנחבר לה Dashboard מלא.
          </p>
        </div>

        <button type="button" className="secondaryButton" onClick={onBack}>
          חזרה להעלאה
        </button>
      </div>

      <div className="productPreviewKpiGrid">
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
          <span>גופים מנהלים</span>
          <strong>{summary.issuers?.length || 0}</strong>
        </article>
      </div>

      <div className="productPreviewGrid">
        <section className="card">
          <h2>סיכום קליטה</h2>

          <table className="miniTable">
            <tbody>
              <tr>
                <td>מנהלים נותחו</td>
                <td>{summary.managers || managerResults.length}</td>
              </tr>
              <tr>
                <td>שורות מאוחדות</td>
                <td>{summary.unifiedRowCount || unifiedRows.length}</td>
              </tr>
              <tr>
                <td>הסכמים שנקלטו</td>
                <td>{summary.agreementCount || 0}</td>
              </tr>
              <tr>
                <td>התאמות הסכם</td>
                <td>{summary.matchedAgreements || 0}</td>
              </tr>
              <tr>
                <td>חריגות דמי ניהול</td>
                <td>{summary.feeWarnings || 0}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>גופים מנהלים</h2>
          {summary.issuers?.length ? (
            <div className="chipList">
              {summary.issuers.map((issuer) => (
                <span key={issuer}>{issuer}</span>
              ))}
            </div>
          ) : (
            <p className="hint">לא זוהו גופים מנהלים.</p>
          )}
        </section>
      </div>

      {warnings.length > 0 && (
        <section className="card">
          <h2>אזהרות</h2>
          <ul className="warningList">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>דגימת שורות</h2>

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
          <p className="hint">לא נמצאו שורות להצגה.</p>
        )}
      </section>
    </section>
  );
}
