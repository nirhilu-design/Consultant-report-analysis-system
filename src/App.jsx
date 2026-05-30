// Path: src/App.jsx
// CORE HARDENING v26C
// Product Mode Selector Integration
//
// Pension flow remains unchanged.
// Education fund flow is parallel and renders ProductAnalysisPreview, not the pension Dashboard.

import { Component, useMemo, useState } from "react";
import UploadPanel from "./components/UploadPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ProductAnalysisPreview from "./components/ProductAnalysisPreview.jsx";

import {
  asArray,
  buildCombinedPensionSummary,
  createEmptyPersonalDetails,
  createUserAnalysisError,
  parseManagerFiles,
} from "./parsing/parseManagerFile.js";

import { parseEducationFundManagerFiles } from "./parsing/parseEducationFundManagerFiles.js";

import {
  PRODUCT_MODES,
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
            הנתונים נטענו, אך אחד מרכיבי התצוגה לא הצליח להתרנדר. אפשר לחזור
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

function combineEducationFundSummary(managerResults) {
  const summaries = managerResults.map((result) => result.summary || {});

  const issuers = [
    ...new Set(
      summaries.flatMap((summary) => Array.isArray(summary.issuers) ? summary.issuers : [])
    ),
  ];

  const funds = [
    ...new Set(
      summaries.flatMap((summary) => Array.isArray(summary.funds) ? summary.funds : [])
    ),
  ];

  const tracks = [
    ...new Set(
      summaries.flatMap((summary) => Array.isArray(summary.tracks) ? summary.tracks : [])
    ),
  ];

  return {
    productType: PRODUCT_MODES.HISHTALMUT,
    productLabel: "קרן השתלמות",
    managers: managerResults.length,
    rawRowCount: summaries.reduce((sum, summary) => sum + Number(summary.rawRowCount || 0), 0),
    unifiedRowCount: summaries.reduce((sum, summary) => sum + Number(summary.unifiedRowCount || 0), 0),
    agreementCount: summaries.reduce((sum, summary) => sum + Number(summary.agreementCount || 0), 0),
    issuerCount: issuers.length,
    fundCount: funds.length,
    trackCount: tracks.length,
    issuers,
    funds,
    tracks,
    totalAccumulation: summaries.reduce((sum, summary) => sum + Number(summary.totalAccumulation || 0), 0),
    totalMonthlyDeposits: summaries.reduce((sum, summary) => sum + Number(summary.totalMonthlyDeposits || 0), 0),
    matchedAgreements: summaries.reduce((sum, summary) => sum + Number(summary.matchedAgreements || 0), 0),
    feeWarnings: summaries.reduce((sum, summary) => sum + Number(summary.feeWarnings || 0), 0),
    missingFees: summaries.reduce((sum, summary) => sum + Number(summary.missingFees || 0), 0),
  };
}

export default function App() {
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisData, setAnalysisData] = useState(null);
  const [files, setFiles] = useState(createInitialFilesState);

  const normalizedFiles = useMemo(() => normalizeFilesState(files), [files]);
  const managers = useMemo(() => normalizeManagers(normalizedFiles), [normalizedFiles]);
  const productMode = normalizedFiles.activeProductMode || normalizedFiles.productMode || PRODUCT_MODES.PENSION;

  function resetAnalysis() {
    setAnalysisStarted(false);
    setAnalysisData(null);
    setAnalysisError("");
  }

  async function runPensionAnalysis(currentSession, managersToAnalyze, diagnostics) {
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

    return {
      productMode: PRODUCT_MODES.PENSION,
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
    };
  }

  async function runEducationFundAnalysis(currentSession, managersToAnalyze, diagnostics) {
    const managerResults = [];

    for (let index = 0; index < managersToAnalyze.length; index += 1) {
      const manager = managersToAnalyze[index];

      const result = await parseEducationFundManagerFiles({
        dataFile: manager.dataFile,
        agreementsFile: manager.agreementsFile,
        personalDetailsFile: manager.personalDetailsFile,
        manager: {
          ...manager,
          index,
        },
      });

      managerResults.push(result);
      diagnostics.warnings.push(...asArray(result.warnings));
    }

    const unifiedRows = managerResults.flatMap((result) => asArray(result.unifiedRows));
    const rawRows = managerResults.flatMap((result) => asArray(result.rowsRaw || result.educationFundRowsRaw));
    const agreements = managerResults.flatMap((result) => asArray(result.agreements || result.educationFundAgreements));
    const productSummary = combineEducationFundSummary(managerResults);

    diagnostics.counts = {
      managers: managerResults.length,
      rawRows: rawRows.length,
      agreements: agreements.length,
      unifiedRows: unifiedRows.length,
    };

    return {
      productMode: PRODUCT_MODES.HISHTALMUT,
      productType: PRODUCT_MODES.HISHTALMUT,
      productLabel: "קרן השתלמות",
      unifiedRows,
      rawRows,
      agreements,
      productSummary,
      managerResults,
      diagnostics,
      uploadSession: diagnostics.uploadSession,
    };
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
      productMode: currentSession.activeProductMode || currentSession.productMode,
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
      const nextAnalysisData =
        (currentSession.activeProductMode || currentSession.productMode) === PRODUCT_MODES.HISHTALMUT
          ? await runEducationFundAnalysis(currentSession, managersToAnalyze, diagnostics)
          : await runPensionAnalysis(currentSession, managersToAnalyze, diagnostics);

      setAnalysisData(nextAnalysisData);
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
              <p className="eyebrow">דוח יועץ / מנהלי הסדר</p>

              <h1>מערכת ניתוח דוח יועץ לפי מוצר</h1>

              <p>
                בחר מוצר, העלה קלט מידע וקלט הסכמים לכל מנהל הסדר, והריץ ניתוח
                לפי מסלול המוצר. פנסיה ממשיכה בדשבורד הרגיל, וקרן השתלמות מוצגת
                בשלב זה בתצוגת Preview ייעודית.
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
          {analysisData?.productMode === PRODUCT_MODES.HISHTALMUT ? (
            <ProductAnalysisPreview
              productMode={PRODUCT_MODES.HISHTALMUT}
              analysisData={analysisData}
              onBack={resetAnalysis}
            />
          ) : (
            <Dashboard files={normalizedFiles} analysisData={analysisData} />
          )}
        </DashboardErrorBoundary>
      )}
    </main>
  );
}
