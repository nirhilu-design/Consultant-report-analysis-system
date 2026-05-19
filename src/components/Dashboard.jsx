import { useState } from "react";

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

export default function Dashboard({ files }) {
  const [activeSheet, setActiveSheet] = useState("קרן פנסיה");

  const [activePensionTab, setActivePensionTab] =
    useState("מסלול ביטוח");

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
          <h1>{activeSheet}</h1>

          <p>
            דוח נתונים: {files.dataFile?.name} | דוח הסכמים:{" "}
            {files.agreementsFile?.name}
          </p>
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
                  onClick={() => setActivePensionTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ========================= */}
            {/* מסלול ביטוח */}
            {/* ========================= */}

            {activePensionTab === "מסלול ביטוח" && (
              <div className="card">
                <h2>מסלול רווק בקרן פנסיה</h2>

                <table className="analysisTable">
                  <thead>
                    <tr>
                      <th>סוג ויתור על כיסוי שארים</th>
                      <th>הפניקס</th>
                      <th>הראל</th>
                      <th>כלל</th>
                      <th>מקפת</th>
                      <th>מבטחים</th>
                      <th>מיטב</th>
                      <th>אלטשולר</th>
                      <th>מור</th>
                      <th>אחרים</th>
                      <th>סה״כ</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>לא קיים ויתור שארים</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td>0</td>
                    </tr>

                    <tr>
                      <td>ויתור על בת זוג בלבד</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td>0</td>
                    </tr>

                    <tr>
                      <td>קיים ויתור מלא</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td>0</td>
                    </tr>

                    <tr>
                      <td>חסר נתון</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td>0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ========================= */}
            {/* דמי ניהול */}
            {/* ========================= */}

            {activePensionTab === "דמי ניהול" && (
              <div className="card">
                <h2>
                  דמי ניהול בקרן פנסיה מקיפה ומשלימה
                  (מספר תוכניות)
                </h2>

                <table className="analysisTable">
                  <thead>
                    <tr>
                      <th>קרנות פנסיה</th>
                      <th>הפניקס</th>
                      <th>הראל</th>
                      <th>כלל</th>
                      <th>מקפת</th>
                      <th>מבטחים</th>
                      <th>מיטב</th>
                      <th>אלטשולר</th>
                      <th>מור</th>
                      <th>אחרים</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>ד.נ תקינים</td>

                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>

                    <tr>
                      <td>ד.נ לא תקינים</td>

                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>

                    <tr>
                      <td>סה״כ</td>

                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>

                    <tr>
                      <td>
                        מתוכם מספר עובדים עם צבירה מעל 500,000 ₪
                      </td>

                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>

                    <tr>
                      <td>
                        מתוכם עובדים במסלול לצבירה גבוהה
                      </td>

                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>

                    <tr>
                      <td>סה״כ</td>

                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ========================= */}
            {/* טאבים עתידיים */}
            {/* ========================= */}

            {activePensionTab === "צבירות" && (
              <div className="card">
                <h2>צבירות</h2>
                <p>בהמשך נחבר נתוני צבירות אמיתיים.</p>
              </div>
            )}

            {activePensionTab === "חסרי סוכן" && (
              <div className="card">
                <h2>חסרי סוכן</h2>
                <p>בהמשך נבצע ניתוח חסרי סוכן.</p>
              </div>
            )}

            {activePensionTab === "סיכום קרנות פנסיה" && (
              <div className="card">
                <h2>סיכום קרנות פנסיה</h2>
                <p>בהמשך נציג טבלאות סיכום.</p>
              </div>
            )}
          </>
        )}

        {/* ========================= */}
        {/* שאר הגיליונות */}
        {/* ========================= */}

        {activeSheet !== "קרן פנסיה" && (
          <div className="card">
            <h2>תצוגת ניתוח</h2>

            <p>
              כאן נציג את טבלאות הניתוח של הגיליון הנבחר.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
