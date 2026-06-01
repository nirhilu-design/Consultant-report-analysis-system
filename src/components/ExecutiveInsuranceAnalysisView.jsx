// Path: src/components/ExecutiveInsuranceAnalysisView.jsx
// v66 — Product screen for ביטוח מנהלים

import React, { useMemo, useState } from "react";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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
  if (value === null || value === undefined || value === "") return "—";
  return `${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 }).format(toNumber(value))}%`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function getExecutiveRows(analysisData) {
  const productResult = analysisData?.productResults?.executiveInsurance || analysisData;
  return [
    ...asArray(productResult?.executiveInsuranceRows),
    ...asArray(productResult?.unifiedRows),
    ...asArray(productResult?.rawRows),
    ...asArray(productResult?.managerResults).flatMap((result) =>
      asArray(result?.executiveInsuranceRows || result?.unifiedRows || result?.rawRows)
    ),
  ].filter(Boolean);
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row, index) => {
    const key = [row.employeeCode, row.policyId, row.policyNumber, row.issuer, row.sourceRowNumber, index].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupByIssuer(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const issuer = normalizeText(row.issuer || row.companyName || row.issuerOriginal) || "לא ידוע";
    const item = map.get(issuer) || {
      issuer,
      count: 0,
      accumulation: 0,
      ok: 0,
      notOk: 0,
      deathCover: 0,
    };
    item.count += 1;
    item.accumulation += toNumber(row.totalAccumulation || row.accumulation);
    item.deathCover += toNumber(row.deathCoverAmount);
    if (row.feeStatus === "תקין") item.ok += 1;
    else item.notOk += 1;
    map.set(issuer, item);
  });

  return [...map.values()].sort((a, b) => b.count - a.count || b.accumulation - a.accumulation);
}

function KpiCard({ label, value, subtext, tone = "blue" }) {
  return (
    <article className={`productKpiCard ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subtext && <small>{subtext}</small>}
    </article>
  );
}

function FeesTab({ rows }) {
  const okRows = rows.filter((row) => row.feeStatus === "תקין");
  const notOkRows = rows.filter((row) => row.feeStatus !== "תקין");
  const samples = rows.slice(0, 80);

  return (
    <section className="productAnalysisPanel">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Management Fees</p>
          <h3>בדיקת דמי ניהול</h3>
          <p>הבדיקה פשוטה ובינארית בלבד: תקין / לא תקין מול קובץ ההסכמים.</p>
        </div>
      </div>

      <div className="productKpiGrid four">
        <KpiCard label="תקין" value={fmtNumber(okRows.length)} subtext="שורות שעומדות בהסכם" tone="green" />
        <KpiCard label="לא תקין" value={fmtNumber(notOkRows.length)} subtext="חריגה / חסר הסכם / חסר נתון" tone="red" />
        <KpiCard label="אחוז תקינות" value={`${rows.length ? Math.round((okRows.length / rows.length) * 100) : 0}%`} subtext="מתוך כלל הפוליסות" tone="gold" />
        <KpiCard label="סה״כ פוליסות" value={fmtNumber(rows.length)} subtext="שורות ביטוח מנהלים" tone="blue" />
      </div>

      <div className="productTableWrap">
        <table className="productTable">
          <thead>
            <tr>
              <th>סטטוס</th>
              <th>עובד</th>
              <th>חברת ביטוח</th>
              <th>שנת תחילה</th>
              <th>פרמיה בפועל</th>
              <th>פרמיה הסכם</th>
              <th>צבירה בפועל</th>
              <th>צבירה הסכם</th>
              <th>צבירה ₪</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((row, index) => (
              <tr key={`${row.policyId || row.policyNumber || index}-${index}`}>
                <td><span className={`statusPill ${row.feeStatus === "תקין" ? "ok" : "bad"}`}>{row.feeStatus || "לא תקין"}</span></td>
                <td>{row.memberName || row.employeeCode || "—"}</td>
                <td>{row.issuer || row.issuerOriginal || "—"}</td>
                <td>{row.insuranceStartYear || "—"}</td>
                <td>{fmtPct(row.actualPremiumFeePercent)}</td>
                <td>{fmtPct(row.agreementPremiumFeePercent)}</td>
                <td>{fmtPct(row.actualAccumulationFeePercent)}</td>
                <td>{fmtPct(row.agreementAccumulationFeePercent)}</td>
                <td>{fmtMoney(row.totalAccumulation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IssuersTab({ rows }) {
  const issuers = groupByIssuer(rows);
  const maxCount = Math.max(...issuers.map((item) => item.count), 1);

  return (
    <section className="productAnalysisPanel">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Insurance Companies</p>
          <h3>ניתוח לפי יצרנים / חברות ביטוח</h3>
          <p>חלוקה פשוטה של הפוליסות והצבירה לפי חברת הביטוח.</p>
        </div>
      </div>

      <div className="issuerBarsList">
        {issuers.map((item) => (
          <article className="issuerBarCard" key={item.issuer}>
            <div className="issuerBarTop">
              <strong>{item.issuer}</strong>
              <span>{fmtNumber(item.count)} פוליסות · {fmtMoney(item.accumulation)}</span>
            </div>
            <div className="issuerBarTrack" aria-hidden="true">
              <div className="issuerBarFill" style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }} />
            </div>
            <small>תקין: {fmtNumber(item.ok)} · לא תקין: {fmtNumber(item.notOk)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ExecutiveInsuranceAnalysisView({ analysisData }) {
  const rows = useMemo(() => dedupeRows(getExecutiveRows(analysisData)), [analysisData]);
  const [activeTab, setActiveTab] = useState("fees");

  const issuers = groupByIssuer(rows);
  const okRows = rows.filter((row) => row.feeStatus === "תקין");
  const totalAccumulation = rows.reduce((sum, row) => sum + toNumber(row.totalAccumulation || row.accumulation), 0);

  return (
    <section className="productAnalysisView executiveInsuranceView" dir="rtl">
      <header className="productHero compactHero">
        <div>
          <p className="eyebrow">Product Analysis</p>
          <h2>ביטוח מנהלים</h2>
          <p>ניתוח ראשוני ממוקד: בדיקת דמי ניהול וניתוח לפי יצרנים / חברות ביטוח.</p>
        </div>
      </header>

      <div className="productKpiGrid four">
        <KpiCard label="פוליסות" value={fmtNumber(rows.length)} subtext="שורות שזוהו בדוח היועץ" tone="blue" />
        <KpiCard label="חברות ביטוח" value={fmtNumber(issuers.length)} subtext="יצרנים שונים" tone="gold" />
        <KpiCard label="צבירה כוללת" value={fmtMoney(totalAccumulation)} subtext="ערך פדיון כולל" tone="blue" />
        <KpiCard label="דמי ניהול תקינים" value={`${rows.length ? Math.round((okRows.length / rows.length) * 100) : 0}%`} subtext="תקין / לא תקין בלבד" tone="green" />
      </div>

      <nav className="productTabs" aria-label="ביטוח מנהלים ניתוחים">
        <button type="button" className={activeTab === "fees" ? "active" : ""} onClick={() => setActiveTab("fees")}>דמי ניהול</button>
        <button type="button" className={activeTab === "issuers" ? "active" : ""} onClick={() => setActiveTab("issuers")}>יצרנים</button>
      </nav>

      {activeTab === "fees" ? <FeesTab rows={rows} /> : <IssuersTab rows={rows} />}
    </section>
  );
}
