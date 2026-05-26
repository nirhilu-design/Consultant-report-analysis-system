// Path: src/components/Dashboard.jsx
import { useState, useMemo } from "react";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtNumber(v) {
  return Number(v || 0).toLocaleString("he-IL");
}
function fmtMoney(v) {
  return "₪" + Number(v || 0).toLocaleString("he-IL", { maximumFractionDigits: 0 });
}
function fmtPercent(v) {
  if (v === null || v === undefined) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}
function fmtFee(v) {
  if (v === null || v === undefined || v === "") return "—";
  return `${Number(v).toFixed(2)}%`;
}
function fmtAccum(v) {
  if (!v) return "—";
  return "₪" + Number(v).toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    "תקין":       "badge-success",
    "valid":      "badge-success",
    "לא תקין":    "badge-danger",
    "invalid":    "badge-danger",
    "תפעול בלבד": "badge-neutral",
    "excluded":   "badge-neutral",
  };
  const cls = map[status] || "badge-neutral";
  const label = status === "valid" ? "תקין"
    : status === "invalid" ? "לא תקין"
    : status === "excluded" ? "תפעול"
    : status;
  return <span className={`badge ${cls}`}>{label}</span>;
}

function PriorityBadge({ priority }) {
  if (!priority) return null;
  const cls = priority === "HIGH" ? "badge-danger" : "badge-warning";
  const label = priority === "HIGH" ? "גבוה" : "בינוני";
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ─── KPI Tab ──────────────────────────────────────────────────────────────────

function KpiTab({ kpi }) {
  if (!kpi) return <EmptyState text="אין נתוני KPI" />;

  const cards = [
    { label: "סה\"כ פוליסות",        value: fmtNumber(kpi.totalRows),          color: "card-blue" },
    { label: "נבדקו",                 value: fmtNumber(kpi.auditedRows),         color: "card-blue" },
    { label: "תקין",                  value: fmtNumber(kpi.validRows),           color: "card-green" },
    { label: "לא תקין",              value: fmtNumber(kpi.invalidRows),          color: "card-red" },
    { label: "תפעול בלבד",           value: fmtNumber(kpi.excludedRows),         color: "card-neutral" },
    { label: "% עמידה",              value: fmtPercent(kpi.complianceRate),       color: kpi.complianceRate >= 0.9 ? "card-green" : "card-red" },
    { label: "ללא הסכם",             value: fmtNumber(kpi.noAgreementRows),       color: "card-red" },
    { label: "Tier Potential",        value: fmtNumber(kpi.tierPotentialRows),    color: "card-warning" },
    { label: "Action Center",         value: fmtNumber(kpi.actionItems),          color: "card-warning" },
    { label: "סך צבירה מנוהלת",       value: fmtMoney(kpi.totalAccumulation),    color: "card-blue" },
  ];

  return (
    <div className="kpi-grid">
      {cards.map(({ label, value, color }) => (
        <div key={label} className={`kpi-card ${color}`}>
          <span className="kpi-label">{label}</span>
          <strong className="kpi-value">{value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Management Fees Audit Tab ────────────────────────────────────────────────

function ManagementFeesTab({ audit }) {
  if (!audit?.issuers?.length) return <EmptyState text="אין נתוני בקרת דמי ניהול" />;

  const { issuers, rows } = audit;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-label">מדד</th>
            {issuers.map((iss) => <th key={iss}>{iss}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={
                row.key === "invalid"    ? "row-danger"
                : row.key === "valid"   ? "row-success"
                : row.key === "total"   ? "row-total"
                : row.key === "tier"    ? "row-warning"
                : ""
              }
            >
              <td className="col-label">{row.label}</td>
              {issuers.map((iss) => (
                <td key={iss} className={row[iss] > 0 ? "has-value" : ""}>
                  {row.key === "compliance"
                    ? row[iss] === null ? "—" : `${(row[iss] * 100).toFixed(0)}%`
                    : fmtNumber(row[iss])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Generic Matrix Tab ───────────────────────────────────────────────────────

function MatrixTab({ matrix, rowLabel }) {
  if (!matrix?.rows?.length) return <EmptyState text="אין נתונים" />;
  const { columns, rows } = matrix;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-label">{rowLabel}</th>
            {columns.map((c) => <th key={c}>{c}</th>)}
            <th>סה"כ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowLabel]}>
              <td className="col-label col-label-wrap">{row[rowLabel]}</td>
              {columns.map((c) => (
                <td key={c} className={row[c] > 0 ? "has-value" : ""}>{fmtNumber(row[c])}</td>
              ))}
              <td className="col-total">{fmtNumber(row["סה\"כ"])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Accumulation Tier Tab ────────────────────────────────────────────────────

function AccumulationTierTab({ data }) {
  if (!data?.length) return <EmptyState text="אין נתוני צבירה" />;

  const cols = [
    "מדרגת צבירה", "מספר פוליסות", "סך צבירה",
    "יש מודל גבוה", "זכאי למודל גבוה", "נמצא במודל גבוה", "פוטנציאל לא מנוצל",
  ];

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row["מדרגת צבירה"]}
              className={row["פוטנציאל לא מנוצל"] > 0 ? "row-warning" : ""}
            >
              <td className="col-label">{row["מדרגת צבירה"]}</td>
              <td>{fmtNumber(row["מספר פוליסות"])}</td>
              <td>{fmtMoney(row["סך צבירה"])}</td>
              <td>{fmtNumber(row["יש מודל גבוה"])}</td>
              <td>{fmtNumber(row["זכאי למודל גבוה"])}</td>
              <td>{fmtNumber(row["נמצא במודל גבוה"])}</td>
              <td className={row["פוטנציאל לא מנוצל"] > 0 ? "has-value-warn" : ""}>
                {fmtNumber(row["פוטנציאל לא מנוצל"])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Action Center Tab ────────────────────────────────────────────────────────

function ActionCenterTab({ items }) {
  const [selected, setSelected] = useState(null);

  if (!items?.length) return <EmptyState text="אין פריטים לטיפול — הכל תקין 🎉" />;

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
              <th>ד.נ צבירה</th>
              <th>סטטוס</th>
              <th>עדיפות</th>
              <th>פעולה נדרשת</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <>
                <tr
                  key={i}
                  className={`action-row ${selected === i ? "selected" : ""}`}
                  onClick={() => setSelected(selected === i ? null : i)}
                >
                  <td>{item.employeeCode}</td>
                  <td>{item.clientName || "—"}</td>
                  <td>{item.issuer}</td>
                  <td>{fmtAccum(item.accumulation)}</td>
                  <td className={item.depositFee > (item.approvedDepositFee || 999) ? "cell-danger" : ""}>
                    {fmtFee(item.depositFee)}
                  </td>
                  <td className={item.accumulationFee > (item.approvedAccumulationFee || 999) ? "cell-danger" : ""}>
                    {fmtFee(item.accumulationFee)}
                  </td>
                  <td><StatusBadge status={item.auditStatus} /></td>
                  <td><PriorityBadge priority={item.priority} /></td>
                  <td className="action-text">{item.requiredAction}</td>
                </tr>
                {selected === i && (
                  <tr key={`detail-${i}`} className="detail-row">
                    <td colSpan={9}>
                      <div className="detail-box">
                        <div className="detail-grid">
                          <div>
                            <span className="detail-label">סיבה:</span>
                            <span>{item.auditReason}</span>
                          </div>
                          <div>
                            <span className="detail-label">ד.נ מאושר הפקדה:</span>
                            <span>{fmtFee(item.approvedDepositFee)}</span>
                          </div>
                          <div>
                            <span className="detail-label">ד.נ מאושר צבירה:</span>
                            <span>{fmtFee(item.approvedAccumulationFee)}</span>
                          </div>
                          <div>
                            <span className="detail-label">קטגוריית בעיה:</span>
                            <span>{item.issueCategory}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Unified Preview Tab ──────────────────────────────────────────────────────

function UnifiedPreviewTab({ rows }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("הכל");

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      const matchSearch = !search ||
        String(r.employeeCode).includes(search) ||
        (r.personal_fullName || "").includes(search) ||
        (r.issuerOriginal || "").includes(search);
      const matchStatus = filterStatus === "הכל" ||
        (filterStatus === "תקין"    && r.auditStatus === "valid") ||
        (filterStatus === "לא תקין" && r.auditStatus === "invalid") ||
        (filterStatus === "תפעול"   && r.auditStatus === "excluded");
      return matchSearch && matchStatus;
    });
  }, [rows, search, filterStatus]);

  return (
    <div>
      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="חפש לפי קוד / שם / יצרן…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          dir="rtl"
        />
        {["הכל", "תקין", "לא תקין", "תפעול"].map((s) => (
          <button
            key={s}
            className={`filter-btn ${filterStatus === s ? "active" : ""}`}
            onClick={() => setFilterStatus(s)}
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
              <th>קוד עובד</th>
              <th>שם</th>
              <th>יצרן</th>
              <th>ד.נ הפקדה</th>
              <th>ד.נ צבירה</th>
              <th>צבירה</th>
              <th>מסלול השקעה</th>
              <th>גיל</th>
              <th>מצב משפחתי</th>
              <th>סטטוס</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className={r.auditStatus === "excluded" ? "row-muted" : ""}>
                <td>{r.employeeCode}</td>
                <td>{r.personal_fullName || "—"}</td>
                <td>{r.issuerOriginal || r.issuerCanonical}</td>
                <td>{fmtFee(r.depositFee)}</td>
                <td>{fmtFee(r.accumulationFee)}</td>
                <td>{fmtAccum(r.accumulation)}</td>
                <td className="col-track">{r.investmentTrackRewards || "—"}</td>
                <td>{r.personal_age ?? "—"}</td>
                <td>{r.personal_maritalStatus || "—"}</td>
                <td><StatusBadge status={r.auditStatus} /></td>
                <td>{r.tierPotentialNotUsed ? <span className="tier-flag">⚠ Tier</span> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ text }) {
  return <div className="empty-state"><p>{text}</p></div>;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "kpi",        label: "KPI" },
  { id: "fees",       label: "בקרת דמי ניהול" },
  { id: "insurance",  label: "מסלול ביטוח × משפחתי" },
  { id: "investment", label: "מסלולי השקעה" },
  { id: "tier",       label: "מדרגות צבירה" },
  { id: "action",     label: "Action Center" },
  { id: "preview",    label: "Unified Preview" },
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ analysisData }) {
  const [activeTab, setActiveTab] = useState("kpi");

  const { pensionSummary, pensionRows } = analysisData || {};
  const {
    kpi, managementAudit, managementFeesAudit,
    insuranceTrackMarital, investmentTrackIssuer,
    investmentTrackRewardsIssuer, accumulationTierAnalysis,
    actionCenter, unifiedRows,
  } = pensionSummary || {};

  // aliases
  const feesAudit  = managementAudit || managementFeesAudit;
  const invMatrix  = investmentTrackIssuer || investmentTrackRewardsIssuer;
  const actions    = actionCenter || [];

  // Summary bar
  const summary = pensionSummary?.summary;

  function renderTab() {
    switch (activeTab) {
      case "kpi":        return <KpiTab kpi={kpi} />;
      case "fees":       return <ManagementFeesTab audit={feesAudit} />;
      case "insurance":  return <MatrixTab matrix={insuranceTrackMarital} rowLabel="מסלול ביטוח" />;
      case "investment": return <MatrixTab matrix={invMatrix} rowLabel="מסלול השקעה" />;
      case "tier":       return <AccumulationTierTab data={accumulationTierAnalysis} />;
      case "action":     return <ActionCenterTab items={actions} />;
      case "preview":    return <UnifiedPreviewTab rows={unifiedRows || pensionRows} />;
      default:           return null;
    }
  }

  return (
    <div className="dashboard" dir="rtl">

      {/* Header */}
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">ניתוח דוח פנסיוני</h1>
          <p className="dashboard-subtitle">קרן פנסיה · {pensionRows?.length || 0} פוליסות · {analysisData?.files?.dataFile?.name || ""}</p>
        </div>
        {summary && (
          <div className="summary-pills">
            <span className="pill pill-green">✓ {summary.valid} תקין</span>
            <span className="pill pill-red">✗ {summary.invalid} לא תקין</span>
            <span className="pill pill-neutral">— {summary.excluded} תפעול</span>
            {summary.tierPotential > 0 && (
              <span className="pill pill-warning">⚠ {summary.tierPotential} Tier</span>
            )}
          </div>
        )}
      </header>

      {/* Tabs */}
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
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="dashboard-content">
        {renderTab()}
      </main>
    </div>
  );
}
