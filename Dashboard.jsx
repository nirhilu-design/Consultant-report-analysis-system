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

export default function Dashboard({ files }) {
  const [activeSheet, setActiveSheet] = useState("קרן פנסיה");

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

        <div className="card">
          <h2>תצוגת ניתוח</h2>
          <p>כאן נציג את טבלאות הניתוח של הגיליון הנבחר.</p>
        </div>
      </section>
    </div>
  );
}
