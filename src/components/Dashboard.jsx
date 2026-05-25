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
  "Action Center",
  "מדרגות צבירה",
  "מסלולי השקעה",
  "מסלול ביטוח",
  "סיכום קרנות פנסיה",
];

function getValue(obj, path, fallback = 0) {
  return path.reduce((acc, key) => acc?.[key], obj) ?? fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("he-IL");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("he-IL", {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value) {
  const numeric = Number(value || 0);

  return `${(numeric * 100).toFixed(1)}%`;
}

function formatFee(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${Number(value || 0).toFixed(2)}%`;
}

function DataCell({ value, type }) {
  const numericValue = Number(value || 0);

  let displayValue = formatNumber(numericValue);

  if (type === "percent") {
    displayValue = formatPercent(value);
  }

  if (type === "money") {
    displayValue = formatMoney(value);
  }

  return (
    <td className={numericValue > 0 ? "hasValue" : ""}>
      {displayValue}
    </td>
  );
}

function StatusBadge({ status }) {
  const className =
    status === "תקין"
      ? "statusBadge success"
      : status === "חריג"
        ? "statusBadge danger"
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

  return (
    <span className={className}>
      {priority || "-"}
    </span>
  );
}

function TableEmptyState({ title = "אין נתונים להצגה" }) {
  return (
    <div className="emptyState">
      <p>{title}</p>
    </div>
  );
}

function KpiGrid({ pensionSummary }) {
  const totalPolicies = pensionSummary?.totalPolicies || 0;
  const valid = pensionSummary?.validFeePolicies || 0;
  const invalid = pensionSummary?.invalidFeePolicies || 0;
  const noAgreement = pensionSummary?.noAgreementPolicies || 0;

  const compliance =
    totalPolicies > 0
      ? valid / totalPolicies
      : 0;

  const tierPotential =
    pensionSummary?.accumulationTierAnalysis?.reduce(
      (sum, row) => sum + Number(row.tierPotentialNotUsed || 0),
      0
    ) || 0;

  const actionItems =
    pensionSummary?.actionDrilldown?.length || 0;

  const cards = [
    {
      label: "סה״כ רשומות",
      value: formatNumber(totalPolicies),
    },
    {
      label: "דמי ניהול תקינים",
      value: formatNumber(valid),
    },
    {
      label: "דמי ניהול חריגים",
      value: formatNumber(invalid),
    },
    {
      label: "אחוז תקינות",
      value: formatPercent(compliance),
    },
    {
      label: "ללא הסכם",
      value: formatNumber(noAgreement),
    },
    {
      label: "פוטנציאל מדרגות",
      value: formatNumber(tierPotential),
    },
    {
      label: "דורש טיפול",
      value: formatNumber(actionItems),
    },
  ];

  return (
    <div className="kpiGrid">
      {cards.map((card) => (
        <div className="kpiCard" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </div>
  );
}

function ManagementFeesAuditTable({ managementAudit }) {
  const issuers = managementAudit?.issuers || [];
  const rows = managementAudit?.rows || [];

  if (!issuers.length || !rows.length) {
    return <TableEmptyState />;
  }

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
                row.label.includes("סה״כ")
                  ? "totalRow"
                  : row.label.includes("תקולים")
                    ? "dangerRow"
                    : row.label.includes("תקין")
                      ? "successRow"
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
            <th>מוצר</th>
            <th>צבירה</th>
            <th>ד.נ מהפקדה</th>
            <th>ד.נ מצבירה</th>
            <th>מודל</th>
            <th>סטטוס</th>
            <th>סיבת בדיקה</th>
            <th>פעולה נדרשת</th>
            <th>עדיפות</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.auditRowId}>
              <td>{row.clientId || "-"}</td>
              <td>{row.issuerCanonical || "-"}</td>
              <td>{row.productType || "-"}</td>
              <td>{formatMoney(row.accumulation)}</td>
              <td>{formatFee(row.depositFee)}</td>
              <td>{formatFee(row.accumulationFee)}</td>
              <td>{row.auditMatchModelName || "-"}</td>
              <td>
                <StatusBadge status={row.auditStatusHe} />
              </td>
              <td>{row.auditReason || "-"}</td>
              <td>{row.requiredAction || "-"}</td>
              <td>
                <PriorityBadge priority={row.priority} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccumulationTierTable({ rows = [] }) {
  if (!rows.length) {
    return <TableEmptyState />;
  }

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>מדרגת צבירה</th>
            <th>כמות לקוחות</th>
            <th>סך צבירה</th>
            <th>יש מודל מדרגה</th>
            <th>זכאים למודל מדרגה</th>
            <th>נמצאים בפועל במודל</th>
            <th>פוטנציאל שלא מומש</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.bucket}>
              <td className="rowTitle">{row.bucket}</td>
              <DataCell value={row.clients} />
              <DataCell value={row.totalAccumulation} type="money" />
              <DataCell value={row.hasTierModel} />
              <DataCell value={row.eligibleTierModel} />
              <DataCell value={row.actualInTierModel} />
              <DataCell value={row.tierPotentialNotUsed} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvestmentTrackAccumulationTable({ rows = [] }) {
  if (!rows.length) {
    return <TableEmptyState />;
  }

  const buckets = [
    "0-50K",
    "50K-100K",
    "100K-300K",
    "300K-500K",
    "500K+",
  ];

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>מסלול השקעה</th>
            {buckets.map((bucket) => (
              <th key={bucket}>{bucket}</th>
            ))}
            <th>סה״כ</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.track}>
              <td className="rowTitle">{row.track}</td>
              {buckets.map((bucket) => (
                <DataCell key={bucket} value={row[bucket]} />
              ))}
              <DataCell value={row.total} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsurancePathTable({ pensionSummary }) {
  const managerColumns = pensionSummary?.managerColumns || [];
  const insurancePath = pensionSummary?.insurancePath || {};
  const insurancePathTotals =
    pensionSummary?.insurancePathTotals || {};
  const insuranceManagerTotals =
    pensionSummary?.insuranceManagerTotals || {};

  const rowLabels = Object.keys(insurancePath);

  if (!rowLabels.length || !managerColumns.length) {
    return <TableEmptyState />;
  }

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>מסלול ביטוח</th>

            {managerColumns.map((manager) => (
              <th key={manager}>{manager}</th>
            ))}

            <th>סה״כ</th>
          </tr>
        </thead>

        <tbody>
          {rowLabels.map((rowLabel) => (
            <tr key={rowLabel}>
              <td className="rowTitle">{rowLabel}</td>

              {managerColumns.map((manager) => (
                <DataCell
                  key={manager}
                  value={getValue(insurancePath, [
                    rowLabel,
                    manager,
                  ])}
                />
              ))}

              <DataCell
                value={getValue(insurancePathTotals, [
                  rowLabel,
                ])}
              />
            </tr>
          ))}

          <tr className="totalRow">
            <td className="rowTitle">סכום כולל</td>

            {managerColumns.map((manager) => (
              <DataCell
                key={manager}
                value={getValue(insuranceManagerTotals, [
                  manager,
                ])}
              />
            ))}

            <DataCell value={pensionSummary.totalPolicies} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function UnifiedRowsPreview({ rows = [] }) {
  const previewRows = rows.slice(0, 20);

  if (!previewRows.length) {
    return <TableEmptyState />;
  }

  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>לקוח</th>
            <th>יצרן מקורי</th>
            <th>יצרן מנורמל</th>
            <th>צבירה</th>
            <th>ד.נ מהפקדה</th>
            <th>ד.נ מצבירה</th>
            <th>מסלול השקעה</th>
            <th>מסלול ביטוח</th>
            <th>מודל</th>
            <th>סטטוס</th>
            <th>הסבר</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row) => (
            <tr key={row.auditRowId}>
              <td>{row.clientId || "-"}</td>
              <td>{row.issuerOriginal || "-"}</td>
              <td>{row.issuerCanonical || "-"}</td>
              <td>{formatMoney(row.accumulation)}</td>
              <td>{formatFee(row.depositFee)}</td>
              <td>{formatFee(row.accumulationFee)}</td>
              <td>{row.investmentTrack || "-"}</td>
              <td>{row.insuranceTrack || "-"}</td>
              <td>{row.auditMatchModelName || "-"}</td>
              <td>
                <StatusBadge status={row.auditStatusHe} />
              </td>
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
  const [activeSheet, setActiveSheet] =
    useState("קרן פנסיה");

  const [activePensionTab, setActivePensionTab] =
    useState("KPI");

  const pensionSummary =
    analysisData?.pensionSummary;

  const totals = useMemo(() => {
    return {
      rows:
        analysisData?.pensionRows?.length || 0,

      agreements:
        analysisData?.agreements?.length || 0,

      pensionPolicies:
        pensionSummary?.totalPolicies || 0,

      noAgreement:
        pensionSummary?.noAgreementPolicies || 0,
    };
  }, [analysisData, pensionSummary]);

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h3>גיליונות</h3>

        {sheets.map((sheet) => (
          <button
            key={sheet}
            className={
              activeSheet === sheet
                ? "sideItem active"
                : "sideItem"
            }
            onClick={() =>
              setActiveSheet(sheet)
            }
          >
            {sheet}
          </button>
        ))}
      </aside>

      <section className="dashboardMain">
        <div className="dashboardHeader">
          <div>
            <p className="eyebrow">
              ניתוח קובצי Excel
            </p>

            <h1>{activeSheet}</h1>

            <p>
              דוח נתונים:{" "}
              {files?.dataFile?.name ||
                "לא הועלה"}{" "}
              | דוח הסכמים:{" "}
              {files?.agreementsFile?.name ||
                "לא הועלה"}
            </p>
          </div>

          <div className="summaryBadges">
            <span>
              שורות:{" "}
              {formatNumber(totals.rows)}
            </span>

            <span>
              הסכמים:{" "}
              {formatNumber(
                totals.agreements
              )}
            </span>

            <span>
              ללא הסכם:{" "}
              {formatNumber(
                totals.noAgreement
              )}
            </span>
          </div>
        </div>

        {activeSheet === "קרן פנסיה" && (
          <>
            <div className="topTabs">
              {pensionTabs.map((tab) => (
                <button
                  key={tab}
                  className={
                    activePensionTab === tab
                      ? "topTab active"
                      : "topTab"
                  }
                  onClick={() =>
                    setActivePensionTab(tab)
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            {!pensionSummary && (
              <div className="card warningCard">
                <h2>אין עדיין נתוני ניתוח</h2>

                <p>
                  ודא שה-App קורא את קובצי
                  האקסל ומעביר analysisData
                  ל-Dashboard.
                </p>
              </div>
            )}

            {pensionSummary &&
              activePensionTab === "KPI" && (
                <div className="card wideCard">
                  <div className="sectionTitle">
                    <div>
                      <h2>תמונת מצב</h2>
                      <p>
                        סיכום בקרת דמי ניהול,
                        חריגים, יצרנים ללא הסכם
                        ופוטנציאל מדרגות.
                      </p>
                    </div>
                  </div>

                  <KpiGrid
                    pensionSummary={pensionSummary}
                  />

                  <div className="sectionSpacer" />

                  <h3>Preview שכבת Unified</h3>

                  <UnifiedRowsPreview
                    rows={pensionSummary.unifiedRows}
                  />
                </div>
              )}

            {pensionSummary &&
              activePensionTab ===
                "בקרת דמי ניהול" && (
                <div className="card wideCard">
                  <div className="sectionTitle">
                    <div>
                      <h2>
                        בקרת דמי ניהול
                      </h2>

                      <p>
                        בדיקה לפי מודלי הסכם,
                        מצבירה מאושרת וכלל בסיס
                        ללא הסכם.
                      </p>
                    </div>
                  </div>

                  <ManagementFeesAuditTable
                    managementAudit={
                      pensionSummary.managementAudit
                    }
                  />

                  {pensionSummary
                    .noAgreementDetails
                    ?.length > 0 && (
                    <div className="noteBox">
                      <strong>
                        יצרנים ללא הסכם:
                      </strong>{" "}
                      {pensionSummary.noAgreementDetails.join(
                        ", "
                      )}
                    </div>
                  )}
                </div>
              )}

            {pensionSummary &&
              activePensionTab ===
                "Action Center" && (
                <div className="card wideCard">
                  <div className="sectionTitle">
                    <div>
                      <h2>Action Center</h2>

                      <p>
                        רשומות שדורשות טיפול
                        לפי חריגת דמי ניהול,
                        חסר הסכם או פוטנציאל
                        מדרגה שלא מומש.
                      </p>
                    </div>
                  </div>

                  <ActionCenterTable
                    rows={pensionSummary.actionDrilldown}
                  />
                </div>
              )}

            {pensionSummary &&
              activePensionTab ===
                "מדרגות צבירה" && (
                <div className="card wideCard">
                  <div className="sectionTitle">
                    <div>
                      <h2>
                        מדרגות צבירה
                      </h2>

                      <p>
                        בדיקה האם לקוחות בעלי
                        צבירה גבוהה נמצאים בפועל
                        במודל מדרגה/צבירה מתאים.
                      </p>
                    </div>
                  </div>

                  <AccumulationTierTable
                    rows={
                      pensionSummary.accumulationTierAnalysis
                    }
                  />
                </div>
              )}

            {pensionSummary &&
              activePensionTab ===
                "מסלולי השקעה" && (
                <div className="card wideCard">
                  <div className="sectionTitle">
                    <div>
                      <h2>
                        מסלול השקעה × מדרגת צבירה
                      </h2>

                      <p>
                        התפלגות לקוחות לפי מסלולי
                        השקעה ומדרגות צבירה.
                      </p>
                    </div>
                  </div>

                  <InvestmentTrackAccumulationTable
                    rows={
                      pensionSummary.investmentTrackAccumulation
                    }
                  />
                </div>
              )}

            {pensionSummary &&
              activePensionTab ===
                "מסלול ביטוח" && (
                <div className="card wideCard">
                  <div className="sectionTitle">
                    <div>
                      <h2>
                        מסלול ביטוח
                      </h2>

                      <p>
                        התפלגות מסלולי ביטוח לפי
                        יצרן. בהמשך ניתן לחבר
                        סטטוס משפחתי וגיל.
                      </p>
                    </div>
                  </div>

                  <InsurancePathTable
                    pensionSummary={pensionSummary}
                  />
                </div>
              )}

            {activePensionTab ===
              "סיכום קרנות פנסיה" &&
              pensionSummary && (
                <div className="card wideCard">
                  <h2>
                    סיכום קרנות פנסיה
                  </h2>

                  <KpiGrid
                    pensionSummary={pensionSummary}
                  />

                  <div className="sectionSpacer" />

                  <ManagementFeesAuditTable
                    managementAudit={
                      pensionSummary.managementAudit
                    }
                  />
                </div>
              )}
          </>
        )}

        {activeSheet !== "קרן פנסיה" && (
          <div className="card">
            <h2>תצוגת ניתוח</h2>

            <p>
              בשלב הבא נחבר גם מוצר זה לאותו
              מנוע Audit גנרי.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
