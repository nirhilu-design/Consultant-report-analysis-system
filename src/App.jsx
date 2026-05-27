import { Component, useMemo, useState } from "react";
import UploadPanel from "./components/UploadPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";

import {
  asArray,
  buildCombinedPensionSummary,
  createEmptyPersonalDetails,
  createUserAnalysisError,
  parseManagerFiles,
} from "./parsing/parseManagerFile.js";
import {
  createInitialFilesState,
  getActiveManagers,
  getInvalidManagersForAnalysis,
  normalizeFilesState,
  normalizeManagers,
  snapshotUploadSession,
} from "./upload/uploadSessionModel.js";

import "./styles.css";

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
  const [files, setFiles] = useState(createInitialFilesState);

  const normalizedFiles = useMemo(() => normalizeFilesState(files), [files]);
  const managers = useMemo(() => normalizeManagers(normalizedFiles), [normalizedFiles]);

  function resetAnalysis() {
    setAnalysisStarted(false);
    setAnalysisData(null);
    setAnalysisError("");
  }

  async function handleStartAnalysis() {
    if (isAnalyzing) return;

    const currentSession = normalizeFilesState(files);
    const managersToAnalyze = getActiveManagers(currentSession);
    const invalidManagers = getInvalidManagersForAnalysis(currentSession);

    if (invalidManagers.length) {
      setAnalysisError(createUserAnalysisError(new Error("MISSING_REQUIRED_FILES")));
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisData(null);

    const diagnostics = {
      warnings: [],
      uploadSession: snapshotUploadSession(currentSession),
      managers: managersToAnalyze.map((manager) => ({
        id: manager.id,
        name: manager.name,
        files: {
          dataFile: manager.dataFile?.name || "",
          agreementsFile: manager.agreementsFile?.name || "",
          personalDetailsFile: manager.personalDetailsFile?.name || "",
        },
      })),
      counts: {},
    };

    try {
      const managerResults = [];

      for (let index = 0; index < managersToAnalyze.length; index += 1) {
        const result = await parseManagerFiles(managersToAnalyze[index], index);
        managerResults.push(result);
        diagnostics.warnings.push(...result.warnings);
      }

      const pensionSummary = buildCombinedPensionSummary(managerResults);
      const pensionRows = pensionSummary.unifiedRows;
      const rawPensionRows = managerResults.flatMap((result) => result.rawPensionRows);
      const agreements = managerResults.flatMap((result) => result.agreements);
      const personalRows = managerResults.flatMap((result) => asArray(result.personalRows));

      diagnostics.counts = managerResults.reduce(
        (acc, result) => {
          acc.managers += 1;
          acc.rawPensionRows += result.counts.rawPensionRows || 0;
          acc.agreements += result.counts.agreements || 0;
          acc.personalProfiles += result.counts.personalProfiles || 0;
          acc.unifiedRows += result.counts.unifiedRows || 0;
          return acc;
        },
        {
          managers: 0,
          rawPensionRows: 0,
          agreements: 0,
          personalProfiles: 0,
          unifiedRows: 0,
        }
      );

      setAnalysisData({
        pensionRows,
        rawPensionRows,
        agreements,
        personalDetails: managerResults[0]?.personalDetails || createEmptyPersonalDetails(),
        personalRows,
        personalDetailsMerge: managerResults[0]?.personalDetailsMerge || null,
        unifiedPensionPersonalData: {
          source: "multiManagerUnifiedData",
          rows: pensionRows,
          metadata: diagnostics.counts,
        },
        unifiedEmployeeData: {
          source: "multiManagerUnifiedData",
          rows: pensionRows,
          metadata: diagnostics.counts,
        },
        pensionSummary,
        managerResults,
        diagnostics,
        uploadSession: diagnostics.uploadSession,
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
              <p className="eyebrow">דוח יועץ פנסיוני / מנהלי הסדר</p>

              <h1>מערכת ניתוח דוח יועץ פנסיוני</h1>

              <p>
                העלה דוח נתונים, דוח הסכמים וקובץ פרטים אישיים אופציונלי לכל
                מנהל הסדר. אפשר להריץ מנהל אחד או כמה מנהלים יחד.
              </p>
            </div>
          </section>

          <UploadPanel
            files={{ ...normalizedFiles, managers }}
            setFiles={setFiles}
            onStart={handleStartAnalysis}
            isAnalyzing={isAnalyzing}
          />

          {isAnalyzing && <div className="statusBox">מנתח את הקבצים...</div>}

          {analysisError && <div className="errorBox">{analysisError}</div>}
        </>
      ) : (
        <DashboardErrorBoundary onReset={resetAnalysis}>
          <Dashboard files={normalizedFiles} analysisData={analysisData} />
        </DashboardErrorBoundary>
      )}
    </main>
  );
}
