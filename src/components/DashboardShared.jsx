// Path: src/components/DashboardShared.jsx
// CORE HARDENING v22
// Shared Dashboard widgets and formatters.
//
// Purpose:
// Keep Dashboard.jsx focused on tab orchestration while preserving the
// existing UI, class names, behavior and calculations.

export function fmtNumber(v) {
  return Number(v || 0).toLocaleString("he-IL");
}

export function fmtMoney(v) {
  return "₪" + Number(v || 0).toLocaleString("he-IL", {
    maximumFractionDigits: 0,
  });
}

export function fmtFee(v) {
  if (v === null || v === undefined || v === "") return "—";
  return `${Number(v).toFixed(2)}%`;
}

export function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

export function boolText(v) {
  return v ? "כן" : "לא";
}

export function safeText(v) {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

export function StatusBadge({ status }) {
  const map = {
    valid: ["badge-success", "תקין"],
    invalid: ["badge-danger", "לא תקין"],
    excluded: ["badge-neutral", "תפעול"],
  };

  const [cls, label] = map[status] || ["badge-neutral", status || "—"];

  return <span className={`badge ${cls}`}>{label}</span>;
}

export function PriorityBadge({ priority }) {
  if (!priority) return null;

  const cls = priority === "HIGH" ? "badge-danger" : "badge-warning";
  const label =
    priority === "HIGH"
      ? "גבוה"
      : priority === "MEDIUM"
        ? "בינוני"
        : priority === "LOW"
          ? "נמוך"
          : priority;

  return <span className={`badge ${cls}`}>{label}</span>;
}

export function EmptyState({ text = "אין נתונים" }) {
  return (
    <div className="empty-state">
      <p>{text}</p>
    </div>
  );
}

export function GlobalManagerScope({
  managerFilter,
  onManagerFilterChange,
  managerOptions = [],
  scopedCount = 0,
  totalCount = 0,
}) {
  return (
    <div className="global-scope-bar">
      <div>
        <strong>תצוגת מנהל הסדר</strong>
        <span>הבחירה כאן משפיעה על כל הטאבים בדוח.</span>
      </div>

      <label className="manager-filter global-manager-filter">
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

      <em>
        מוצגות {fmtNumber(scopedCount)} מתוך {fmtNumber(totalCount)} פוליסות
      </em>
    </div>
  );
}

export function DonutChart({ segments }) {
  const safeSegments = Array.isArray(segments) ? segments : [];
  const total = safeSegments.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let offset = 25;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;

  if (!total) {
    return (
      <div className="kpi-chart-empty">
        <span>אין נתונים להצגה</span>
      </div>
    );
  }

  return (
    <div className="kpi-donut-wrap">
      <svg viewBox="0 0 100 100" className="kpi-donut" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} className="donut-base" />
        {safeSegments.map((segment) => {
          const value = Number(segment.value || 0);
          const dash = (value / total) * circumference;
          const style = {
            strokeDasharray: `${dash} ${circumference - dash}`,
            strokeDashoffset: -offset,
          };
          offset += dash;

          return (
            <circle
              key={segment.label}
              cx="50"
              cy="50"
              r={radius}
              className={`donut-segment ${segment.className}`}
              style={style}
            />
          );
        })}
      </svg>

      <div className="kpi-donut-center">
        <strong>{fmtNumber(total)}</strong>
        <span>פוליסות</span>
      </div>
    </div>
  );
}
