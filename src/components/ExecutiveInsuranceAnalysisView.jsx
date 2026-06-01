// Path: src/components/ExecutiveInsuranceAnalysisView.jsx
// v71 — Executive insurance dashboard alignment: focused home, 3-state fees, merged accumulations/issuers, employee-level errors
// Scope: product page similar to Pension/Education, with focused controls:
// 1) דמי ניהול with separate summary/detail tables per policy period
// 2) צבירות ויצרנים in one combined analysis tab
// 3) Employee-level errors / data-quality control
// Period model: before 2004, 2004-2013, 2013+ without coefficient.

import React, { useMemo, useState } from "react";

const TABS = {
  HOME: "home",
  FEES: "fees",
  ACCUMULATION: "accumulation",
  ERRORS: "errors",
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
function getIssueLabel(row) {
  if (isOperatorOnly(row)) return "מתפעל בלבד — אין בדיקת דמי ניהול מול הסכם";
  if (row?.feeIssue) return normalizeText(row.feeIssue);
  if (row?.feeIssueCode === "missingAgreement") return "לא נמצא הסכם מתאים לתקופה / חברת ביטוח";
  if (row?.feeIssueCode === "missingData") return "חסר נתון דמי ניהול בדוח היועץ";
  if (row?.feeStatus !== "תקין") return "דמי הניהול בפועל אינם תואמים להסכם";
  if (!row?.insuranceStartYear) return "חסרה שנת תחילת ביטוח";
  if (getPeriodKey(row) === "unknown") return "לא זוהתה תקופת פוליסה";
  return "—";
}

function getRowsWithIssues(rows) {
  return rows.filter((row) => {
    if (isOperatorOnly(row)) return false;
    if (row.feeStatus !== "תקין") return true;
    if (!row.insuranceStartYear) return true;
    if (getPeriodKey(row) === "unknown") return true;
    return false;
  });
}


function getPolicyId(row) {
  return normalizeText(firstDefined(row?.policyId, row?.policyNumber, row?.mofid, row?.policyNo)) || "—";
}

function getEmployeeCode(row) {
  return normalizeText(firstDefined(row?.employeeCode, row?.employeeId, row?.idNumber, row?.memberId)) || "—";
}

function getEmployeeName(row) {
  return normalizeText(firstDefined(row?.memberName, row?.employeeName, row?.name)) || "—";
}

function getUniqueEmployeeCount(rows) {
  const keys = new Set();
  rows.forEach((row, index) => {
    keys.add(normalizeText(firstDefined(row?.employeeCode, row?.idNumber, row?.memberName, row?.policyNumber, index)));
  });
  return keys.size;
}

function hasAgreementFeeValues(row) {
  return (
    row?.agreementPremiumFeePercent !== null &&
    row?.agreementPremiumFeePercent !== undefined &&
    row?.agreementPremiumFeePercent !== ""
  ) || (
    row?.agreementAccumulationFeePercent !== null &&
    row?.agreementAccumulationFeePercent !== undefined &&
    row?.agreementAccumulationFeePercent !== ""
  );
}

function hasAgreementMatch(row) {
  return Boolean(
    normalizeText(row?.agreementPeriod) ||
    normalizeText(row?.agreementIssuer) ||
    normalizeText(row?.agreementIssuerFound) ||
    normalizeText(row?.matchedAgreementIssuer) ||
    hasAgreementFeeValues(row)
  );
}

function isOperatorOnly(row) {
  const explicitText = [
    row?.feeIssue,
    row?.feeIssueCode,
    row?.agreementType,
    row?.serviceType,
    row?.agreementNotes,
    row?.operatorStatus,
  ]
    .map(normalizeText)
    .join(" ");

  if (/מתפעל|תפעול|operator/i.test(explicitText)) return true;

  // In the executive-insurance agreements file, cells such as "אין הסכם" are parsed as null fees.
  // If the issuer/period was matched but both agreement-fee values are empty, treat it as operator-only,
  // not as a management-fee breach.
  return hasAgreementMatch(row) && !hasAgreementFeeValues(row);
}

function isNotCheckable(row) {
  return (
    isOperatorOnly(row) ||
    row?.feeIssueCode === "missingAgreement" ||
    row?.feeIssueCode === "missingData" ||
    getPeriodKey(row) === "unknown" ||
    !row?.insuranceStartYear
  );
}

function getFeeStatusKind(row) {
  if (row?.feeStatus === "תקין") return "ok";
  if (isOperatorOnly(row)) return "operatorOnly";
  if (isNotCheckable(row)) return "notCheckable";
  return "exception";
}

function getFeeStatusLabel(row) {
  const kind = getFeeStatusKind(row);
  if (kind === "ok") return "תקין";
  if (kind === "operatorOnly") return "מתפעל בלבד";
  if (kind === "notCheckable") return "לא ניתן לבדיקה";
  return "חריגה";
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
    exception: 0,
    operatorOnly: 0,
    notCheckable: 0,
    missingAgreement: 0,
    missingData: 0,
    unknownPeriod: 0,
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
  if (row.feeStatus === "תקין") {
    group.ok += 1;
  } else if (isOperatorOnly(row)) {
    group.operatorOnly += 1;
    group.notCheckable += 1;
    group.notOk += 1;
  } else if (isNotCheckable(row)) {
    group.notCheckable += 1;
    group.notOk += 1;
  } else {
    group.exception += 1;
    group.notOk += 1;
  }
  if (row.feeIssueCode === "missingAgreement") group.missingAgreement += 1;
  if (row.feeIssueCode === "missingData") group.missingData += 1;
  if (getPeriodKey(row) === "unknown" || !row.insuranceStartYear) group.unknownPeriod += 1;
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
  const okRows = rows.filter((row) => row.feeStatus === "תקין");
  const exceptionRows = rows.filter((row) => getFeeStatusKind(row) === "exception");
  const operatorOnlyRows = rows.filter((row) => getFeeStatusKind(row) === "operatorOnly");
  const notCheckableRows = rows.filter((row) => getFeeStatusKind(row) === "notCheckable");
  const issueRows = getRowsWithIssues(rows);
  const totalAccumulation = rows.reduce((sum, row) => sum + getAccumulation(row), 0);
  const topIssuers = issuers.slice(0, 5);

  return (
    <section className="productAnalysisPanel executiveProductHome">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Product Home</p>
          <h3>בית מוצר — ביטוח מנהלים</h3>
          <p>מסך כניסה ממוקד: תמונת מצב קצרה, ניווט לבקרות, ו-preview של חברות הביטוח הגדולות. ניתוחים כבדים נמצאים בלשוניות.</p>
        </div>
      </div>

      <div className="productKpiGrid four">
        <KpiCard label="עובדים" value={fmtNumber(getUniqueEmployeeCount(rows))} subtext="עובדים שזוהו בקובץ" tone="blue" />
        <KpiCard label="פוליסות" value={fmtNumber(rows.length)} subtext="שורות ביטוח מנהלים" tone="blue" />
        <KpiCard label="צבירה כוללת" value={fmtMoney(totalAccumulation)} subtext="ערך פדיון כולל" tone="gold" />
        <KpiCard label="חברות ביטוח" value={fmtNumber(issuers.length)} subtext="יצרנים מזוהים" tone="blue" />
        <KpiCard label="חריגה בדמי ניהול" value={fmtNumber(exceptionRows.length)} subtext="פוליסות שאינן עומדות בהסכם" tone={exceptionRows.length ? "red" : "green"} onClick={() => onOpenTab(TABS.FEES)} />
        <KpiCard label="מתפעל בלבד" value={fmtNumber(operatorOnlyRows.length)} subtext="מזוהה לפי דוח הסכמים" tone={operatorOnlyRows.length ? "blue" : "green"} />
        <KpiCard label="לא ניתן לבדיקה" value={fmtNumber(notCheckableRows.length)} subtext="חסר הסכם / חסר נתון / תקופה" tone={notCheckableRows.length ? "red" : "green"} onClick={() => onOpenTab(TABS.ERRORS)} />
      </div>

      <div className="productControlGrid">
        <button type="button" className="productControlCard" onClick={() => onOpenTab(TABS.FEES)}>
          <span className="productPortalStatus">בקרה</span>
          <strong>דמי ניהול</strong>
          <small>בדיקה לפי תקופת פוליסה עם שלושה מצבים: תקין, חריגה, ולא ניתן לבדיקה.</small>
        </button>
        <button type="button" className="productControlCard" onClick={() => onOpenTab(TABS.ACCUMULATION)}>
          <span className="productPortalStatus">ניתוח</span>
          <strong>צבירות ויצרנים</strong>
          <small>צבירה וכמות פוליסות לפי חברת ביטוח, כולל טבלה מסכמת אחת.</small>
        </button>
        <button type="button" className="productControlCard" onClick={() => onOpenTab(TABS.ERRORS)}>
          <span className="productPortalStatus">בקרת מידע</span>
          <strong>שגיאות / פערי מידע</strong>
          <small>רשימת עובדים ופוליסות עם חסר הסכם, חסר נתון או תקופה לא מזוהה.</small>
        </button>
      </div>

      <div className="productTableWrap compactTable">
        <table className="productTable">
          <thead>
            <tr>
              <th>חמש חברות הביטוח הגדולות</th>
              <th>פוליסות</th>
              <th>צבירה</th>
              <th>תקין</th>
              <th>חריגה</th>
              <th>לא ניתן לבדיקה</th>
            </tr>
          </thead>
          <tbody>
            {topIssuers.map((item) => (
              <tr key={item.label}>
                <td><strong>{item.label}</strong></td>
                <td>{fmtNumber(item.count)}</td>
                <td>{fmtMoney(item.accumulation)}</td>
                <td>{fmtNumber(item.ok)}</td>
                <td>{fmtNumber(item.exception)}</td>
                <td>{fmtNumber(item.notCheckable)}</td>
              </tr>
            ))}
            {topIssuers.length === 0 ? (
              <tr>
                <td colSpan="6">לא נמצאו נתוני ביטוח מנהלים להצגה.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PeriodFeeTable({ section }) {
  const periodRows = section.rows;
  const okRows = periodRows.filter((row) => getFeeStatusKind(row) === "ok");
  const exceptionRows = periodRows.filter((row) => getFeeStatusKind(row) === "exception");
  const operatorOnlyRows = periodRows.filter((row) => getFeeStatusKind(row) === "operatorOnly");
  const notCheckableRows = periodRows.filter((row) => getFeeStatusKind(row) === "notCheckable");
  const issuerSummary = groupByIssuer(periodRows);
  const detailRows = periodRows.slice(0, 80);

  return (
    <article className="periodFeeBlock">
      <div className="periodFeeHeader">
        <div>
          <p className="eyebrow">Period Fee Control</p>
          <h4>{section.label}</h4>
          <p>בדיקה עצמאית לתקופת הפוליסות הזו בלבד, מול דוח ההסכמים. אם בדוח ההסכמים אין דמי ניהול אלא מתפעל בלבד — הפוליסה אינה נספרת כחריגה.</p>
        </div>
        <div className="periodFeeStats">
          <span className="statusPill ok">תקין: {fmtNumber(okRows.length)}</span>
          <span className="statusPill bad">חריגה: {fmtNumber(exceptionRows.length)}</span>
          <span className="statusPill ok">מתפעל בלבד: {fmtNumber(operatorOnlyRows.length)}</span>
          <span className="statusPill bad">לא ניתן לבדיקה: {fmtNumber(notCheckableRows.length)}</span>
        </div>
      </div>

      <div className="productTableWrap compactTable">
        <table className="productTable">
          <thead>
            <tr>
              <th>חברת ביטוח</th>
              <th>פוליסות</th>
              <th>תקין</th>
              <th>חריגה</th>
              <th>מתפעל בלבד</th>
              <th>לא ניתן לבדיקה</th>
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
                <td>{fmtNumber(item.exception)}</td>
                <td>{fmtNumber(item.operatorOnly)}</td>
                <td>{fmtNumber(item.notCheckable)}</td>
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
                <td><span className={`statusPill ${getFeeStatusKind(row) === "ok" || getFeeStatusKind(row) === "operatorOnly" ? "ok" : "bad"}`}>{getFeeStatusLabel(row)}</span></td>
                <td>{getEmployeeLabel(row)}</td>
                <td>{getIssuer(row)}</td>
                <td>{row.insuranceStartYear || "—"}</td>
                <td>{fmtPct(row.actualPremiumFeePercent)}</td>
                <td>{fmtPct(row.agreementPremiumFeePercent)}</td>
                <td>{fmtPct(row.actualAccumulationFeePercent)}</td>
                <td>{fmtPct(row.agreementAccumulationFeePercent)}</td>
                <td>{fmtMoney(getAccumulation(row))}</td>
                <td>{getIssueLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function FeesTab({ rows }) {
  const okRows = rows.filter((row) => getFeeStatusKind(row) === "ok");
  const exceptionRows = rows.filter((row) => getFeeStatusKind(row) === "exception");
  const operatorOnlyRows = rows.filter((row) => getFeeStatusKind(row) === "operatorOnly");
  const notCheckableRows = rows.filter((row) => getFeeStatusKind(row) === "notCheckable");
  const checkableRows = okRows.length + exceptionRows.length;
  const periodSections = getPeriodSections(rows);

  return (
    <section className="productAnalysisPanel">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Management Fees Control</p>
          <h3>בקרת דמי ניהול</h3>
          <p>הבקרה מופרדת לפי תקופות ביטוח מנהלים ונשענת רק על דוח ההסכמים. פוליסות שמופיעות כמתפעל בלבד מופרדות מהחריגות ולא משפיעות על אחוז התקינות.</p>
        </div>
      </div>

      <div className="productKpiGrid four">
        <KpiCard label="תקין" value={fmtNumber(okRows.length)} subtext="שורות שעומדות בהסכם" tone="green" />
        <KpiCard label="חריגה" value={fmtNumber(exceptionRows.length)} subtext="נבדק מול הסכם ונמצאה חריגה" tone={exceptionRows.length ? "red" : "green"} />
        <KpiCard label="מתפעל בלבד" value={fmtNumber(operatorOnlyRows.length)} subtext="אין דמי ניהול לבדיקה בדוח ההסכמים" tone={operatorOnlyRows.length ? "blue" : "green"} />
        <KpiCard label="לא ניתן לבדיקה" value={fmtNumber(notCheckableRows.length)} subtext="חסר הסכם / חסר נתון / תקופה" tone={notCheckableRows.length ? "red" : "blue"} />
        <KpiCard label="אחוז תקינות" value={`${checkableRows ? Math.round((okRows.length / checkableRows) * 100) : 0}%`} subtext="מתוך פוליסות שניתן לבדוק בפועל" tone="gold" />
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
  const maxIssuerAccumulation = Math.max(...byIssuer.map((item) => item.accumulation), 1);
  const maxIssuerCount = Math.max(...byIssuer.map((item) => item.count), 1);

  return (
    <section className="productAnalysisPanel">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Accumulation & Issuers Analysis</p>
          <h3>צבירות ויצרנים</h3>
          <p>ניתוח אחד משולב שמציג גם איפה יושבת הצבירה וגם כמה פוליסות קיימות אצל כל חברת ביטוח.</p>
        </div>
      </div>

      <div className="issuerBarsList">
        {byIssuer.map((item) => (
          <article className="issuerBarCard" key={`accumulation-${item.label}`}>
            <div className="issuerBarTop">
              <strong>{item.label}</strong>
              <span>{fmtMoney(item.accumulation)}</span>
            </div>
            <MiniBar value={item.accumulation} max={maxIssuerAccumulation} label={`צבירה ${item.label}`} />
            <small>{fmtNumber(item.count)} פוליסות · תקין: {fmtNumber(item.ok)} · חריגה: {fmtNumber(item.exception)} · מתפעל בלבד: {fmtNumber(item.operatorOnly)} · לא ניתן לבדיקה: {fmtNumber(item.notCheckable)}</small>
          </article>
        ))}
      </div>

      <div className="issuerBarsList">
        {byIssuer.map((item) => (
          <article className="issuerBarCard" key={`policies-${item.label}`}>
            <div className="issuerBarTop">
              <strong>{item.label}</strong>
              <span>{fmtNumber(item.count)} פוליסות</span>
            </div>
            <MiniBar value={item.count} max={maxIssuerCount} label={`פוליסות ${item.label}`} />
            <small>צבירה ממוצעת לפוליסה: {fmtMoney(item.count ? item.accumulation / item.count : 0)}</small>
          </article>
        ))}
      </div>

      <div className="productTableWrap compactTable">
        <table className="productTable">
          <thead>
            <tr>
              <th>חברת ביטוח</th>
              <th>עובדים</th>
              <th>פוליסות</th>
              <th>צבירה</th>
              <th>צבירה ממוצעת לפוליסה</th>
              <th>תקין</th>
              <th>חריגה</th>
              <th>לא ניתן לבדיקה</th>
            </tr>
          </thead>
          <tbody>
            {byIssuer.map((item) => {
              const issuerRows = rows.filter((row) => getIssuer(row) === item.label);
              return (
                <tr key={item.label}>
                  <td><strong>{item.label}</strong></td>
                  <td>{fmtNumber(getUniqueEmployeeCount(issuerRows))}</td>
                  <td>{fmtNumber(item.count)}</td>
                  <td>{fmtMoney(item.accumulation)}</td>
                  <td>{fmtMoney(item.count ? item.accumulation / item.count : 0)}</td>
                  <td>{fmtNumber(item.ok)}</td>
                  <td>{fmtNumber(item.exception)}</td>
                  <td>{fmtNumber(item.notCheckable)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ErrorsTab({ rows }) {
  const issueRows = getRowsWithIssues(rows);
  const missingAgreement = issueRows.filter((row) => row.feeIssueCode === "missingAgreement").length;
  const missingData = issueRows.filter((row) => row.feeIssueCode === "missingData").length;
  const unknownPeriod = issueRows.filter((row) => getPeriodKey(row) === "unknown" || !row.insuranceStartYear).length;
  const feeExceptions = issueRows.filter((row) => getFeeStatusKind(row) === "exception").length;
  const detailRows = issueRows.slice(0, 160);

  return (
    <section className="productAnalysisPanel executiveErrorsTab">
      <div className="productSectionHeader">
        <div>
          <p className="eyebrow">Data Quality Control</p>
          <h3>שגיאות / פערי מידע</h3>
          <p>רשימת עובדים ופוליסות שלא ניתן לאשר בצורה נקייה. המטרה כאן היא תיקון מידע, לא Dashboard נוסף.</p>
        </div>
      </div>

      <div className="productKpiGrid four">
        <KpiCard label="עובדים עם שגיאה" value={fmtNumber(getUniqueEmployeeCount(issueRows))} subtext="עובדים שמופיעים ברשימת הפערים" tone={issueRows.length ? "red" : "green"} />
        <KpiCard label="חסר הסכם" value={fmtNumber(missingAgreement)} subtext="אין התאמה להסכם" tone={missingAgreement ? "red" : "green"} />
        <KpiCard label="חסר נתון" value={fmtNumber(missingData)} subtext="דמי ניהול חסרים" tone={missingData ? "red" : "green"} />
        <KpiCard label="תקופה לא מזוהה" value={fmtNumber(unknownPeriod)} subtext="שנת תחילה / שיוך תקופה" tone={unknownPeriod ? "red" : "green"} />
        <KpiCard label="חריגה בדמי ניהול" value={fmtNumber(feeExceptions)} subtext="נבדק ונמצא לא תואם" tone={feeExceptions ? "red" : "green"} />
      </div>

      {issueRows.length === 0 ? (
        <div className="emptyStateCard">
          <strong>לא נמצאו פערי מידע בביטוח מנהלים.</strong>
          <small>כל הפוליסות שזוהו עברו שיוך תקופה ובדיקת דמי ניהול תקינה.</small>
        </div>
      ) : (
        <div className="productTableWrap">
          <table className="productTable">
            <thead>
              <tr>
                <th>מס עובד</th>
                <th>שם עובד</th>
                <th>חברת ביטוח</th>
                <th>פוליסה</th>
                <th>תקופה</th>
                <th>סטטוס</th>
                <th>סיבת שגיאה</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row, index) => (
                <tr key={`${row.policyId || row.policyNumber || row.employeeCode || index}-${index}`}>
                  <td>{getEmployeeCode(row)}</td>
                  <td>{getEmployeeName(row)}</td>
                  <td>{getIssuer(row)}</td>
                  <td>{getPolicyId(row)}</td>
                  <td>{getPeriodLabel(row)}</td>
                  <td><span className={`statusPill ${getFeeStatusKind(row) === "ok" || getFeeStatusKind(row) === "operatorOnly" ? "ok" : "bad"}`}>{getFeeStatusLabel(row)}</span></td>
                  <td>{getIssueLabel(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ExecutiveInsuranceAnalysisView({ analysisData }) {
  const rows = useMemo(() => dedupeRows(getExecutiveRows(analysisData)), [analysisData]);
  const [activeTab, setActiveTab] = useState(TABS.HOME);

  const issuers = groupByIssuer(rows);
  const okRows = rows.filter((row) => row.feeStatus === "תקין");
  const issueRows = getRowsWithIssues(rows);
  const totalAccumulation = rows.reduce((sum, row) => sum + getAccumulation(row), 0);

  return (
    <section className="productAnalysisView executiveInsuranceView" dir="rtl">
      <header className="productHero compactHero">
        <div>
          <p className="eyebrow">Product Analysis</p>
          <h2>ביטוח מנהלים</h2>
          <p>בית מוצר, בקרת דמי ניהול לפי דוח הסכמים ומתפעל בלבד, ניתוח צבירות ויצרנים ובקרת שגיאות.</p>
        </div>
      </header>

      <div className="productKpiGrid four">
        <KpiCard label="פוליסות" value={fmtNumber(rows.length)} subtext="שורות שזוהו בדוח היועץ" tone="blue" />
        <KpiCard label="חברות ביטוח" value={fmtNumber(issuers.length)} subtext="יצרנים שונים" tone="gold" />
        <KpiCard label="תקינות דמי ניהול" value={`${rows.length ? Math.round((okRows.length / rows.length) * 100) : 0}%`} subtext={fmtMoney(totalAccumulation)} tone="green" />
        <KpiCard label="פערי מידע" value={fmtNumber(issueRows.length)} subtext="חסר הסכם / נתון / תקופה" tone={issueRows.length ? "red" : "green"} />
      </div>

      <nav className="productTabs" aria-label="ביטוח מנהלים ניתוחים">
        <button type="button" className={activeTab === TABS.HOME ? "active" : ""} onClick={() => setActiveTab(TABS.HOME)}>בית מוצר</button>
        <button type="button" className={activeTab === TABS.FEES ? "active" : ""} onClick={() => setActiveTab(TABS.FEES)}>דמי ניהול</button>
        <button type="button" className={activeTab === TABS.ACCUMULATION ? "active" : ""} onClick={() => setActiveTab(TABS.ACCUMULATION)}>צבירות ויצרנים</button>
        <button type="button" className={activeTab === TABS.ERRORS ? "active" : ""} onClick={() => setActiveTab(TABS.ERRORS)}>שגיאות</button>
      </nav>

      {activeTab === TABS.HOME ? <ProductHome rows={rows} onOpenTab={setActiveTab} /> : null}
      {activeTab === TABS.FEES ? <FeesTab rows={rows} /> : null}
      {activeTab === TABS.ACCUMULATION ? <AccumulationTab rows={rows} /> : null}
      {activeTab === TABS.ERRORS ? <ErrorsTab rows={rows} /> : null}
    </section>
  );
}
