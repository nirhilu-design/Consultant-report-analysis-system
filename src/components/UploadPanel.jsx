import { useState } from "react";

export default function UploadPanel() {
  const [dataFile, setDataFile] = useState("");
  const [agreementsFile, setAgreementsFile] = useState("");

  return (
    <section className="card">
      <h2>העלאת קבצים</h2>

      <label className="uploadBox">
        <span>דוח נתונים - מנהלי הסדר</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setDataFile(e.target.files?.[0]?.name || "")}
        />
      </label>

      {dataFile && <p className="fileName">נבחר: {dataFile}</p>}

      <label className="uploadBox">
        <span>דוח הסכמים</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setAgreementsFile(e.target.files?.[0]?.name || "")}
        />
      </label>

      {agreementsFile && <p className="fileName">נבחר: {agreementsFile}</p>}
    </section>
  );
}
