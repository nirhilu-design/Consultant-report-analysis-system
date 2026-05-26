import { useState } from "react";
import * as XLSX from "xlsx";

import UploadPanel from "./components/UploadPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";

import { parsePensionFund } from "./parsers/pensionFundParser.js";
import { parseAgreements } from "./parsers/agreementsParser.js";
import { parsePersonalDetails } from "./parsers/personalDetailsParser.js";
import { buildPensionSummary } from "./parsers/buildPensionSummary.js";
import { buildUnifiedPensionPersonalData } from "./parsers/unifiedPensionPersonalDataBuilder.js";

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
    personalDetailsFile: null,
  });

  async function handleStartAnalysis() {
    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const dataWorkbook = await readWorkbook(files.dataFile);
      const agreementsWorkbook = await readWorkbook(files.agreementsFile);
      const personalDetailsWorkbook = await readWorkbook(files.personalDetailsFile);

      const pensionRowsRaw = parsePensionFund(dataWorkbook);
      const agreements = parseAgreements(agreementsWorkbook);
      const personalDetails = parsePersonalDetails(personalDetailsWorkbook);

      const unifiedPensionPersonalData = buildUnifiedPensionPersonalData(
        pensionRowsRaw,
        personalDetails
      );

      const pensionRows = unifiedPensionPersonalData.rows;

      const personalDetailsMerge = {
        source: "unifiedPensionPersonalData",
        hasPersonalDetailsFile: Boolean(personalDetails?.hasFile),
        joinKey: "employeeCode",
        metadata: {
          pensionRowCount: unifiedPensionPersonalData.metadata.pensionRows,
          clientProfileCount: unifiedPensionPersonalData.metadata.personalProfiles,
          matchedPensionRows: unifiedPensionPersonalData.metadata.matchedPensionRows,
          unmatchedPensionRows: unifiedPensionPersonalData.metadata.unmatchedPensionRows,
          matchedClientProfiles: unifiedPensionPersonalData.metadata.matchedEmployees,
          unmatchedClientProfiles:
            unifiedPensionPersonalData.metadata.personalProfilesWithoutPensionRows,
          matchRate: unifiedPensionPersonalData.metadata.rowMatchRate,
          matchMethods: {
            employeeCode: unifiedPensionPersonalData.metadata.matchedPensionRows,
          },
        },
      };

      const pensionSummary = buildPensionSummary(pensionRows, agreements);

      setAnalysisData({
        pensionRows,
        rawPensionRows: pensionRowsRaw,
        agreements,
        personalDetails,
        personalDetailsMerge,
        unifiedPensionPersonalData,
        unifiedEmployeeData: unifiedPensionPersonalData,
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
                העלה דוח נתונים, דוח הסכמים וקובץ פרטים אישיים אופציונלי,
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
