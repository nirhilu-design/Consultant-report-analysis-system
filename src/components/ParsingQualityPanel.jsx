// src/components/ParsingQualityPanel.jsx
// CORE HARDENING v19
// Upload Parsing Quality UI
//
// This component is intentionally self-contained.
// It does not mutate upload state and does not depend on Dashboard internals.

import React from "react";

function formatPercent(value) {
  const number = Number(value || 0);
  return `${Math.round(number)}%`;
}

function getLevelClass(level) {
  switch (level) {
    case "excellent":
      return "qualityExcellent";
    case "good":
      return "qualityGood";
    case "partial":
      return "qualityPartial";
    case "risky":
    default:
      return "qualityRisky";
  }
}

function getLevelIcon(level) {
  switch (level) {
    case "excellent":
      return "✓";
    case "good":
      return "✓";
    case "partial":
      return "!";
    case "risky":
    default:
      return "!";
  }
}

function HebrewFieldName({ value }) {
  const labels = {
    memberName: "שם מבוטח",
    idNumber: "תעודת זהות",
    policyNumber: "מספר פוליסה / חשבון",
    managerName: "גוף מנהל",
    productType: "סוג מוצר",
    currentBalance: "צבירה נוכחית",
    monthlyDeposit: "הפקדה חודשית",
    employerDeposit: "הפקדת מעסיק",
    employeeDeposit: "הפקדת עובד",
    compensationBalance: "יתרת פיצויים",
    savingsBalance: "יתרת תגמולים",
  };

  return <>{labels[value] || value}</>;
}

export default function ParsingQualityPanel({ report, compact = false }) {
  if (!report) return null;

  const levelClass = getLevelClass(report.level);
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];
  const missingRequiredHeaders = Array.isArray(report.missingRequiredHeaders)
    ? report.missingRequiredHeaders
    : [];

  return (
    <section className={`parsingQualityPanel ${levelClass}`} dir="rtl">
      <div className="parsingQualityHeader">
        <div className="parsingQualityTitleWrap">
          <span className="parsingQualityIcon">{getLevelIcon(report.level)}</span>
          <div>
            <strong>{report.title || "איכות קליטה"}</strong>
            {!compact && (
              <small>
                {report.fileName ? `קובץ: ${report.fileName}` : "בדיקת איכות קובץ"}
              </small>
            )}
          </div>
        </div>

        <div className="parsingQualityScore">
          {formatPercent(report.score)}
        </div>
      </div>

      <div className="parsingQualityBar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, Number(report.score || 0)))}%` }} />
      </div>

      <div className="parsingQualityGrid">
        <div>
          <span>שורות שנקלטו</span>
          <strong>{report.rowCount || 0}</strong>
        </div>

        <div>
          <span>כותרות שזוהו</span>
          <strong>
            {report.summary?.detectedHeaderCount || 0}
            {report.summary?.requiredHeaderCount ? ` / ${report.summary.requiredHeaderCount}` : ""}
          </strong>
        </div>

        <div>
          <span>זיהוי Alias</span>
          <strong>{report.summary?.aliasMatchedHeaderCount || 0}</strong>
        </div>
      </div>

      {!compact && missingRequiredHeaders.length > 0 && (
        <div className="parsingQualityBlock">
          <strong>כותרות חובה חסרות</strong>
          <div className="parsingQualityTags">
            {missingRequiredHeaders.map((header) => (
              <span key={header}>
                <HebrewFieldName value={header} />
              </span>
            ))}
          </div>
        </div>
      )}

      {!compact && warnings.length > 0 && (
        <div className="parsingQualityWarnings">
          <strong>אזהרות</strong>
          <ul>
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/*
Suggested CSS.
Add to your existing CSS file, for example src/App.css.

.parsingQualityPanel {
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #dbe3ef;
  background: #ffffff;
  font-family: Calibri, Arial, sans-serif;
  direction: rtl;
}

.parsingQualityHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.parsingQualityTitleWrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.parsingQualityTitleWrap strong {
  display: block;
  font-size: 15px;
  color: #14213d;
}

.parsingQualityTitleWrap small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}

.parsingQualityIcon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.parsingQualityScore {
  font-size: 22px;
  font-weight: 800;
  color: #14213d;
}

.parsingQualityBar {
  margin-top: 10px;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: #edf2f7;
  overflow: hidden;
}

.parsingQualityBar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: currentColor;
}

.parsingQualityGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.parsingQualityGrid div {
  padding: 10px;
  border-radius: 12px;
  background: #f8fafc;
}

.parsingQualityGrid span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.parsingQualityGrid strong {
  display: block;
  margin-top: 4px;
  color: #14213d;
  font-size: 15px;
}

.parsingQualityBlock {
  margin-top: 12px;
}

.parsingQualityBlock strong,
.parsingQualityWarnings strong {
  color: #14213d;
  font-size: 13px;
}

.parsingQualityTags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.parsingQualityTags span {
  padding: 5px 9px;
  border-radius: 999px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 12px;
}

.parsingQualityWarnings {
  margin-top: 12px;
}

.parsingQualityWarnings ul {
  margin: 8px 0 0;
  padding: 0 18px 0 0;
  color: #475569;
  font-size: 13px;
}

.parsingQualityExcellent {
  color: #0f766e;
  border-color: #99f6e4;
  background: #f0fdfa;
}

.parsingQualityGood {
  color: #15803d;
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.parsingQualityPartial {
  color: #b45309;
  border-color: #fde68a;
  background: #fffbeb;
}

.parsingQualityRisky {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

@media (max-width: 760px) {
  .parsingQualityGrid {
    grid-template-columns: 1fr;
  }

  .parsingQualityHeader {
    align-items: flex-start;
  }
}
*/
