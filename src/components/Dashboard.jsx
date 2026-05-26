// Path: src/components/Dashboard.jsx
import { useState, useMemo } from "react";

function fmtNumber(v) {
  return Number(v || 0).toLocaleString("he-IL");
}

function fmtMoney(v) {
  return "₪" + Number(v || 0).toLocaleString("he-IL", {
    maximumFractionDigits: 0,
  });
}

function fmtFee(v) {
  if (v === null || v === undefined || v === "") return "—";
  return `${Number(v).toFixed(2)}%`;
}

function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function boolText(v) {
  return v ? "כן" : "לא";
}

function safeText(v) {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

function StatusBadge({ status }) {
  const map = {
    valid: ["badge-success", "תקין"],
    invalid: ["badge-danger", "לא תקין"],
    excluded: ["badge-neutral", "תפעול"],
  };

  const [cls, label] = map[status] || ["badge-neutral", status || "—"];

  return <span className={`badge ${cls}`}>{label}</span>;
}

function PriorityBadge({ priority }) {
  if (!priority) return null;

  const cls = priority === "HIGH" ? "badge-danger" : "badge-warning";
  const label = priority === "HIGH" ? "גבוה" : "בינוני";

  return <span className={`badge ${cls}`}>{label}</span>;
}

function EmptyState({ text = "אין נתונים" }) {
  return (
    <div className="empty-state">
      <p>{text}</p>
    </div>
  );
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

function KpiTab({ kpi }) {
  if (!kpi) return <EmptyState text="אין נתוני KPI" />;

  const cards = [
    {
      label: "סה\"כ פוליסות",
      value: fmtNumber(kpi.totalRows),
      color: "card-blue",
    },
    {
      label: "נבדקו",
      value: fmtNumber(kpi.auditedRows),
      color: "card-blue",
    },
    {
      label: "תקין",
      value: fmtNumber(kpi.validRows),
      color: "card-green",
    },
    {
      label: "לא תקין",
      value: fmtNumber(kpi.invalidRows),
      color: "card-red",
    },
    {
      label: "תפעול בלבד",
      value: fmtNumber(kpi.excludedRows),
      color: "card-neutral",
    },
    {
      label: "% עמידה",
      value: fmtPct(kpi.complianceRate),
      color: kpi.complianceRate >= 0.9 ? "card-green" : "card-red",
    },
    {
      label: "ללא הסכם",
      value: fmtNumber(kpi.noAgreementRows),
      color: "card-red",
    },
    {
      label: "פוטנציאל מודל צבירה",
      value: fmtNumber(kpi.tierPotentialRows),
      color: "card-warning",
    },
    {
      label: "Action Center",
      value: fmtNumber(kpi.actionItems),
      color: "card-warning",
    },
    {
      label: "סך צבירה מנוהלת",
      value: fmtMoney(kpi.totalAccumulation),
      color: "card-blue",
    },
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
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ analysisData }) {
  const [activeTab, setActiveTab] = useState("kpi");

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
  } = pensionSummary || {};

  const feesAudit = managementAudit || managementFeesAudit;
  const actions = actionCenter || [];
  const summary = pensionSummary?.summary;
  const previewRows = unifiedRows || pensionRows || [];

  function renderTab() {
    switch (activeTab) {
      case "kpi":
        return <KpiTab kpi={kpi} />;

      case "fees":
        return <ManagementFeesTab audit={feesAudit} />;

      case "insurance":
        return (
          <MatrixTab
            matrix={insuranceTrackMarital}
            rowLabel="מסלול ביטוח"
          />
        );

      case "investment":
        return (
          <InvestmentTrackTab
            rewardsMatrix={investmentTrackRewardsMarital}
            compensationMatrix={investmentTrackCompensationMarital}
            comparison={investmentTrackComparison}
          />
        );

      case "tier":
        return <AccumulationTierTab data={accumulationTierAnalysis} />;

      case "action":
        return <ActionCenterTab items={actions} />;

      case "preview":
        return <UnifiedPreviewTab rows={previewRows} />;

      case "qa":
        return <QaTraceTab rows={previewRows} />;

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
            קרן פנסיה · {pensionRows?.length || 0} פוליסות
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
          </div>
        )}
      </header>

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

      <main className="dashboard-content">{renderTab()}</main>
    </div>
  );
}
