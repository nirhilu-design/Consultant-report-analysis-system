import { useState } from "react";
import * as XLSX from "xlsx";

import UploadPanel from "./components/UploadPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";

import { parsePensionFund } from "./parsers/pensionFundParser.js";
import { parseAgreements } from "./parsers/agreementsParser.js";
import { buildPensionSummary } from "./parsers/buildPensionSummary.js";

import "./styles.css";

async function readWorkbook(file) {
  if (!file) return null;

  const buffer = await file.arrayBuffer();

  return XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
}

export default function App() {
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [analysisError, setAnalysisError] = useState("");

  const [analysisData, setAnalysisData] = useState(null);

  const [files, setFiles] = useState({
    dataFile: null,
    agreementsFile: null,
  });

  async function handleStartAnalysis() {
    setIsAnalyzing(true);

    setAnalysisError("");

    try {
      const dataWorkbook = await readWorkbook(files.dataFile);

      const agreementsWorkbook = await readWorkbook(
        files.agreementsFile
      );

      // =========================
      // Parsing
      // =========================

      const pensionRows = parsePensionFund(dataWorkbook);

      const agreements = parseAgreements(
        agreementsWorkbook
      );

      // =========================
      // Summary
      // =========================

      const pensionSummary = buildPensionSummary(
        pensionRows,
        agreements
      );

      // =========================
      // Final Object
      // =========================

      setAnalysisData({
        pensionRows,
        agreements,
        pensionSummary,
      });

      setAnalysisStarted(true);
    } catch (error) {
      console.error(error);

      setAnalysisError(
        "לא הצלחנו לנתח את הקבצים. בדוק שהקבצים הם Excel תקינים ושהספרייה xlsx מותקנת בפרויקט."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="app" dir="rtl">
      {!analysisStarted ? (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">
                דוח יועץ פנסיוני / מנהלי הסדר
              </p>

              <h1>
                מערכת ניתוח דוח יועץ פנסיוני
              </h1>

              <p>
                העלה דוח נתונים ודוח הסכמים,
                ולאחר מכן הפעל ניתוח.
              </p>
            </div>
          </section>

          <UploadPanel
            files={files}
            setFiles={setFiles}
            onStart={handleStartAnalysis}
          />

          {isAnalyzing && (
            <div className="statusBox">
              מנתח את הקבצים...
            </div>
          )}

          {analysisError && (
            <div className="errorBox">
              {analysisError}
            </div>
          )}
        </>
      ) : (
        <Dashboard
          files={files}
          analysisData={analysisData}
        />
      )}
    </main>
  );
}
