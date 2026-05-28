// Path: src/components/Dashboard.jsx
import { useState, useMemo } from "react";
import {
  boolText,
  DonutChart,
  EmptyState,
  fmtFee,
  fmtMoney,
  fmtNumber,
  fmtPct,
  GlobalManagerScope,
  PriorityBadge,
  safeText,
  StatusBadge,
} from "./DashboardShared.jsx";
import { buildPensionAnalytics } from "../unified/analyticsEngine";
import {
  buildKpiFromRows,
  buildManagerBreakdown,
  buildManagerOptions,
  getArrangementManager,
  filterDataQualityByRows,
  filterRowsByManager,
} from "../unified/dashboardSelectors.js";

// ─── KPI ──────────────────────────────────────────────────────────────────────


function KpiTab({ kpi, rows = [], actions = [], managerFilter, onManagerFilterChange }) {
  const managerBreakdown = buildManagerBreakdown(rows);
  const managerOptions = managerBreakdown.map((item) => item.manager);

  const filteredRows =
    managerFilter === "all"
      ? rows
      : rows.filter((row) => getArrangementManager(row) === managerFilter);

  const filteredActions =
    managerFilter === "all"
      ? actions
      : actions.filter((item) => getArrangementManager(item) === managerFilter);

  const displayKpi = filteredRows.length
    ? buildKpiFromRows(filteredRows, filteredActions)
    : kpi || buildKpiFromRows([], []);

  if (!displayKpi) return <EmptyState text="אין נתוני KPI" />;

  const cards = [
    {
      label: "סה״כ פוליסות",
      value: fmtNumber(displayKpi.totalRows),
      color: "card-blue",
    },
    {
      label: "סך צבירה מנוהלת",
      value: fmtMoney(displayKpi.totalAccumulation),
      color: "card-blue",
    },
    {
      label: "נבדקו",
      value: fmtNumber(displayKpi.auditedRows),
      color: "card-blue",
    },
    {
      label: "תקין",
      value: fmtNumber(displayKpi.validRows),
      color: "card-green",
    },
    {
      label: "לא תקין",
      value: fmtNumber(displayKpi.invalidRows),
      color: "card-red",
    },
    {
      label: "תפעול בלבד",
      value: fmtNumber(displayKpi.excludedRows),
      color: "card-neutral",
    },
    {
      label: "% עמידה",
      value: fmtPct(displayKpi.complianceRate),
      color: displayKpi.complianceRate >= 0.9 ? "card-green" : "card-red",
    },
    {
      label: "Action Center",
      value: fmtNumber(displayKpi.actionItems),
      color: "card-warning",
    },
  ];

  const statusSegments = [
    { label: "תקין", value: displayKpi.validRows, className: "donut-green" },
    { label: "לא תקין", value: displayKpi.invalidRows, className: "donut-red" },
    { label: "תפעול בלבד", value: displayKpi.excludedRows, className: "donut-neutral" },
  ];

  const maxManagerTotal = Math.max(
    1,
    ...managerBreakdown.map((item) => item.total || 0)
  );

  return (
    <div className="kpi-overview">
      <div className="kpi-toolbar">
        <div>
          <h2>מבט KPI כולל</h2>
          <p>סיכום מנהלים לכל הדוחות, עם הכנה לבחירה לפי מנהל הסדר.</p>
        </div>

        <label className="manager-filter">
          <span>מנהל הסדר</span>
          <select
            value={managerFilter}
            onChange={(event) => onManagerFilterChange(event.target.value)}
          >
            <option value="all">כל מנהלי ההסדר</option>
            {managerOptions.map((manager) => (
              <option key={manager} value={manager}>
                {manager}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="kpi-grid kpi-grid-executive">
        {cards.map(({ label, value, color }) => (
          <div key={label} className={`kpi-card ${color}`}>
            <span className="kpi-label">{label}</span>
            <strong className="kpi-value">{value}</strong>
          </div>
        ))}
      </div>

      <div className="kpi-visual-grid">
        <section className="kpi-panel">
          <div className="kpi-panel-header">
            <h3>סטטוס בקרה</h3>
            <span>{fmtNumber(displayKpi.totalRows)} פוליסות</span>
          </div>

          <div className="kpi-status-layout">
            <DonutChart segments={statusSegments} />

            <div className="kpi-legend">
              {statusSegments.map((segment) => {
                const pct = displayKpi.totalRows
                  ? (Number(segment.value || 0) / displayKpi.totalRows) * 100
                  : 0;

                return (
                  <div key={segment.label} className="kpi-legend-row">
                    <span className={`legend-dot ${segment.className}`} />
                    <strong>{segment.label}</strong>
                    <span>{fmtNumber(segment.value)}</span>
                    <em>{pct.toFixed(1)}%</em>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="kpi-panel">
          <div className="kpi-panel-header">
            <h3>פיזור לפי מנהל הסדר</h3>
            <span>{managerBreakdown.length} מנהלים</span>
          </div>

          {managerBreakdown.length ? (
            <div className="manager-bars">
              {managerBreakdown.map((item) => (
                <div key={item.manager} className="manager-bar-row">
                  <div className="manager-bar-label">
                    <strong>{item.manager}</strong>
                    <span>
                      {fmtNumber(item.total)} פוליסות · {fmtMoney(item.accumulation)}
                    </span>
                  </div>

                  <div className="manager-bar-track">
                    <div
                      className="manager-bar-fill"
                      style={{ width: `${(item.total / maxManagerTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="אין נתוני מנהלי הסדר" />
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Management Fees ──────────────────────────────────────────────────────────

function ManagementFeesTab({ audit }) {
  if (!audit?.issuers?.length) return <EmptyState />;

  const { issuers, rows } = audit;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-label">מדד</th>
            {issuers.map((i) => (
              <th key={i}>{i}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={
                row.key === "invalid"
                  ? "row-danger"
                  : row.key === "valid"
                    ? "row-success"
                    : row.key === "total"
                      ? "row-total"
                      : row.key === "tier" || row.key === "noAgreement"
                        ? "row-warning"
                        : ""
              }
            >
              <td className="col-label">{row.label}</td>

              {issuers.map((i) => (
                <td key={i} className={row[i] > 0 ? "has-value" : ""}>
                  {row.key === "compliance"
                    ? row[i] === null
                      ? "—"
                      : `${(row[i] * 100).toFixed(0)}%`
                    : fmtNumber(row[i])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Generic Matrix ───────────────────────────────────────────────────────────

function MatrixTab({ matrix, rowLabel }) {
  if (!matrix?.rows?.length) return <EmptyState />;

  const { columns, rows } = matrix;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-label">{rowLabel}</th>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th>סה"כ</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row[rowLabel]}>
              <td className="col-label col-label-wrap">{row[rowLabel]}</td>

              {columns.map((c) => (
                <td key={c} className={row[c] > 0 ? "has-value" : ""}>
                  {fmtNumber(row[c])}
                </td>
              ))}

              <td className="col-total">{fmtNumber(row["סה\"כ"])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Investment Track Tab ─────────────────────────────────────────────────────

function InvestmentTrackTab({
  rewardsMatrix,
  compensationMatrix,
  comparison,
}) {
  const [subTab, setSubTab] = useState("תגמולים");
  const [showDetails, setShowDetails] = useState(false);

  const data =
    subTab === "תגמולים"
      ? rewardsMatrix || []
      : compensationMatrix || [];

  const rowLabel =
    subTab === "תגמולים"
      ? "מסלול השקעה תגמולים"
      : "מסלול השקעה פיצויים";

  if (!data.length) return <EmptyState text="אין נתוני מסלולי השקעה" />;

  return (
    <div>
      {comparison && (
        <div className="kpi-grid" style={{ marginBottom: 18 }}>
          <div className="kpi-card card-blue">
            <span className="kpi-label">סה״כ עובדים שנבדקו</span>
            <strong className="kpi-value">
              {fmtNumber(comparison.totalEmployees)}
            </strong>
          </div>

          <div className="kpi-card card-green">
            <span className="kpi-label">תגמולים ופיצויים זהים</span>
            <strong className="kpi-value">
              {fmtNumber(comparison.sameCount)}
            </strong>
          </div>

          <div className="kpi-card card-warning">
            <span className="kpi-label">תגמולים ופיצויים שונים</span>
            <strong className="kpi-value">
              {fmtNumber(comparison.differentCount)}
            </strong>
          </div>

          <div className="kpi-card card-neutral">
            <span className="kpi-label">חסר מסלול פיצויים</span>
            <strong className="kpi-value">
              {fmtNumber(comparison.missingCompensationCount)}
            </strong>
          </div>
        </div>
      )}

      <div className="sub-tabs">
        {["תגמולים", "פיצויים"].map((t) => (
          <button
            key={t}
            className={`sub-tab-btn ${subTab === t ? "active" : ""}`}
            onClick={() => {
              setSubTab(t);
              setShowDetails(false);
            }}
          >
            {t}
          </button>
        ))}

        {comparison?.details?.length > 0 && (
          <button
            className={`sub-tab-btn ${showDetails ? "active" : ""}`}
            onClick={() => setShowDetails(!showDetails)}
          >
            השוואת עובדים
          </button>
        )}
      </div>

      {!showDetails ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-label">{rowLabel}</th>
                <th>כמות עובדים</th>
                <th>כמות פוליסות</th>
                <th>סך צבירה</th>
              </tr>
            </thead>

            <tbody>
              {data.map((row) => (
                <tr key={row[rowLabel]}>
                  <td className="col-label col-label-wrap">
                    {row[rowLabel]}
                  </td>
                  <td>{fmtNumber(row["כמות עובדים"])}</td>
                  <td>{fmtNumber(row["כמות פוליסות"])}</td>
                  <td>{fmtMoney(row["סך צבירה"])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>קוד עובד</th>
                <th>שם</th>
                <th>מסלולי תגמולים</th>
                <th>מסלולי פיצויים</th>
                <th>סטטוס</th>
                <th>כמות פוליסות</th>
                <th>סך צבירה</th>
              </tr>
            </thead>

            <tbody>
              {comparison.details.map((row, index) => (
                <tr
                  key={`${row.employeeCode || row.clientName || "row"}-${index}`}
                  className={
                    row.status === "different"
                      ? "row-warning"
                      : row.status === "same"
                        ? "row-success"
                        : "row-muted"
                  }
                >
                  <td>{row.employeeCode || "—"}</td>
                  <td>{row.clientName || "—"}</td>
                  <td className="col-track">{row.rewardsTracks}</td>
                  <td className="col-track">{row.compensationTracks}</td>
                  <td>
                    {row.status === "same"
                      ? "זהה"
                      : row.status === "different"
                        ? "שונה"
                        : row.status === "missingCompensation"
                          ? "חסר פיצויים"
                          : row.status === "missingRewards"
                            ? "חסר תגמולים"
                            : "חסר מסלולים"}
                  </td>
                  <td>{fmtNumber(row.policies)}</td>
                  <td>{fmtMoney(row.accumulation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Accumulation Tier ────────────────────────────────────────────────────────

function AccumulationTierTab({ data }) {
  if (!data?.length) return <EmptyState />;

  const COLS = [
    "מדרגת צבירה",
    "סה\"כ פוליסות",
    "יש מודל גבוה",
    "זכאי למודל גבוה",
    "נמצא במודל גבוה",
    "פוטנציאל לא מנוצל",
  ];

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr
              key={row["מדרגת צבירה"]}
              className={row["פוטנציאל לא מנוצל"] > 0 ? "row-warning" : ""}
            >
              <td className="col-label">{row["מדרגת צבירה"]}</td>
              <td>{fmtNumber(row["סה\"כ פוליסות"])}</td>
              <td>{fmtNumber(row["יש מודל גבוה"])}</td>
              <td>{fmtNumber(row["זכאי למודל גבוה"])}</td>
              <td>{fmtNumber(row["נמצא במודל גבוה"])}</td>
              <td
                className={
                  row["פוטנציאל לא מנוצל"] > 0 ? "has-value-warn" : ""
                }
              >
                {fmtNumber(row["פוטנציאל לא מנוצל"])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Action Center ────────────────────────────────────────────────────────────

function ActionCenterTab({ items }) {
  const [selected, setSelected] = useState(null);

  if (!items?.length) {
    return <EmptyState text="אין פריטים לטיפול — הכל תקין 🎉" />;
  }

  return (
    <div>
      <p className="section-note">
        {items.length} פריטים דורשים טיפול · לחץ על שורה לפרטים
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>קוד עובד</th>
              <th>שם</th>
              <th>יצרן</th>
              <th>צבירה</th>
              <th>ד.נ הפקדה</th>
              <th>מאושר</th>
              <th>ד.נ צבירה</th>
              <th>מאושר</th>
              <th>סטטוס</th>
              <th>עדיפות</th>
              <th>פעולה נדרשת</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, i) => (
              <ActionCenterRow
                key={`${item.employeeCode || "row"}-${i}`}
                item={item}
                index={i}
                selected={selected}
                setSelected={setSelected}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionCenterRow({ item, index, selected, setSelected }) {
  return (
    <>
      <tr
        className={`action-row ${selected === index ? "selected" : ""}`}
        onClick={() => setSelected(selected === index ? null : index)}
      >
        <td>{item.employeeCode}</td>
        <td>{item.clientName || "—"}</td>
        <td>{item.issuer}</td>
        <td>{fmtMoney(item.accumulation)}</td>
        <td
          className={
            item.depositFee > (item.approvedDepositFee ?? 999)
              ? "cell-danger"
              : ""
          }
        >
          {fmtFee(item.depositFee)}
        </td>
        <td className="col-approved">{fmtFee(item.approvedDepositFee)}</td>
        <td
          className={
            item.accumulationFee > (item.approvedAccumulationFee ?? 999)
              ? "cell-danger"
              : ""
          }
        >
          {fmtFee(item.accumulationFee)}
        </td>
        <td className="col-approved">
          {fmtFee(item.approvedAccumulationFee)}
        </td>
        <td>
          <StatusBadge status={item.auditStatus} />
        </td>
        <td>
          <PriorityBadge priority={item.priority} />
        </td>
        <td className="action-text">{item.requiredAction}</td>
      </tr>

      {selected === index && (
        <tr className="detail-row">
          <td colSpan={11}>
            <div className="detail-box">
              <span className="detail-label">סיבה: </span>
              {item.auditReason}
              <span className="detail-label" style={{ marginRight: 16 }}>
                קטגוריה:
              </span>
              {item.issueCategory}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Unified Preview ──────────────────────────────────────────────────────────

function UnifiedPreviewTab({ rows }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilter] = useState("הכל");

  const filtered = useMemo(() => {
    if (!rows) return [];

    return rows.filter((r) => {
      const matchSearch =
        !search ||
        String(r.employeeCode || "").includes(search) ||
        (r.personal_fullName || "").includes(search) ||
        (r.clientName || "").includes(search) ||
        (r.issuerOriginal || "").includes(search) ||
        (r.issuerCanonical || "").includes(search);

      const matchStatus =
        filterStatus === "הכל" ||
        (filterStatus === "תקין" && r.auditStatus === "valid") ||
        (filterStatus === "לא תקין" && r.auditStatus === "invalid") ||
        (filterStatus === "תפעול" && r.auditStatus === "excluded") ||
        (filterStatus === "פוטנציאל מודל" && r.tierPotentialNotUsed);

      return matchSearch && matchStatus;
    });
  }, [rows, search, filterStatus]);

  return (
    <div>
      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="חפש קוד / שם / יצרן…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          dir="rtl"
        />

        {["הכל", "תקין", "לא תקין", "תפעול", "פוטנציאל מודל"].map((s) => (
          <button
            key={s}
            className={`filter-btn ${filterStatus === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}

        <span className="filter-count">{filtered.length} שורות</span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>קוד</th>
              <th>שם</th>
              <th>יצרן</th>
              <th>ד.נ הפקדה</th>
              <th>מאושר</th>
              <th>ד.נ צבירה</th>
              <th>מאושר</th>
              <th>צבירה</th>
              <th>מסלול תגמולים</th>
              <th>מסלול פיצויים</th>
              <th>גיל</th>
              <th>משפחתי</th>
              <th>סטטוס</th>
              <th>פוטנציאל מודל</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={`${r.employeeCode || "row"}-${i}`}
                className={r.auditStatus === "excluded" ? "row-muted" : ""}
              >
                <td>{r.employeeCode}</td>
                <td>{r.personal_fullName || r.clientName || "—"}</td>
                <td>{r.issuerOriginal || r.issuerCanonical}</td>
                <td>{fmtFee(r.depositFee)}</td>
                <td className="col-approved">
                  {fmtFee(r.depositFeeAgreement ?? r.auditReferenceDepositFee)}
                </td>
                <td>{fmtFee(r.accumulationFee)}</td>
                <td className="col-approved">
                  {fmtFee(
                    r.accumulationFeeAgreement ??
                      r.auditReferenceAccumulationFee
                  )}
                </td>
                <td>{r.accumulation ? fmtMoney(r.accumulation) : "—"}</td>
                <td className="col-track">{r.investmentTrackRewards || "—"}</td>
                <td className="col-track">
                  {r.investmentTrackCompensation || "—"}
                </td>
                <td>{r.personal_age ?? r.age ?? "—"}</td>
                <td>{r.personal_maritalStatus || r.maritalStatus || "—"}</td>
                <td>
                  <StatusBadge status={r.auditStatus} />
                </td>
                <td>
                  {r.tierPotentialNotUsed ? (
                    <span className="tier-flag">⚠ מודל צבירה</span>
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── QA / Trace Tab ───────────────────────────────────────────────────────────

function QaTraceTab({ rows }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("הכל");

  const filtered = useMemo(() => {
    if (!rows?.length) return [];

    return rows.filter((r) => {
      const haystack = [
        r.employeeCode,
        r.personal_fullName,
        r.clientName,
        r.issuerCanonical,
        r.issuerOriginal,
        r.auditStatus,
        r.auditMatchRuleType,
        r.auditMatchResult,
        r.auditReason,
        r.issueCategory,
        r.investmentTrackRewards,
        r.investmentTrackCompensation,
      ]
        .filter(Boolean)
        .join(" ");

      const matchSearch = !search || haystack.includes(search);

      const matchFilter =
        filter === "הכל" ||
        (filter === "תקין" && r.auditStatus === "valid") ||
        (filter === "לא תקין" && r.auditStatus === "invalid") ||
        (filter === "תפעול" && r.auditStatus === "excluded") ||
        (filter === "ללא הסכם" && !r.agreementIssuerFound) ||
        (filter === "מודל צבירה" && r.tierPotentialNotUsed) ||
        (filter === "ברירת מחדל" &&
          r.auditMatchRuleType === "DEFAULT_PENSION_FUND") ||
        (filter === "הסכם פנימי" &&
          r.auditMatchRuleType === "INLINE_AGREEMENT") ||
        (filter === "הסכם חיצוני" &&
          r.auditMatchRuleType !== "INLINE_AGREEMENT" &&
          r.auditMatchRuleType !== "DEFAULT_PENSION_FUND" &&
          r.agreementIssuerFound);

      return matchSearch && matchFilter;
    });
  }, [rows, search, filter]);

  if (!rows?.length) return <EmptyState text="אין Unified Rows לבדיקה" />;

  const filters = [
    "הכל",
    "תקין",
    "לא תקין",
    "תפעול",
    "ללא הסכם",
    "מודל צבירה",
    "ברירת מחדל",
    "הסכם פנימי",
    "הסכם חיצוני",
  ];

  return (
    <div>
      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="חפש קוד / שם / יצרן / סיבה…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          dir="rtl"
        />

        {filters.map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}

        <span className="filter-count">
          {filtered.length} מתוך {rows.length} שורות
        </span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>שורה</th>
              <th>קוד</th>
              <th>שם</th>
              <th>יצרן מקור</th>
              <th>יצרן מנורמל</th>
              <th>סטטוס</th>
              <th>מסלול החלטה</th>
              <th>תוצאה</th>
              <th>תגמולים</th>
              <th>פיצויים</th>
              <th>ד.נ הפקדה</th>
              <th>מאושר</th>
              <th>ד.נ צבירה</th>
              <th>מאושר</th>
              <th>צבירה</th>
              <th>הסכם נמצא</th>
              <th>יש מודל גבוה</th>
              <th>זכאי</th>
              <th>במודל</th>
              <th>פוטנציאל</th>
              <th>סיבה</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={`${r.employeeCode || "row"}-${i}`}
                className={
                  r.auditStatus === "invalid"
                    ? "row-danger"
                    : r.auditStatus === "valid"
                      ? "row-success"
                      : r.auditStatus === "excluded"
                        ? "row-muted"
                        : ""
                }
              >
                <td>{r.sourceRowNumber ?? i + 1}</td>
                <td>{safeText(r.employeeCode)}</td>
                <td>{safeText(r.personal_fullName || r.clientName)}</td>
                <td>{safeText(r.issuerOriginal)}</td>
                <td>{safeText(r.issuerCanonical)}</td>
                <td>
                  <StatusBadge status={r.auditStatus} />
                </td>
                <td>{safeText(r.auditMatchRuleType)}</td>
                <td>{safeText(r.auditMatchResult)}</td>
                <td className="col-track">{safeText(r.investmentTrackRewards)}</td>
                <td className="col-track">
                  {safeText(r.investmentTrackCompensation)}
                </td>
                <td>{fmtFee(r.depositFee)}</td>
                <td className="col-approved">
                  {fmtFee(r.auditReferenceDepositFee ?? r.depositFeeAgreement)}
                </td>
                <td>{fmtFee(r.accumulationFee)}</td>
                <td className="col-approved">
                  {fmtFee(
                    r.auditReferenceAccumulationFee ??
                      r.accumulationFeeAgreement
                  )}
                </td>
                <td>{fmtMoney(r.accumulation)}</td>
                <td>{boolText(r.agreementIssuerFound)}</td>
                <td>{boolText(r.hasTierModel)}</td>
                <td>{boolText(r.eligibleForTier)}</td>
                <td>{boolText(r.inTierModel)}</td>
                <td>{boolText(r.tierPotentialNotUsed)}</td>
                <td className="action-text">{safeText(r.auditReason)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Data Quality Tab ─────────────────────────────────────────────────────────

function DataQualityTab({ dataQuality }) {
  const [severityFilter, setSeverityFilter] = useState("הכל");
  const [categoryFilter, setCategoryFilter] = useState("הכל");
  const [search, setSearch] = useState("");

  if (!dataQuality) {
    return <EmptyState text="אין נתוני איכות" />;
  }

  const { summary, issues = [], byCategory = {} } = dataQuality;

  const categories = ["הכל", ...Object.keys(byCategory)];

  const filteredIssues = issues.filter((issue) => {
    const matchSeverity =
      severityFilter === "הכל" || issue.severity === severityFilter;

    const matchCategory =
      categoryFilter === "הכל" || issue.category === categoryFilter;

    const haystack = [
      issue.issueLabel,
      issue.issueCode,
      issue.category,
      issue.employeeCode,
      issue.clientName,
      issue.issuer,
      issue.recommendation,
    ]
      .filter(Boolean)
      .join(" ");

    const matchSearch = !search || haystack.includes(search);

    return matchSeverity && matchCategory && matchSearch;
  });

  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card card-blue">
          <span className="kpi-label">סה״כ בעיות</span>
          <strong className="kpi-value">{fmtNumber(summary.issueCount)}</strong>
        </div>

        <div className="kpi-card card-red">
          <span className="kpi-label">בעיות קריטיות</span>
          <strong className="kpi-value">{fmtNumber(summary.highIssues)}</strong>
        </div>

        <div className="kpi-card card-warning">
          <span className="kpi-label">בעיות בינוניות</span>
          <strong className="kpi-value">{fmtNumber(summary.mediumIssues)}</strong>
        </div>

        <div className="kpi-card card-neutral">
          <span className="kpi-label">בעיות קלות</span>
          <strong className="kpi-value">{fmtNumber(summary.lowIssues)}</strong>
        </div>

        <div className="kpi-card card-warning">
          <span className="kpi-label">דמיון תגמולים/פיצויים</span>
          <strong className="kpi-value">
            {fmtPct(summary.trackSimilarity?.sameTrackRate || 0)}
          </strong>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="חפש בעיה / עובד / יצרן…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          dir="rtl"
        />

        {["הכל", "HIGH", "MEDIUM", "LOW"].map((f) => (
          <button
            key={f}
            className={`filter-btn ${severityFilter === f ? "active" : ""}`}
            onClick={() => setSeverityFilter(f)}
          >
            {f === "HIGH"
              ? "קריטי"
              : f === "MEDIUM"
                ? "בינוני"
                : f === "LOW"
                  ? "נמוך"
                  : "הכל"}
          </button>
        ))}

        <select
          className="search-input"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          dir="rtl"
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category === "הכל"
                ? "כל הקטגוריות"
                : `${category} (${byCategory[category] || 0})`}
            </option>
          ))}
        </select>

        <span className="filter-count">
          {filteredIssues.length} מתוך {issues.length} בעיות
        </span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>חומרה</th>
              <th>קטגוריה</th>
              <th>קוד בעיה</th>
              <th>בעיה</th>
              <th>קוד עובד</th>
              <th>שם</th>
              <th>יצרן</th>
              <th>צבירה</th>
              <th>המלצה</th>
            </tr>
          </thead>

          <tbody>
            {filteredIssues.map((issue, index) => (
              <tr
                key={`${issue.issueCode}-${index}`}
                className={
                  issue.severity === "HIGH"
                    ? "row-danger"
                    : issue.severity === "MEDIUM"
                      ? "row-warning"
                      : ""
                }
              >
                <td>
                  <PriorityBadge priority={issue.severity} />
                </td>
                <td>{issue.category}</td>
                <td>{issue.issueCode}</td>
                <td className="action-text">{issue.issueLabel}</td>
                <td>{issue.employeeCode || "—"}</td>
                <td>{issue.clientName || "—"}</td>
                <td>{issue.issuer || "—"}</td>
                <td>{issue.accumulation ? fmtMoney(issue.accumulation) : "—"}</td>
                <td className="action-text">{issue.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "kpi", label: "KPI" },
  { id: "fees", label: "בקרת דמי ניהול" },
  { id: "insurance", label: "מסלול ביטוח × משפחתי" },
  { id: "investment", label: "מסלולי השקעה" },
  { id: "tier", label: "מדרגות צבירה" },
  { id: "action", label: "Action Center" },
  { id: "preview", label: "Unified Preview" },
  { id: "qa", label: "QA Trace" },
  { id: "quality", label: "Data Quality" },
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ analysisData }) {
  const [activeTab, setActiveTab] = useState("kpi");
  const [managerFilter, setManagerFilter] = useState("all");

  const { pensionSummary, pensionRows } = analysisData || {};

  const {
    kpi,
    managementAudit,
    managementFeesAudit,
    insuranceTrackMarital,
    investmentTrackRewardsMarital,
    investmentTrackCompensationMarital,
    investmentTrackComparison,
    accumulationTierAnalysis,
    actionCenter,
    unifiedRows,
    dataQuality,
  } = pensionSummary || {};

  const baseRows = unifiedRows || pensionRows || [];
  const managerOptions = useMemo(() => buildManagerOptions(baseRows), [baseRows]);
  const scopedRows = useMemo(
    () => filterRowsByManager(baseRows, managerFilter),
    [baseRows, managerFilter]
  );

  const scopedAnalytics = useMemo(() => {
    return buildPensionAnalytics(scopedRows);
  }, [scopedRows]);

  const isAllManagers = managerFilter === "all";
  const feesAudit = isAllManagers
    ? managementAudit || managementFeesAudit
    : scopedAnalytics.managementAudit || scopedAnalytics.managementFeesAudit;
  const actions = isAllManagers ? actionCenter || [] : scopedAnalytics.actionCenter || [];
  const summary = pensionSummary?.summary;
  const previewRows = scopedRows;
  const scopedDataQuality = filterDataQualityByRows(dataQuality, scopedRows, managerFilter);

  const displayKpi = isAllManagers ? kpi : scopedAnalytics.kpi;
  const displayInsuranceTrackMarital = isAllManagers
    ? insuranceTrackMarital
    : scopedAnalytics.insuranceTrackMarital;
  const displayInvestmentTrackRewardsMarital = isAllManagers
    ? investmentTrackRewardsMarital
    : scopedAnalytics.investmentTrackRewardsMarital;
  const displayInvestmentTrackCompensationMarital = isAllManagers
    ? investmentTrackCompensationMarital
    : scopedAnalytics.investmentTrackCompensationMarital;
  const displayInvestmentTrackComparison = isAllManagers
    ? investmentTrackComparison
    : scopedAnalytics.investmentTrackComparison;
  const displayAccumulationTierAnalysis = isAllManagers
    ? accumulationTierAnalysis
    : scopedAnalytics.accumulationTierAnalysis;

  function renderTab() {
    switch (activeTab) {
      case "kpi":
        return (
          <KpiTab
            kpi={displayKpi}
            rows={baseRows}
            actions={isAllManagers ? actionCenter || [] : actions}
            managerFilter={managerFilter}
            onManagerFilterChange={setManagerFilter}
          />
        );

      case "fees":
        return <ManagementFeesTab audit={feesAudit} />;

      case "insurance":
        return (
          <MatrixTab
            matrix={displayInsuranceTrackMarital}
            rowLabel="מסלול ביטוח"
          />
        );

      case "investment":
        return (
          <InvestmentTrackTab
            rewardsMatrix={displayInvestmentTrackRewardsMarital}
            compensationMatrix={displayInvestmentTrackCompensationMarital}
            comparison={displayInvestmentTrackComparison}
          />
        );

      case "tier":
        return <AccumulationTierTab data={displayAccumulationTierAnalysis} />;

      case "action":
        return <ActionCenterTab items={actions} />;

      case "preview":
        return <UnifiedPreviewTab rows={previewRows} />;

      case "qa":
        return <QaTraceTab rows={previewRows} />;

      case "quality":
        return <DataQualityTab dataQuality={scopedDataQuality} />;

      default:
        return null;
    }
  }

  return (
    <div className="dashboard" dir="rtl">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">ניתוח דוח פנסיוני</h1>
          <p className="dashboard-subtitle">
            מבט מנהלי הסדר · {pensionRows?.length || 0} פוליסות
          </p>
        </div>

        {summary && (
          <div className="summary-pills">
            <span className="pill pill-green">✓ {summary.valid} תקין</span>
            <span className="pill pill-red">✗ {summary.invalid} לא תקין</span>
            <span className="pill pill-neutral">
              — {summary.excluded} תפעול
            </span>

            {summary.noAgreement > 0 && (
              <span className="pill pill-warning">
                ? {summary.noAgreement} ללא הסכם
              </span>
            )}

            {summary.tierPotential > 0 && (
              <span className="pill pill-warning">
                ⚠ {summary.tierPotential} מודל צבירה
              </span>
            )}

            {summary.dataQualityIssues > 0 && (
              <span className="pill pill-warning">
                QA {summary.dataQualityIssues} בעיות
              </span>
            )}
          </div>
        )}
      </header>

      <GlobalManagerScope
        managerFilter={managerFilter}
        onManagerFilterChange={setManagerFilter}
        managerOptions={managerOptions}
        scopedCount={previewRows.length}
        totalCount={baseRows.length}
      />

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}

            {tab.id === "action" && actions.length > 0 && (
              <span className="tab-badge">{actions.length}</span>
            )}

            {tab.id === "quality" && scopedDataQuality?.summary?.issueCount > 0 && (
              <span className="tab-badge">
                {scopedDataQuality.summary.issueCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="dashboard-content">{renderTab()}</main>
    </div>
  );
}
