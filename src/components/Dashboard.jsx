import { useMemo, useState } from "react";

const sheets = [
  "נתונים כלליים",
  "גביה",
  "אכ״ע",
  "ביטוח מנהלים",
  "כיסויים נוספים",
  "קרן פנסיה",
  "השתלמות וגמל",
  "דו״ח פגישות",
];

const pensionTabs = [
  "מסלול ביטוח",
  "דמי ניהול",
  "צבירות",
  "חסרי סוכן",
  "סיכום קרנות פנסיה",
];

const managerColumns = [
  "הפניקס",
  "הראל",
  "כלל",
  "מקפת",
  "מבטחים",
  "מיטב",
  "אלטשולר",
  "מור",
  "אחרים",
];

const waiverRows = [
  "לא קיים ויתור שארים",
  "ויתור על בת זוג בלבד",
  "קיים ויתור מלא",
  "חסר נתון",
];

const feeRows = [
  { key: "valid", label: "ד.נ תקינים" },
  { key: "invalid", label: "ד.נ לא תקינים" },
  { key: "total", label: "סה״כ" },
  { key: "over500k", label: "מתוכם מספר עובדים עם צבירה מעל 500,000 ₪" },
  {
    key: "highAccumulationTrack",
    label: "מתוכם עובדים במסלול לצבירה גבוהה",
  },
  { key: "totalFocus", label: "סה״כ" },
];

function getValue(obj, path, fallback = 0) {
  return path.reduce((acc, key) => acc?.[key], obj) ?? fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("he-IL");
}

function DataCell({ value }) {
  const numericValue = Number(value || 0);

  return (
    <td className={numericValue > 0 ? "hasValue" : ""}>
      {formatNumber(numericValue)}
    </td>
  );
}

