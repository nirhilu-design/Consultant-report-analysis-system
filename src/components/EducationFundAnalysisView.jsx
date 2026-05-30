// Path: src/components/EducationFundAnalysisView.jsx
// CORE HARDENING v28
// Education Fund Analysis View — קרן השתלמות
//
// Tabs:
// 1. בדיקת דמי ניהול לפי הסכם
// 2. ניתוח לפי צבירה
// 3. מסלולי השקעה לפי גיל לקוח
// 4. צבירות לפי מנהלי השקעות
//
// Notes:
// - This component is presentation/analysis only.
// - It does not mutate upload/session state.
// - It expects education fund rows from analysisData.productResults.hishtalmut.
// - Personal details are optional. If birth date is unavailable, age analysis falls back gracefully.

import React, { useMemo, useState } from "react";

const EDUCATION_TABS = [
  {
    key: "fees",
    title: "דמי ניהול לפי הסכם",
  },
  {
    key: "accumulation",
    title: "ניתוח לפי צבירה",
  },
  {
    key: "tracksByAge",
    title: "מסלולי השקעה לפי גיל",
  },
  {
    key: "managers",
    title: "צבירות לפי מנהלי השקעות",
  },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(number);
}

function formatNumber(value) {
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toFixed(digits)}%`;
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value)
    .replace(/[₪,\s]/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getEducationFundData(analysisData) {
  const productResult =
    analysisData?.productResults?.hishtalmut ||
    (analysisData?.productMode === "hishtalmut" ? analysisData : null) ||
    {};

  const rows =
    productResult.unifiedRows ||
    productResult.educationFundRows ||
    analysisData?.educationFundRows ||
    [];

  const summary =
    productResult.productSummary ||
    productResult.educationFundSummary ||
    productResult.summary ||
    analysisData?.educationFundSummary ||
    analysisData?.productSummary ||
    {};

  const warnings =
    productResult?.diagnostics?.warnings ||
    productResult?.warnings ||
    [];

  return {
    productResult,
    rows: asArray(rows),
    summary,
    warnings: asArray(warnings),
  };
}

function getMemberKey(row) {
  return (
    normalizeText(row.employeeCode) ||
    normalizeText(row.idNumber) ||
    normalizeText(row.memberKey) ||
    normalizeText(row.clientName)
  );
}

function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date rough conversion.
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = normalizeText(value);
  if (!text) return null;

  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) return iso;

  const ddmmyyyy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = Number(ddmmyyyy[3].length === 2 ? `19${ddmmyyyy[3]}` : ddmmyyyy[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function calculateAge(value) {
  const birthDate = parseDateValue(value);
  if (!birthDate) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  if (age < 0 || age > 120) return null;
  return age;
}

function extractBirthDateFromRow(row) {
  return (
    row.birthDate ||
    row.dateOfBirth ||
    row.memberBirthDate ||
    row.personalDetails?.birthDate ||
    row.rawProductRow?.birthDate ||
    row.rawProductRow?.dateOfBirth ||
    null
  );
}

function getAgeBucket(age) {
  if (age === null || age === undefined) return "לא ידוע";
  if (age < 30) return "עד גיל 30";
  if (age < 40) return "30–39";
  if (age < 50) return "40–49";
  if (age < 60) return "50–59";
  return "60+";
}

function classifyTrackRisk(trackName) {
  const text = normalizeText(trackName);

  if (!text) return "לא ידוע";

  if (/מניית|מניות|s&p|sp500|נאסדק|nasdaq|100%|מחקה מדד/i.test(text)) {
    return "גבוה";
  }

  if (/כללי|לבני 50|עד 50|50 ומטה|מסלול כללי/i.test(text)) {
    return "בינוני";
  }

  if (/אג"ח|אגח|שקלי|כספי|סולידי|לבני 60|60 ומעלה|פנסיונרים/i.test(text)) {
    return "נמוך";
  }

  return "בינוני";
}

function getSuggestedRiskByAge(age) {
  if (age === null || age === undefined) return "לא ידוע";
  if (age < 40) return "גבוה/בינוני";
  if (age < 55) return "בינוני";
  return "נמוך/בינוני";
}

function checkTrackAgeFit(age, trackRisk) {
  const suggested = getSuggestedRiskByAge(age);

  if (age === null || age === undefined || trackRisk === "לא ידוע") {
    return {
      status: "unknown",
      label: "חסר גיל / מסלול",
      explanation: "לא ניתן לבדוק התאמת מסלול ללא גיל לקוח או שם מסלול השקעה.",
    };
  }

  if (age < 40) {
    if (trackRisk === "נמוך") {
      return {
        status: "review",
        label: "דורש בדיקה",
        explanation: "לקוח צעיר יחסית במסלול סולידי. ייתכן שהחשיפה אינה תואמת אופק השקעה ארוך.",
      };
    }

    return {
      status: "ok",
      label: "נראה סביר",
      explanation: "רמת הסיכון נראית תואמת לגיל צעיר/אופק ארוך.",
    };
  }

  if (age < 55) {
    return {
      status: "ok",
      label: "נראה סביר",
      explanation: "מסלול ביניים/כללי לרוב מתאים לבדיקה פרטנית בגילאי ביניים.",
    };
  }

  if (trackRisk === "גבוה") {
    return {
      status: "review",
      label: "דורש בדיקה",
      explanation: "לקוח מבוגר יחסית במסלול עם חשיפה מנייתית גבוהה. יש לבדוק התאמה לאופק ולסיבולת סיכון.",
    };
  }

  return {
    status: "ok",
    label: "נראה סביר",
    explanation: "רמת הסיכון נראית סבירה ביחס לגיל מבוגר יותר.",
  };
}

function groupBy(rows, keyFn) {
  const map = new Map();

  rows.forEach((row) => {
    const key = keyFn(row) || "לא ידוע";
    const current = map.get(key) || [];
    current.push(row);
    map.set(key, current);
  });

  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    rows: items,
  }));
}

function aggregateRows(rows, keyFn) {
  return groupBy(rows, keyFn)
    .map((group) => {
      const totalAccumulation = group.rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);
      const totalMonthlyDeposits = group.rows.reduce((sum, row) => sum + safeNumber(row.monthlyDeposit), 0);
      const averageAccumulationFee = weightedAverage(group.rows, "accumulationFee", "currentBalance");
      const agreementMatched = group.rows.filter((row) => row.agreementMatched).length;
      const feeWarnings = group.rows.filter((row) => row.feeStatus === "warning").length;

      return {
        key: group.key,
        rowCount: group.rows.length,
        totalAccumulation,
        totalMonthlyDeposits,
        averageAccumulationFee,
        agreementMatched,
        feeWarnings,
        rows: group.rows,
      };
    })
    .sort((a, b) => b.totalAccumulation - a.totalAccumulation);
}

function weightedAverage(rows, valueField, weightField) {
  let weightedSum = 0;
  let weightSum = 0;

  rows.forEach((row) => {
    const value = row[valueField];
    const weight = safeNumber(row[weightField]);

    if (value === null || value === undefined || value === "") return;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;

    weightedSum += numericValue * weight;
    weightSum += weight;
  });

  if (!weightSum) return null;
  return Number((weightedSum / weightSum).toFixed(4));
}

function getAccumulationBucket(value) {
  const amount = safeNumber(value);

  if (amount < 50000) return "עד 50K";
  if (amount < 100000) return "50K–100K";
  if (amount < 250000) return "100K–250K";
  if (amount < 500000) return "250K–500K";
  return "500K+";
}

function buildFeeAnalysis(rows) {
  const enriched = rows.map((row) => {
    const actualFee = row.accumulationFee;
    const agreementFee = row.accumulationFeeAgreement;
    const gap =
      actualFee === null || actualFee === undefined || agreementFee === null || agreementFee === undefined
        ? null
        : Number((Number(actualFee) - Number(agreementFee)).toFixed(4));

    let status = "unknown";
    if (gap !== null) status = gap <= 0.0001 ? "ok" : "warning";
    if (row.feeStatus === "ok") status = "ok";
    if (row.feeStatus === "warning") status = "warning";

    return {
      ...row,
      calculatedFeeGap: gap,
      calculatedFeeStatus: status,
    };
  });

  const warningRows = enriched.filter((row) => row.calculatedFeeStatus === "warning");
  const okRows = enriched.filter((row) => row.calculatedFeeStatus === "ok");
  const unknownRows = enriched.filter((row) => row.calculatedFeeStatus === "unknown");

  return {
    rows: enriched,
    warningRows,
    okRows,
    unknownRows,
    okCount: okRows.length,
    warningCount: warningRows.length,
    unknownCount: unknownRows.length,
    agreementCoverage: rows.length ? Math.round(((okRows.length + warningRows.length) / rows.length) * 100) : 0,
  };
}

function buildAgeTrackAnalysis(rows) {
  return rows.map((row) => {
    const age = calculateAge(extractBirthDateFromRow(row));
    const trackName = row.investmentTrack || row.investmentTrackRewards || row.investmentTrackCompensation || "";
    const trackRisk = classifyTrackRisk(trackName);
    const fit = checkTrackAgeFit(age, trackRisk);

    return {
      ...row,
      calculatedAge: age,
      ageBucket: getAgeBucket(age),
      trackName,
      trackRisk,
      suggestedRisk: getSuggestedRiskByAge(age),
      ageTrackStatus: fit.status,
      ageTrackLabel: fit.label,
      ageTrackExplanation: fit.explanation,
    };
  });
}

function KpiCard({ label, value, hint }) {
  return (
    <article className="educationKpiCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

function EducationTabs({ activeTab, onChange }) {
  return (
    <div className="educationAnalysisTabs" dir="rtl">
      {EDUCATION_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeTab === tab.key ? "active" : ""}
          onClick={() => onChange(tab.key)}
        >
          {tab.title}
        </button>
      ))}
    </div>
  );
}

function FeesTab({ rows }) {
  const analysis = useMemo(() => buildFeeAnalysis(rows), [rows]);
  const topWarnings = analysis.warningRows
    .slice()
    .sort((a, b) => safeNumber(b.currentBalance) - safeNumber(a.currentBalance));

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="תקינים" value={analysis.okCount} />
        <KpiCard label="חריגים / לבדיקה" value={analysis.warningCount} />
        <KpiCard label="חסר מידע" value={analysis.unknownCount} />
        <KpiCard label="כיסוי הסכמים" value={`${analysis.agreementCoverage}%`} />
      </div>

      <section className="workspaceCard">
        <h3>בדיקת דמי ניהול מצבירה מול הסכם</h3>

        {analysis.rows.length ? (
          <div className="tableScroll">
            <table className="miniTable productRowsTable">
              <thead>
                <tr>
                  <th>גוף מנהל</th>
                  <th>שם קופה</th>
                  <th>צבירה</th>
                  <th>בפועל</th>
                  <th>בהסכם</th>
                  <th>פער</th>
                  <th>סטטוס</th>
                </tr>
              </thead>

              <tbody>
                {analysis.rows.map((row, index) => (
                  <tr key={`${row.policyNumber || row.fundName || "fee"}-${index}`}>
                    <td>{row.issuerOriginal || row.issuer || "-"}</td>
                    <td>{row.fundName || row.productName || "-"}</td>
                    <td>{formatCurrency(row.currentBalance)}</td>
                    <td>{formatPercent(row.accumulationFee)}</td>
                    <td>{formatPercent(row.accumulationFeeAgreement)}</td>
                    <td>{row.calculatedFeeGap === null ? "-" : formatPercent(row.calculatedFeeGap, 4)}</td>
                    <td>
                      <span className={`educationStatusPill ${row.calculatedFeeStatus}`}>
                        {row.calculatedFeeStatus === "ok"
                          ? "תקין"
                          : row.calculatedFeeStatus === "warning"
                            ? "דורש בדיקה"
                            : "חסר מידע"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">אין נתונים לבדיקת דמי ניהול.</p>
        )}
      </section>

      {topWarnings.length > 0 && (
        <section className="workspaceCard">
          <h3>חריגות מרכזיות לפי צבירה</h3>
          <ul className="educationInsightList">
            {topWarnings.slice(0, 8).map((row, index) => (
              <li key={`${row.policyNumber || row.fundName || "warning"}-${index}`}>
                <strong>{row.fundName || row.productName || "קרן השתלמות"}</strong>
                <span>
                  {row.issuerOriginal || row.issuer} · צבירה {formatCurrency(row.currentBalance)} · פער{" "}
                  {row.calculatedFeeGap === null ? "-" : formatPercent(row.calculatedFeeGap, 4)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function AccumulationTab({ rows }) {
  const byBucket = useMemo(
    () =>
      aggregateRows(rows, (row) => getAccumulationBucket(row.currentBalance)).sort((a, b) => {
        const order = ["עד 50K", "50K–100K", "100K–250K", "250K–500K", "500K+"];
        return order.indexOf(a.key) - order.indexOf(b.key);
      }),
    [rows]
  );

  const totalAccumulation = rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);
  const averageBalance = rows.length ? totalAccumulation / rows.length : 0;
  const largestRows = rows
    .slice()
    .sort((a, b) => safeNumber(b.currentBalance) - safeNumber(a.currentBalance))
    .slice(0, 10);

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="סה״כ צבירה" value={formatCurrency(totalAccumulation)} />
        <KpiCard label="ממוצע לקופה" value={formatCurrency(averageBalance)} />
        <KpiCard label="מספר קופות" value={formatNumber(rows.length)} />
        <KpiCard label="קופות מעל 250K" value={rows.filter((row) => safeNumber(row.currentBalance) >= 250000).length} />
      </div>

      <section className="workspaceCard">
        <h3>צבירה לפי מדרגות</h3>

        <div className="educationBucketGrid">
          {byBucket.map((bucket) => {
            const percent = totalAccumulation
              ? Math.round((bucket.totalAccumulation / totalAccumulation) * 100)
              : 0;

            return (
              <article key={bucket.key} className="educationBucketCard">
                <strong>{bucket.key}</strong>
                <span>{formatCurrency(bucket.totalAccumulation)}</span>
                <small>
                  {bucket.rowCount} קופות · {percent}% מהצבירה
                </small>
                <div className="educationMiniBar">
                  <i style={{ width: `${percent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="workspaceCard">
        <h3>הקופות הגדולות ביותר</h3>

        <div className="tableScroll">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>גוף מנהל</th>
                <th>שם קופה</th>
                <th>צבירה</th>
                <th>הפקדה / פרמיה אחרונה</th>
                <th>דמי ניהול</th>
              </tr>
            </thead>

            <tbody>
              {largestRows.map((row, index) => (
                <tr key={`${row.policyNumber || row.fundName || "acc"}-${index}`}>
                  <td>{row.issuerOriginal || row.issuer || "-"}</td>
                  <td>{row.fundName || row.productName || "-"}</td>
                  <td>{formatCurrency(row.currentBalance)}</td>
                  <td>{formatCurrency(row.monthlyDeposit)}</td>
                  <td>{formatPercent(row.accumulationFee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function TracksByAgeTab({ rows }) {
  const enriched = useMemo(() => buildAgeTrackAnalysis(rows), [rows]);
  const byAge = useMemo(() => aggregateRows(enriched, (row) => row.ageBucket), [enriched]);
  const reviewRows = enriched.filter((row) => row.ageTrackStatus === "review");
  const unknownAgeRows = enriched.filter((row) => row.ageTrackStatus === "unknown");

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="דורשים בדיקה" value={reviewRows.length} />
        <KpiCard label="חסר גיל / מסלול" value={unknownAgeRows.length} />
        <KpiCard label="מסלולים שונים" value={new Set(enriched.map((row) => row.trackName).filter(Boolean)).size} />
        <KpiCard label="לקוחות מזוהים" value={new Set(enriched.map(getMemberKey).filter(Boolean)).size} />
      </div>

      <section className="workspaceCard">
        <h3>התאמת מסלול השקעה לפי גיל</h3>
        <p className="hint">
          הבדיקה כאן היא אינדיקציה בלבד: היא משווה בין גיל הלקוח, שם מסלול ההשקעה ורמת סיכון משוערת.
          כשאין תאריך לידה מהפרטים האישיים, השורה מסומנת כחסר מידע.
        </p>

        <div className="tableScroll">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>גיל</th>
                <th>קבוצת גיל</th>
                <th>מסלול</th>
                <th>סיכון מסלול</th>
                <th>סיכון מוצע</th>
                <th>סטטוס</th>
              </tr>
            </thead>

            <tbody>
              {enriched.map((row, index) => (
                <tr key={`${row.policyNumber || row.fundName || "age"}-${index}`}>
                  <td>{row.clientName || row.employeeCode || row.idNumber || "-"}</td>
                  <td>{row.calculatedAge ?? "-"}</td>
                  <td>{row.ageBucket}</td>
                  <td>{row.trackName || "-"}</td>
                  <td>{row.trackRisk}</td>
                  <td>{row.suggestedRisk}</td>
                  <td>
                    <span className={`educationStatusPill ${row.ageTrackStatus}`}>
                      {row.ageTrackLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspaceCard">
        <h3>צבירה לפי קבוצות גיל</h3>

        <div className="educationBucketGrid">
          {byAge.map((bucket) => (
            <article key={bucket.key} className="educationBucketCard">
              <strong>{bucket.key}</strong>
              <span>{formatCurrency(bucket.totalAccumulation)}</span>
              <small>{bucket.rowCount} שורות</small>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function ManagersTab({ rows }) {
  const byManager = useMemo(
    () => aggregateRows(rows, (row) => row.issuerOriginal || row.issuer || row.manager || "לא ידוע"),
    [rows]
  );

  const totalAccumulation = rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="מנהלי השקעות" value={byManager.length} />
        <KpiCard label="סה״כ צבירה" value={formatCurrency(totalAccumulation)} />
        <KpiCard label="מנהל מוביל" value={byManager[0]?.key || "-"} />
        <KpiCard
          label="ריכוזיות מנהל מוביל"
          value={totalAccumulation ? `${Math.round((safeNumber(byManager[0]?.totalAccumulation) / totalAccumulation) * 100)}%` : "0%"}
        />
      </div>

      <section className="workspaceCard">
        <h3>צבירות לפי מנהלי השקעות</h3>

        <div className="tableScroll">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>מנהל השקעות / גוף מנהל</th>
                <th>מספר קופות</th>
                <th>סה״כ צבירה</th>
                <th>אחוז מהתיק</th>
                <th>הפקדה / פרמיה אחרונה</th>
                <th>דמי ניהול ממוצעים</th>
                <th>חריגות דמי ניהול</th>
              </tr>
            </thead>

            <tbody>
              {byManager.map((manager) => {
                const percent = totalAccumulation
                  ? Math.round((manager.totalAccumulation / totalAccumulation) * 100)
                  : 0;

                return (
                  <tr key={manager.key}>
                    <td>{manager.key}</td>
                    <td>{manager.rowCount}</td>
                    <td>{formatCurrency(manager.totalAccumulation)}</td>
                    <td>{percent}%</td>
                    <td>{formatCurrency(manager.totalMonthlyDeposits)}</td>
                    <td>{formatPercent(manager.averageAccumulationFee)}</td>
                    <td>{manager.feeWarnings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspaceCard">
        <h3>פיזור מנהלים</h3>
        <div className="educationManagerBars">
          {byManager.map((manager) => {
            const percent = totalAccumulation
              ? Math.round((manager.totalAccumulation / totalAccumulation) * 100)
              : 0;

            return (
              <div key={manager.key} className="educationManagerBarRow">
                <div>
                  <strong>{manager.key}</strong>
                  <span>{formatCurrency(manager.totalAccumulation)} · {percent}%</span>
                </div>
                <div className="educationMiniBar">
                  <i style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

export default function EducationFundAnalysisView({ analysisData }) {
  const { rows, summary, warnings } = getEducationFundData(analysisData);
  const [activeTab, setActiveTab] = useState("fees");

  const totalAccumulation = rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);
  const totalMonthlyDeposits = rows.reduce((sum, row) => sum + safeNumber(row.monthlyDeposit), 0);

  return (
    <section className="educationFundAnalysisView" dir="rtl">
      <div className="productAnalysisHeader">
        <div>
          <p className="eyebrow">Education Fund</p>
          <h2>ניתוח קרן השתלמות</h2>
          <p>
            ניתוח לפי דמי ניהול, צבירה, התאמת מסלול השקעה לגיל וצבירות לפי מנהלי השקעות.
          </p>
        </div>
      </div>

      <div className="educationTopKpiGrid">
        <KpiCard label="שורות שנקלטו" value={summary.unifiedRowCount || rows.length || 0} />
        <KpiCard label="סה״כ צבירה" value={formatCurrency(summary.totalAccumulation || totalAccumulation)} />
        <KpiCard label="הפקדה / פרמיה אחרונה" value={formatCurrency(summary.totalMonthlyDeposits || totalMonthlyDeposits)} />
        <KpiCard label="גופים מנהלים" value={summary.issuerCount || new Set(rows.map((row) => row.issuerOriginal || row.issuer).filter(Boolean)).size} />
      </div>

      {warnings.length > 0 && (
        <section className="workspaceCard">
          <h3>אזהרות כלליות</h3>
          <ul className="warningList">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <EducationTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "fees" && <FeesTab rows={rows} />}
      {activeTab === "accumulation" && <AccumulationTab rows={rows} />}
      {activeTab === "tracksByAge" && <TracksByAgeTab rows={rows} />}
      {activeTab === "managers" && <ManagersTab rows={rows} />}
    </section>
  );
}
