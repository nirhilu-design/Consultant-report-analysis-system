import { useMemo, useState } from "react";

const sheets = [
  "קרן פנסיה",
  "קרן השתלמות",
  "נתונים כלליים",
  "גביה",
  "אכ״ע",
  "ביטוח מנהלים",
  "כיסויים נוספים",
  "השתלמות וגמל",
  "דו״ח פגישות",
];

const pensionTabs = [
  "KPI",
  "בקרת דמי ניהול",
  "מסלול ביטוח × סטטוס משפחתי",
  "מסלולי השקעה",
  "מודלי צבירה גבוהה",
  "Action Center",
  "Unified Preview",
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("he-IL");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("he-IL", {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatFee(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value || 0).toFixed(2)}%`;
}

function StatusBadge({ status }) {
  const className =
    status === "תקין"
      ? "statusBadge success"
      : status === "חריג"
        ? "statusBadge danger"
        : status === "הוחרג"
          ? "statusBadge warning"
          : "statusBadge warning";

  return <span className={className}>{status || "-"}</span>;
}

function PriorityBadge({ priority }) {
  const className =
    priority === "HIGH"
      ? "priorityBadge high"
      : priority === "MEDIUM"
        ? "priorityBadge medium"
        : "priorityBadge low";

  return <span className={className}>{priority || "-"}</span>;
}

function TableEmptyState({ title = "אין נתונים להצגה" }) {
  return (
    <div className="emptyState">
      <p>{title}</p>
    </div>
  );
}

function DataCell({ value, type }) {
  let display = formatNumber(value);

  if (type === "percent") display = formatPercent(value);
  if (type === "money") display = formatMoney(value);

  return (
    <td className={Number(value || 0) > 0 ? "hasValue" : ""}>
      {display}
    </td>
  );
}

function KpiGrid({ kpi }) {
  const cards = [
    ["סה״כ רשומות", kpi?.totalRows],
    ["נבדקו בפועל", kpi?.auditedRows],
    ["עברו בדיקת דמי ניהול", kpi?.validRows],
    ["לא עברו בדיקת דמי ניהול", kpi?.invalidRows],
    ["אחוז מעבר", formatPercent(kpi?.complianceRate)],
    ["הוחרגו", kpi?.excludedRows],
    ["ללא הסכם", kpi?.noAgreementRows],
    ["פוטנציאל מודל צבירה", kpi?.tierPotentialRows],
    ["דורש טיפול", kpi?.actionItems],
  ];

  return (
    <div className="kpiGrid">
      {cards.map(([label, value]) => (
        <div className="kpiCard" key={label}>
          <span>{label}</span>
          <strong>
            {typeof value === "string"
              ? value
              : formatNumber(value)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function GenericMatrixTable({
  titleColumn,
  columns = [],
  rows = [],
}) {
  if (!rows.length) return <TableEmptyState />;

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>{titleColumn}</th>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
            <th>סה״כ</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row[titleColumn]}>
              <td className="rowTitle">{row[titleColumn]}</td>

              {columns.map((col) => (
                <DataCell key={col} value={row[col]} />
              ))}

              <DataCell value={row["סה״כ"]} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManagementFeesAuditTable({ audit }) {
  const issuers = audit?.issuers || [];
  const rows = audit?.rows || [];

  if (!issuers.length || !rows.length) return <TableEmptyState />;

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>מדד</th>
            {issuers.map((issuer) => (
              <th key={issuer}>{issuer}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={
                row.label.includes("תקולים")
                  ? "dangerRow"
                  : row.label.includes("תקין")
                    ? "successRow"
                    : row.label.includes("סה״כ")
                      ? "totalRow"
                      : ""
              }
            >
              <td className="rowTitle">{row.label}</td>

              {issuers.map((issuer) => (
                <DataCell
                  key={issuer}
                  value={row[issuer]}
                  type={
                    row.label.includes("אחוז")
                      ? "percent"
                      : undefined
                  }
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccumulationTierTable({ rows = [] }) {
  if (!rows.length) return <TableEmptyState />;

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>מדרגת צבירה</th>
            <th>כמות לקוחות</th>
            <th>סך צבירה</th>
            <th>קיים מודל צבירות גבוהות</th>
            <th>נמצאים בפועל במודל</th>
            <th>פוטנציאל שלא מומש</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row["מדרגת צבירה"]}>
              <td className="rowTitle">{row["מדרגת צבירה"]}</td>
              <DataCell value={row["כמות לקוחות"]} />
              <DataCell value={row["סך צבירה"]} type="money" />
              <DataCell value={row["קיים מודל צבירות גבוהות"]} />
              <DataCell value={row["נמצאים בפועל במודל צבירות גבוהות"]} />
              <DataCell value={row["פוטנציאל שלא מומש"]} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionCenterTable({ rows = [] }) {
  if (!rows.length) {
    return <TableEmptyState title="אין רשומות הדורשות טיפול" />;
  }

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>לקוח</th>
            <th>יצרן</th>
            <th>צבירה</th>
            <th>ד.נ מהפקדה</th>
            <th>ד.נ מצבירה</th>
            <th>מודל</th>
            <th>סטטוס</th>
            <th>סיבה</th>
            <th>פעולה נדרשת</th>
            <th>עדיפות</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.auditRowId}>
              <td>{row.clientId || "-"}</td>
              <td>{row.issuerCanonical || "-"}</td>
              <td>{formatMoney(row.accumulation)}</td>
              <td>{formatFee(row.depositFee)}</td>
              <td>{formatFee(row.accumulationFee)}</td>
              <td>{row.auditMatchModelName || "-"}</td>
              <td><StatusBadge status={row.auditDisplayStatus || row.auditStatusHe} /></td>
              <td>{row.auditReason || "-"}</td>
              <td>{row.requiredAction || "-"}</td>
              <td><PriorityBadge priority={row.priority} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnifiedPreviewTable({ rows = [] }) {
  const preview = rows.slice(0, 50);

  if (!preview.length) return <TableEmptyState />;

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>לקוח</th>
            <th>יצרן מקורי</th>
            <th>יצרן מנורמל</th>
            <th>סטטוס שירות</th>
            <th>מצב משפחתי</th>
            <th>מסלול ביטוח</th>
            <th>מסלול תגמולים</th>
            <th>מסלול פיצויים</th>
            <th>צבירה</th>
            <th>ד.נ מהפקדה</th>
            <th>ד.נ מצבירה</th>
            <th>מודל</th>
            <th>סטטוס</th>
            <th>הסבר</th>
          </tr>
        </thead>

        <tbody>
          {preview.map((row) => (
            <tr key={row.auditRowId}>
              <td>{row.clientId || "-"}</td>
              <td>{row.issuerOriginal || "-"}</td>
              <td>{row.issuerCanonical || "-"}</td>
              <td>{row.serviceStatus || "-"}</td>
              <td>{row.maritalStatus || "-"}</td>
              <td>{row.insuranceTrack || "-"}</td>
              <td>{row.investmentTrackRewards || "-"}</td>
              <td>{row.investmentTrackCompensation || "-"}</td>
              <td>{formatMoney(row.accumulation)}</td>
              <td>{formatFee(row.depositFee)}</td>
              <td>{formatFee(row.accumulationFee)}</td>
              <td>{row.auditMatchModelName || "-"}</td>
              <td><StatusBadge status={row.auditDisplayStatus || row.auditStatusHe} /></td>
              <td>{row.auditReason || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard({
  files,
  analysisData,
}) {
  const [activeSheet, setActiveSheet] = useState("קרן פנסיה");
  const [activePensionTab, setActivePensionTab] = useState("KPI");
  const [investmentSubTab, setInvestmentSubTab] = useState("תגמולים");

  const pensionSummary = analysisData?.pensionSummary;

  const totals = useMemo(() => {
    return {
      rows: analysisData?.pensionRows?.length || 0,
      agreements: analysisData?.agreements?.length || 0,
      noAgreement: pensionSummary?.noAgreementPolicies || 0,
    };
  }, [analysisData, pensionSummary]);

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h3>גיליונות</h3>

        {sheets.map((sheet) => (
          <button
            key={sheet}
            className={activeSheet === sheet ? "sideItem active" : "sideItem"}
            onClick={() => setActiveSheet(sheet)}
          >
            {sheet}
          </button>
        ))}
      </aside>

      <section className="dashboardMain">
        <div className="dashboardHeader">
          <div>
            <p className="eyebrow">ניתוח קובצי Excel</p>
            <h1>{activeSheet}</h1>

            <p>
              דוח נתונים: {files?.dataFile?.name || "לא הועלה"} | דוח הסכמים:{" "}
              {files?.agreementsFile?.name || "לא הועלה"}
            </p>
          </div>

          <div className="summaryBadges">
            <span>שורות: {formatNumber(totals.rows)}</span>
            <span>הסכמים: {formatNumber(totals.agreements)}</span>
            <span>ללא הסכם: {formatNumber(totals.noAgreement)}</span>
          </div>
        </div>

        {activeSheet === "קרן פנסיה" && (
          <>
            <div className="topTabs">
              {pensionTabs.map((tab) => (
                <button
                  key={tab}
                  className={activePensionTab === tab ? "topTab active" : "topTab"}
                  onClick={() => setActivePensionTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {!pensionSummary && (
              <div className="card warningCard">
                <h2>אין עדיין נתוני ניתוח</h2>
                <p>יש להעלות דוח יועץ ודוח הסכמים.</p>
              </div>
            )}

            {pensionSummary && activePensionTab === "KPI" && (
              <div className="card wideCard">
                <div className="sectionTitle">
                  <div>
                    <h2>KPI</h2>
                    <p>תמונת מצב של בקרת קרנות הפנסיה.</p>
                  </div>
                </div>

                <KpiGrid kpi={pensionSummary.kpi} />
              </div>
            )}

            {pensionSummary && activePensionTab === "בקרת דמי ניהול" && (
              <div className="card wideCard">
                <div className="sectionTitle">
                  <div>
                    <h2>בקרת דמי ניהול</h2>
                    <p>החיתוך המרכזי שסגרנו: מודל א, מודל ב, צבירות, מצבירה מאושרת, baseline, תקולים והוחרגו.</p>
                  </div>
                </div>

                <ManagementFeesAuditTable audit={pensionSummary.managementAudit} />
              </div>
            )}

            {pensionSummary && activePensionTab === "מסלול ביטוח × סטטוס משפחתי" && (
              <div className="card wideCard">
                <div className="sectionTitle">
                  <div>
                    <h2>מסלול ביטוח × סטטוס משפחתי</h2>
                    <p>התפלגות מסלולי הביטוח מול סטטוס משפחתי.</p>
                  </div>
                </div>

                <GenericMatrixTable
                  titleColumn="מסלול ביטוח"
                  columns={pensionSummary.insuranceTrackMarital?.columns}
                  rows={pensionSummary.insuranceTrackMarital?.rows}
                />
              </div>
            )}

            {pensionSummary && activePensionTab === "מסלולי השקעה" && (
              <div className="card wideCard">
                <div className="sectionTitle">
                  <div>
                    <h2>מסלולי השקעה</h2>
                    <p>פיצול לפי תגמולים ופיצויים, מול יצרנים.</p>
                  </div>
                </div>

                <div className="topTabs compactTabs">
                  {["תגמולים", "פיצויים"].map((tab) => (
                    <button
                      key={tab}
                      className={investmentSubTab === tab ? "topTab active" : "topTab"}
                      onClick={() => setInvestmentSubTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {investmentSubTab === "תגמולים" && (
                  <GenericMatrixTable
                    titleColumn="מסלול השקעה תגמולים"
                    columns={pensionSummary.investmentTrackRewardsIssuer?.columns}
                    rows={pensionSummary.investmentTrackRewardsIssuer?.rows}
                  />
                )}

                {investmentSubTab === "פיצויים" && (
                  <GenericMatrixTable
                    titleColumn="מסלול השקעה פיצויים"
                    columns={pensionSummary.investmentTrackCompensationIssuer?.columns}
                    rows={pensionSummary.investmentTrackCompensationIssuer?.rows}
                  />
                )}
              </div>
            )}

            {pensionSummary && activePensionTab === "מודלי צבירה גבוהה" && (
              <div className="card wideCard">
                <div className="sectionTitle">
                  <div>
                    <h2>מדרגות צבירה × מודלי צבירה גבוהה</h2>
                    <p>בדיקה האם מי שעומד במדרגת צבירה אכן נמצא במודל מתאים.</p>
                  </div>
                </div>

                <AccumulationTierTable rows={pensionSummary.accumulationTierAnalysis} />
              </div>
            )}

            {pensionSummary && activePensionTab === "Action Center" && (
              <div className="card wideCard">
                <div className="sectionTitle">
                  <div>
                    <h2>Action Center</h2>
                    <p>כל הרשומות שדורשות טיפול והפעולה הנדרשת.</p>
                  </div>
                </div>

                <ActionCenterTable rows={pensionSummary.actionDrilldown} />
              </div>
            )}

            {pensionSummary && activePensionTab === "Unified Preview" && (
              <div className="card wideCard">
                <div className="sectionTitle">
                  <div>
                    <h2>Unified Preview</h2>
                    <p>בדיקת שורות מאוחדות לאחר mapping, הסכמים וחוקי audit.</p>
                  </div>
                </div>

                <UnifiedPreviewTable rows={pensionSummary.unifiedRows} />
              </div>
            )}
          </>
        )}

        {activeSheet !== "קרן פנסיה" && (
          <div className="card">
            <h2>תצוגת ניתוח</h2>
            <p>בשלב הבא נחבר מוצר זה למנוע Audit גנרי.</p>
          </div>
        )}
      </section>
    </div>
  );
}