export default function Dashboard({
  files,
  analysisData,
}) {
  const [activeSheet, setActiveSheet] =
    useState("קרן פנסיה");

  const [activePensionTab, setActivePensionTab] =
    useState("מסלול ביטוח");

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
              {files.dataFile?.name ||
                "לא הועלה"}{" "}
              | דוח הסכמים:{" "}
              {files.agreementsFile?.name ||
                "לא הועלה"}
            </p>
          </div>

          <div className="summaryBadges">
            <span>
              שורות פנסיה:{" "}
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

        {/* ========================= */}
        {/* קרן פנסיה */}
        {/* ========================= */}

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
                  ודא שה-App קורא את
                  קובצי האקסל ומעביר
                  analysisData ל-Dashboard.
                </p>
              </div>
            )}

            {/* ========================= */}
            {/* מסלול ביטוח */}
            {/* ========================= */}

            {pensionSummary &&
              activePensionTab ===
                "מסלול ביטוח" && (
                <div className="card wideCard">
                  <div className="sectionTitle">
                    <div>
                      <h2>
                        מסלול רווק בקרן
                        פנסיה
                      </h2>

                      <p>
                        בדיקת ויתור שארים
                        לפי יצרן.
                      </p>
                    </div>
                  </div>

                  <div className="tableWrap">
                    <table className="analysisTable">
                      <thead>
                        <tr>
                          <th>
                            סוג ויתור על
                            כיסוי שארים
                          </th>

                          {managerColumns.map(
                            (manager) => (
                              <th
                                key={manager}
                              >
                                {manager}
                              </th>
                            )
                          )}

                          <th>סה״כ</th>
                        </tr>
                      </thead>

                      <tbody>
                        {waiverRows.map(
                          (rowLabel) => (
                            <tr
                              key={rowLabel}
                            >
                              <td className="rowTitle">
                                {rowLabel}
                              </td>

                              {managerColumns.map(
                                (
                                  manager
                                ) => (
                                  <DataCell
                                    key={
                                      manager
                                    }
                                    value={getValue(
                                      pensionSummary.insurancePath,
                                      [
                                        rowLabel,
                                        manager,
                                      ]
                                    )}
                                  />
                                )
                              )}

                              <DataCell
                                value={getValue(
                                  pensionSummary.insurancePathTotals,
                                  [
                                    rowLabel,
                                  ]
                                )}
                              />
                            </tr>
                          )
                        )}

                        <tr className="totalRow">
                          <td className="rowTitle">
                            סכום כולל
                          </td>

                          {managerColumns.map(
                            (manager) => (
                              <DataCell
                                key={manager}
                                value={getValue(
                                  pensionSummary.insuranceManagerTotals,
                                  [
                                    manager,
                                  ]
                                )}
                              />
                            )
                          )}

                          <DataCell
                            value={
                              pensionSummary.totalPolicies
                            }
                          />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* ========================= */}
            {/* דמי ניהול */}
            {/* ========================= */}

            {pensionSummary &&
              activePensionTab ===
                "דמי ניהול" && (
                <div className="card wideCard">
                  <div className="sectionTitle">
                    <div>
                      <h2>
                        דמי ניהול בקרן
                        פנסיה
                      </h2>

                      <p>
                        בדיקת תקינות מול
                        דוח הסכמים.
                      </p>
                    </div>
                  </div>

                  <div className="tableWrap">
                    <table className="analysisTable">
                      <thead>
                        <tr>
                          <th>
                            קרנות פנסיה
                          </th>

                          {managerColumns.map(
                            (manager) => (
                              <th
                                key={manager}
                              >
                                {manager}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {feeRows.map(
                          (row) => (
                            <tr
                              key={row.key}
                              className={
                                row.key.includes(
                                  "total"
                                )
                                  ? "totalRow"
                                  : ""
                              }
                            >
                              <td className="rowTitle">
                                {row.label}
                              </td>

                              {managerColumns.map(
                                (
                                  manager
                                ) => (
                                  <DataCell
                                    key={
                                      manager
                                    }
                                    value={getValue(
                                      pensionSummary.managementFees,
                                      [
                                        row.key,
                                        manager,
                                      ]
                                    )}
                                  />
                                )
                              )}
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {pensionSummary
                    .noAgreementDetails
                    .length > 0 && (
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

            {/* ========================= */}
            {/* טאבים עתידיים */}
            {/* ========================= */}

            {activePensionTab ===
              "צבירות" && (
              <div className="card">
                <h2>צבירות</h2>

                <p>
                  בהמשך נחבר ניתוח
                  צבירות אמיתי.
                </p>
              </div>
            )}

            {activePensionTab ===
              "חסרי סוכן" && (
              <div className="card">
                <h2>חסרי סוכן</h2>

                <p>
                  בהמשך נבצע בדיקת
                  מספר סוכן.
                </p>
              </div>
            )}

            {activePensionTab ===
              "סיכום קרנות פנסיה" &&
              pensionSummary && (
                <div className="card">
                  <h2>
                    סיכום קרנות פנסיה
                  </h2>

                  <div className="kpiGrid">
                    <div className="kpiCard">
                      <span>
                        סה״כ תוכניות
                      </span>

                      <strong>
                        {formatNumber(
                          pensionSummary.totalPolicies
                        )}
                      </strong>
                    </div>

                    <div className="kpiCard">
                      <span>
                        דמי ניהול
                        תקינים
                      </span>

                      <strong>
                        {formatNumber(
                          pensionSummary.validFeePolicies
                        )}
                      </strong>
                    </div>

                    <div className="kpiCard">
                      <span>
                        דמי ניהול לא
                        תקינים
                      </span>

                      <strong>
                        {formatNumber(
                          pensionSummary.invalidFeePolicies
                        )}
                      </strong>
                    </div>

                    <div className="kpiCard">
                      <span>
                        ללא הסכם
                      </span>

                      <strong>
                        {formatNumber(
                          pensionSummary.noAgreementPolicies
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
          </>
        )}

        {activeSheet !== "קרן פנסיה" && (
          <div className="card">
            <h2>תצוגת ניתוח</h2>

            <p>
              כאן נציג את טבלאות
              הניתוח של הגיליון
              הנבחר.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
