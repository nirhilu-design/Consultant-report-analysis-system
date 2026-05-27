import { Component, useState } from "react";
import * as XLSX from "xlsx";

import UploadPanel from "./components/UploadPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";

import { parsePensionFund } from "./parsers/pensionFundParser.js";
import { parseAgreements } from "./parsers/agreementsParser.js";
import { parsePersonalDetails } from "./parsers/personalDetailsParser.js";
import { buildPensionSummary } from "./parsers/buildPensionSummary.js";
import { buildUnifiedPensionPersonalData } from "./parsers/unifiedPensionPersonalDataBuilder.js";

import "./styles.css";

async function readWorkbook(file, label = "") {
  if (!file) return null;

  try {
    const buffer = await file.arrayBuffer();

    return XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      cellNF: false,
      cellText: false,
    });
  } catch (error) {
    console.error("readWorkbook failed", { label, fileName: file?.name, error });
    throw new Error(`READ_WORKBOOK_FAILED:${label || file?.name || "unknown"}`);
  }
}

function hasWorkbookSheets(workbook) {
  return Boolean(
    workbook &&
      Array.isArray(workbook.SheetNames) &&
      workbook.SheetNames.length > 0
  );
}

function createUserAnalysisError(error) {
  const message = String(error?.message || "");

  if (message.startsWith("MISSING_REQUIRED_FILES")) {
    return "חסרים קבצי חובה. יש להעלות דוח נתונים ודוח הסכמים לפני התחלת הניתוח.";
  }

  if (message.startsWith("READ_WORKBOOK_FAILED")) {
    return "אחד מקבצי ה־Excel לא נקרא בצורה תקינה. מומלץ לשמור מחדש את הקובץ כ־xlsx ולהעלות שוב.";
  }

  if (message.startsWith("EMPTY_DATA_FILE")) {
    return "דוח הנתונים נקרא, אבל לא נמצאו בו שורות פנסיה תקינות. בדוק שזהו דוח הנתונים הנכון ושיש בו גיליון פנסיה.";
  }

  if (message.startsWith("EMPTY_AGREEMENTS_FILE")) {
    return "דוח ההסכמים נקרא, אבל לא נמצאו בו הסכמי דמי ניהול תקינים. בדוק שזהו קובץ ההסכמים הנכון.";
  }

  return "לא הצלחנו לנתח את הקבצים. בדוק שהקבצים הם Excel תקינים ונסה שוב.";
}

class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Dashboard render failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="card" dir="rtl">
          <h2>הניתוח הסתיים, אבל התצוגה נתקלה בשגיאה</h2>
          <p>
            הנתונים נטענו, אך אחד מרכיבי הדשבורד לא הצליח להתרנדר. אפשר לחזור
            להעלאה, לבדוק את שיוך הקבצים ולהריץ שוב בלי לרענן את האתר.
          </p>
          <button
            type="button"
            className="primaryButton"
            onClick={this.props.onReset}
          >
            חזרה להעלאת קבצים
          </button>
        </section>
      );
    }

    return this.props.children;
  }
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

  function resetAnalysis() {
    setAnalysisStarted(false);
    setAnalysisData(null);
    setAnalysisError("");
  }

  async function handleStartAnalysis() {
    if (!files.dataFile || !files.agreementsFile || isAnalyzing) {
      setAnalysisError(createUserAnalysisError(new Error("MISSING_REQUIRED_FILES")));
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisData(null);

    try {
      const dataWorkbook = await readWorkbook(files.dataFile, "דוח נתונים");
      const agreementsWorkbook = await readWorkbook(files.agreementsFile, "דוח הסכמים");
      const personalDetailsWorkbook = await readWorkbook(
        files.personalDetailsFile,
        "פרטים אישיים"
      );

      if (!hasWorkbookSheets(dataWorkbook)) throw new Error("EMPTY_DATA_FILE");
      if (!hasWorkbookSheets(agreementsWorkbook)) throw new Error("EMPTY_AGREEMENTS_FILE");

      const pensionRowsRaw = parsePensionFund(dataWorkbook);
      const agreements = parseAgreements(agreementsWorkbook);
      const personalDetails = parsePersonalDetails(personalDetailsWorkbook);

      if (!Array.isArray(pensionRowsRaw) || pensionRowsRaw.length === 0) {
        throw new Error("EMPTY_DATA_FILE");
      }

      if (!Array.isArray(agreements) || agreements.length === 0) {
        throw new Error("EMPTY_AGREEMENTS_FILE");
      }

      const unifiedPensionPersonalData = buildUnifiedPensionPersonalData(
        pensionRowsRaw,
        personalDetails
      );

      const pensionRows = unifiedPensionPersonalData.rows;

      const personalRows =
        personalDetails?.clientProfiles ||
        personalDetails?.rows ||
        personalDetails?.rawRows ||
        [];

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

      const pensionSummary = buildPensionSummary(pensionRows, agreements, {
        personalRows,
      });

      setAnalysisData({
        pensionRows,
        rawPensionRows: pensionRowsRaw,
        agreements,
        personalDetails,
        personalRows,
        personalDetailsMerge,
        unifiedPensionPersonalData,
        unifiedEmployeeData: unifiedPensionPersonalData,
        pensionSummary,
      });

      setAnalysisStarted(true);
    } catch (error) {
      console.error(error);
      setAnalysisStarted(false);
      setAnalysisData(null);
      setAnalysisError(createUserAnalysisError(error));
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
            isAnalyzing={isAnalyzing}
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
        <DashboardErrorBoundary onReset={resetAnalysis}>
          <Dashboard
            files={files}
            analysisData={analysisData}
          />
        </DashboardErrorBoundary>
      )}
    </main>
  );
}
