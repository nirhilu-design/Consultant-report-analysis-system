// Path: src/components/ExecutiveInsuranceAnalysisView.jsx
// v68 — Executive insurance fee controls split into separate period tables
// Scope: product page similar to Pension/Education, with focused controls:
// 1) דמי ניהול with separate summary/detail tables per policy period
// 2) צבירות with chart + table
// 3) יצרנים / חברות ביטוח
// Period model: before 2004, 2004-2013, 2013+ without coefficient.

import React, { useMemo, useState } from "react";

const TABS = {
  HOME: "home",
  FEES: "fees",
  ACCUMULATION: "accumulation",
  ISSUERS: "issuers",
};

const PERIOD_LABELS = {
  before2004: "לפני 2004",
  from2004To2013: "2004-2013",
  from2013NoCoefficient: "2013 והלאה ללא מקדם",
  unknown: "לא זוהתה תקופה",
};

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
  if (value === null || value === undefined || value === "") return "—";
  return `${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 }).format(toNumber(value))}%`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
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
    const key = [
      normalizeText(row.employeeCode || row.idNumber || row.memberName),
      normalizeText(row.policyId || row.policyNumber),
      normalizeText(row.issuer || row.issuerOriginal),
      normalizeText(row.sourceRowNumber),
      index,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPeriodKey(row) {
  return row?.agreementPeriod || row?.executiveInsurancePeriod || row?.periodKey || "unknown";
}

function getPeriodLabel(rowOrKey) {
  const key = typeof rowOrKey === "string" ? rowOrKey : getPeriodKey(rowOrKey);
  return PERIOD_LABELS[key] || PERIOD_LABELS.unknown;
}

function getIssuer(row) {
  return normalizeText(firstDefined(row?.issuer, row?.companyName, row?.issuerOriginal)) || "לא ידוע";
}

function getAccumulation(row) {
  return toNumber(firstDefined(row?.totalAccumulation, row?.accumulation, row?.currentBalance));
}

function getEmployeeLabel(row) {
  return normalizeText(firstDefined(row?.memberName, row?.employeeCode, row?.idNumber, row?.policyNumber)) || "—";
}

function makeEmptyGroup(label) {
  return {
    label,
    count: 0,
    accumulation: 0,
    premiumFeeSum: 0,
    premiumFeeCount: 0,
    accumulationFeeSum: 0,
    accumulationFeeCount: 0,
    ok: 0,
    notOk: 0,
    missingAgreement: 0,
    missingData: 0,
  };
}

function addRowToGroup(group, row) {
  group.count += 1;
  group.accumulation += getAccumulation(row);
  if (row.actualPremiumFeePercent !== null && row.actualPremiumFeePercent !== undefined) {
    group.premiumFeeSum += toNumber(row.actualPremiumFeePercent);
    group.premiumFeeCount += 1;
  }
  if (row.actualAccumulationFeePercent !== null && row.actualAccumulationFeePercent !== undefined) {
    group.accumulationFeeSum += toNumber(row.actualAccumulationFeePercent);
    group.accumulationFeeCount += 1;
  }
  if (row.feeStatus === "תקין") group.ok += 1;
  else group.notOk += 1;
  if (row.feeIssueCode === "missingAgreement") group.missingAgreement += 1;
  if (row.feeIssueCode === "missingData") group.missingData += 1;
}

function groupBy(rows, getKey, getLabel) {
  const map = new Map();
  rows.forEach((row) => {
    const key = normalizeText(getKey(row)) || "unknown";
    const label = getLabel ? getLabel(row, key) : key;
    const item = map.get(key) || makeEmptyGroup(label);
    addRowToGroup(item, row);
    map.set(key, item);
  });
  return [...map.values()].sort((a, b) => b.accumulation - a.accumulation || b.count - a.count);
}

function groupByIssuer(rows) {
  return groupBy(rows, getIssuer, (row) => getIssuer(row));
}

function groupByPeriod(rows) {
  const preferredOrder = ["before2004", "from2004To2013", "from2013NoCoefficient", "unknown"];
  const map = new Map(preferredOrder.map((key) => [key, makeEmptyGroup(PERIOD_LABELS[key])]));
  rows.forEach((row) => {
    const key = getPeriodKey(row);
    const item = map.get(key) || makeEmptyGroup(getPeriodLabel(key));
    addRowToGroup(item, row);
    map.set(key, item);
  });
  return [...map.entries()]
    .filter(([, item]) => item.count > 0)
    .sort((a, b) => preferredOrder.indexOf(a[0]) - preferredOrder.indexOf(b[0]))
    .map(([, item]) => item);
}


function getPeriodSections(rows) {
  const preferredOrder = ["before2004", "from2004To2013", "from2013NoCoefficient", "unknown"];
  return preferredOrder
    .map((key) => {
      const periodRows = rows.filter((row) => getPeriodKey(row) === key);
      const summary = groupByPeriod(periodRows)[0] || makeEmptyGroup(PERIOD_LABELS[key]);
      return { key, label: PERIOD_LABELS[key], rows: periodRows, summary };
    })
    .filter((section) => section.rows.length > 0);
}

function KpiCard({ label, value, subtext, tone = "blue", onClick }) {
  const Tag = onClick ? "button" : "article";
  return (
    <Tag type={onClick ? "button" : undefined} className={`productKpiCard ${tone} ${onClick ? "clickable" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subtext && <small>{subtext}</small>}
    </Tag>
  );
}

function MiniBar({ value, max, label }) {
  const width = max ? Math.max((toNumber(value) / max) * 100, value ? 5 : 0) : 0;
  return (
    <div className="issuerBarTrack" aria-label={label}>
      <div className="issuerBarFill" style={{ width: `${width}%` }} />
    </div>
  );
}

function ProductHome({ rows, onOpenTab }) {
  const issuers = groupByIssuer(rows);
  const periods = groupByPeriod(rows);
  const okRows = rows.filter((row) => row.feeStatus === "תקין");
  const totalAccumulation = rows.reduce((sum, row) => sum + getAccumulation(row), 0);
  const notOkRows = rows.length - okRows.length;

  return (
    <section className="productAnalysisPanel executiveProductHome">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Product Home</p>
          <h3>בית מוצר — ביטוח מנהלים</h3>
          <p>מכאן יוצאים לבקרות. המבנה נשאר זהה לשאר המוצרים: תמונת מצב, ואז בקרות לפי לשוניות.</p>
        </div>
      </div>

      <div className="productKpiGrid four">
        <KpiCard label="פוליסות" value={fmtNumber(rows.length)} subtext="שורות ביטוח מנהלים" tone="blue" />
        <KpiCard label="חברות ביטוח" value={fmtNumber(issuers.length)} subtext="יצרנים מזוהים" tone="gold" />
        <KpiCard label="צבירה כוללת" value={fmtMoney(totalAccumulation)} subtext="ערך פדיון כולל" tone="blue" />
        <KpiCard label="לא תקין בדמי ניהול" value={fmtNumber(notOkRows)} subtext="לבדיקה מול הסכם" tone={notOkRows ? "red" : "green"} />
      </div>

      <div className="productControlGrid">
        <button type="button" className="productControlCard" onClick={() => onOpenTab(TABS.FEES)}>
          <span className="productPortalStatus">בקרה</span>
          <strong>דמי ניהול</strong>
          <small>בדיקה תקין / לא תקין לפי חברת ביטוח ולפי תקופת פוליסה.</small>
        </button>
        <button type="button" className="productControlCard" onClick={() => onOpenTab(TABS.ACCUMULATION)}>
          <span className="productPortalStatus">ניתוח</span>
          <strong>צבירות</strong>
          <small>גרף וטבלה מסכמת לפי תקופות וחברות ביטוח.</small>
        </button>
        <button type="button" className="productControlCard" onClick={() => onOpenTab(TABS.ISSUERS)}>
          <span className="productPortalStatus">ניתוח</span>
          <strong>יצרנים / חברות ביטוח</strong>
          <small>פילוח פוליסות וצבירה לפי יצרן.</small>
        </button>
      </div>

      <div className="productTableWrap compactTable">
        <table className="productTable">
          <thead>
            <tr>
              <th>תקופת ביטוח מנהלים</th>
              <th>פוליסות</th>
              <th>צבירה</th>
              <th>תקין</th>
              <th>לא תקין</th>
              <th>פרמיה ממוצעת</th>
              <th>צבירה ממוצעת</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((item) => (
              <tr key={item.label}>
                <td><strong>{item.label}</strong></td>
                <td>{fmtNumber(item.count)}</td>
                <td>{fmtMoney(item.accumulation)}</td>
                <td>{fmtNumber(item.ok)}</td>
                <td>{fmtNumber(item.notOk)}</td>
                <td>{fmtPct(item.premiumFeeCount ? item.premiumFeeSum / item.premiumFeeCount : null)}</td>
                <td>{fmtPct(item.accumulationFeeCount ? item.accumulationFeeSum / item.accumulationFeeCount : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PeriodFeeTable({ section }) {
  const periodRows = section.rows;
  const okRows = periodRows.filter((row) => row.feeStatus === "תקין");
  const notOkRows = periodRows.filter((row) => row.feeStatus !== "תקין");
  const issuerSummary = groupByIssuer(periodRows);
  const detailRows = periodRows.slice(0, 80);

  return (
    <article className="periodFeeBlock">
      <div className="periodFeeHeader">
        <div>
          <p className="eyebrow">Period Fee Control</p>
          <h4>{section.label}</h4>
          <p>בדיקה עצמאית לתקופת הפוליסות הזו בלבד, מול מבנה דמי הניהול הרלוונטי בדוח ההסכמים.</p>
        </div>
        <div className="periodFeeStats">
          <span className="statusPill ok">תקין: {fmtNumber(okRows.length)}</span>
          <span className="statusPill bad">לא תקין: {fmtNumber(notOkRows.length)}</span>
        </div>
      </div>

      <div className="productTableWrap compactTable">
        <table className="productTable">
          <thead>
            <tr>
              <th>חברת ביטוח</th>
              <th>פוליסות</th>
              <th>תקין</th>
              <th>לא תקין</th>
              <th>חסר הסכם</th>
              <th>חסר נתון</th>
              <th>צבירה</th>
              <th>דמי ניהול מפרמיה ממוצע</th>
              <th>דמי ניהול מצבירה ממוצע</th>
            </tr>
          </thead>
          <tbody>
            {issuerSummary.map((item) => (
              <tr key={`${section.key}-${item.label}`}>
                <td><strong>{item.label}</strong></td>
                <td>{fmtNumber(item.count)}</td>
                <td>{fmtNumber(item.ok)}</td>
                <td>{fmtNumber(item.notOk)}</td>
                <td>{fmtNumber(item.missingAgreement)}</td>
                <td>{fmtNumber(item.missingData)}</td>
                <td>{fmtMoney(item.accumulation)}</td>
                <td>{fmtPct(item.premiumFeeCount ? item.premiumFeeSum / item.premiumFeeCount : null)}</td>
                <td>{fmtPct(item.accumulationFeeCount ? item.accumulationFeeSum / item.accumulationFeeCount : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="productTableWrap">
        <table className="productTable">
          <thead>
            <tr>
              <th>סטטוס</th>
              <th>עובד / פוליסה</th>
              <th>חברת ביטוח</th>
              <th>שנת תחילה</th>
              <th>פרמיה בפועל</th>
              <th>פרמיה הסכם</th>
              <th>צבירה בפועל</th>
              <th>צבירה הסכם</th>
              <th>צבירה ₪</th>
              <th>הערה</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map((row, index) => (
              <tr key={`${section.key}-${row.policyId || row.policyNumber || index}-${index}`}>
                <td><span className={`statusPill ${row.feeStatus === "תקין" ? "ok" : "bad"}`}>{row.feeStatus || "לא תקין"}</span></td>
                <td>{getEmployeeLabel(row)}</td>
                <td>{getIssuer(row)}</td>
                <td>{row.insuranceStartYear || "—"}</td>
                <td>{fmtPct(row.actualPremiumFeePercent)}</td>
                <td>{fmtPct(row.agreementPremiumFeePercent)}</td>
                <td>{fmtPct(row.actualAccumulationFeePercent)}</td>
                <td>{fmtPct(row.agreementAccumulationFeePercent)}</td>
                <td>{fmtMoney(getAccumulation(row))}</td>
                <td>{row.feeIssue || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function FeesTab({ rows }) {
  const okRows = rows.filter((row) => row.feeStatus === "תקין");
  const notOkRows = rows.filter((row) => row.feeStatus !== "תקין");
  const periodSections = getPeriodSections(rows);

  return (
    <section className="productAnalysisPanel">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Management Fees Control</p>
          <h3>בקרת דמי ניהול</h3>
          <p>הבקרה מופרדת לפי תקופות ביטוח מנהלים. לכל תקופה מוצגת טבלת בדיקה עצמאית, כי מבנה דמי הניהול שונה בין התקופות.</p>
        </div>
      </div>

      <div className="productKpiGrid four">
        <KpiCard label="תקין" value={fmtNumber(okRows.length)} subtext="שורות שעומדות בהסכם" tone="green" />
        <KpiCard label="לא תקין" value={fmtNumber(notOkRows.length)} subtext="חריגה / חסר הסכם / חסר נתון" tone="red" />
        <KpiCard label="אחוז תקינות" value={`${rows.length ? Math.round((okRows.length / rows.length) * 100) : 0}%`} subtext="מתוך כלל הפוליסות" tone="gold" />
        <KpiCard label="תקופות פעילות" value={fmtNumber(periodSections.length)} subtext="טבלה נפרדת לכל תקופה" tone="blue" />
      </div>

      <div className="periodFeeGrid">
        {periodSections.map((section) => (
          <PeriodFeeTable key={section.key} section={section} />
        ))}
      </div>
    </section>
  );
}

function AccumulationTab({ rows }) {
  const byIssuer = groupByIssuer(rows);
  const byPeriod = groupByPeriod(rows);
  const maxIssuerAccumulation = Math.max(...byIssuer.map((item) => item.accumulation), 1);
  const maxPeriodAccumulation = Math.max(...byPeriod.map((item) => item.accumulation), 1);

  return (
    <section className="productAnalysisPanel">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Accumulation Analysis</p>
          <h3>ניתוח צבירות</h3>
          <p>גרף וטבלה כדי לראות איפה יושבת הצבירה של ביטוחי המנהלים.</p>
        </div>
      </div>

      <div className="issuerBarsList">
        {byIssuer.map((item) => (
          <article className="issuerBarCard" key={item.label}>
            <div className="issuerBarTop">
              <strong>{item.label}</strong>
              <span>{fmtNumber(item.count)} פוליסות · {fmtMoney(item.accumulation)}</span>
            </div>
            <MiniBar value={item.accumulation} max={maxIssuerAccumulation} label={item.label} />
            <small>תקין: {fmtNumber(item.ok)} · לא תקין: {fmtNumber(item.notOk)}</small>
          </article>
        ))}
      </div>

      <div className="productTableWrap compactTable">
        <table className="productTable">
          <thead>
            <tr>
              <th>תקופה</th>
              <th>פוליסות</th>
              <th>צבירה</th>
              <th>חלק יחסי</th>
              <th>תקין</th>
              <th>לא תקין</th>
            </tr>
          </thead>
          <tbody>
            {byPeriod.map((item) => {
              const total = byPeriod.reduce((sum, period) => sum + period.accumulation, 0);
              return (
                <tr key={item.label}>
                  <td><strong>{item.label}</strong></td>
                  <td>{fmtNumber(item.count)}</td>
                  <td>{fmtMoney(item.accumulation)}</td>
                  <td>
                    <MiniBar value={item.accumulation} max={maxPeriodAccumulation} label={item.label} />
                    <small>{fmtPct(total ? (item.accumulation / total) * 100 : 0)}</small>
                  </td>
                  <td>{fmtNumber(item.ok)}</td>
                  <td>{fmtNumber(item.notOk)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="productTableWrap compactTable">
        <table className="productTable">
          <thead>
            <tr>
              <th>חברת ביטוח</th>
              <th>פוליסות</th>
              <th>צבירה</th>
              <th>צבירה ממוצעת לפוליסה</th>
              <th>תקין בדמי ניהול</th>
              <th>לא תקין בדמי ניהול</th>
            </tr>
          </thead>
          <tbody>
            {byIssuer.map((item) => (
              <tr key={item.label}>
                <td><strong>{item.label}</strong></td>
                <td>{fmtNumber(item.count)}</td>
                <td>{fmtMoney(item.accumulation)}</td>
                <td>{fmtMoney(item.count ? item.accumulation / item.count : 0)}</td>
                <td>{fmtNumber(item.ok)}</td>
                <td>{fmtNumber(item.notOk)}</td>
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
          <p>חלוקה של פוליסות, צבירה וסטטוס דמי ניהול לפי חברת הביטוח.</p>
        </div>
      </div>

      <div className="issuerBarsList">
        {issuers.map((item) => (
          <article className="issuerBarCard" key={item.label}>
            <div className="issuerBarTop">
              <strong>{item.label}</strong>
              <span>{fmtNumber(item.count)} פוליסות · {fmtMoney(item.accumulation)}</span>
            </div>
            <MiniBar value={item.count} max={maxCount} label={item.label} />
            <small>תקין: {fmtNumber(item.ok)} · לא תקין: {fmtNumber(item.notOk)}</small>
          </article>
        ))}
      </div>

      <div className="productTableWrap compactTable">
        <table className="productTable">
          <thead>
            <tr>
              <th>חברת ביטוח</th>
              <th>פוליסות</th>
              <th>צבירה</th>
              <th>צבירה ממוצעת</th>
              <th>תקין</th>
              <th>לא תקין</th>
              <th>דמי ניהול מפרמיה ממוצע</th>
              <th>דמי ניהול מצבירה ממוצע</th>
            </tr>
          </thead>
          <tbody>
            {issuers.map((item) => (
              <tr key={item.label}>
                <td><strong>{item.label}</strong></td>
                <td>{fmtNumber(item.count)}</td>
                <td>{fmtMoney(item.accumulation)}</td>
                <td>{fmtMoney(item.count ? item.accumulation / item.count : 0)}</td>
                <td>{fmtNumber(item.ok)}</td>
                <td>{fmtNumber(item.notOk)}</td>
                <td>{fmtPct(item.premiumFeeCount ? item.premiumFeeSum / item.premiumFeeCount : null)}</td>
                <td>{fmtPct(item.accumulationFeeCount ? item.accumulationFeeSum / item.accumulationFeeCount : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ExecutiveInsuranceAnalysisView({ analysisData }) {
  const rows = useMemo(() => dedupeRows(getExecutiveRows(analysisData)), [analysisData]);
  const [activeTab, setActiveTab] = useState(TABS.HOME);

  const issuers = groupByIssuer(rows);
  const periods = groupByPeriod(rows);
  const okRows = rows.filter((row) => row.feeStatus === "תקין");
  const totalAccumulation = rows.reduce((sum, row) => sum + getAccumulation(row), 0);

  return (
    <section className="productAnalysisView executiveInsuranceView" dir="rtl">
      <header className="productHero compactHero">
        <div>
          <p className="eyebrow">Product Analysis</p>
          <h2>ביטוח מנהלים</h2>
          <p>מסך מוצר מלא: בית מוצר, דמי ניהול, צבירות ויצרנים. דמי הניהול מחולקים לפי תקופות פוליסה.</p>
        </div>
      </header>

      <div className="productKpiGrid four">
        <KpiCard label="פוליסות" value={fmtNumber(rows.length)} subtext="שורות שזוהו בדוח היועץ" tone="blue" />
        <KpiCard label="חברות ביטוח" value={fmtNumber(issuers.length)} subtext="יצרנים שונים" tone="gold" />
        <KpiCard label="תקופות" value={fmtNumber(periods.length)} subtext="לפני 2004 / 2004-2013 / 2013+" tone="blue" />
        <KpiCard label="תקינות דמי ניהול" value={`${rows.length ? Math.round((okRows.length / rows.length) * 100) : 0}%`} subtext={fmtMoney(totalAccumulation)} tone="green" />
      </div>

      <nav className="productTabs" aria-label="ביטוח מנהלים ניתוחים">
        <button type="button" className={activeTab === TABS.HOME ? "active" : ""} onClick={() => setActiveTab(TABS.HOME)}>בית מוצר</button>
        <button type="button" className={activeTab === TABS.FEES ? "active" : ""} onClick={() => setActiveTab(TABS.FEES)}>דמי ניהול</button>
        <button type="button" className={activeTab === TABS.ACCUMULATION ? "active" : ""} onClick={() => setActiveTab(TABS.ACCUMULATION)}>צבירות</button>
        <button type="button" className={activeTab === TABS.ISSUERS ? "active" : ""} onClick={() => setActiveTab(TABS.ISSUERS)}>יצרנים</button>
      </nav>

      {activeTab === TABS.HOME ? <ProductHome rows={rows} onOpenTab={setActiveTab} /> : null}
      {activeTab === TABS.FEES ? <FeesTab rows={rows} /> : null}
      {activeTab === TABS.ACCUMULATION ? <AccumulationTab rows={rows} /> : null}
      {activeTab === TABS.ISSUERS ? <IssuersTab rows={rows} /> : null}
    </section>
  );
}
