import { Component, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import UploadPanel from "./components/UploadPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";

import { parsePensionFund } from "./parsers/pensionFundParser.js";
import { parseAgreements } from "./parsers/agreementsParser.js";
import { parsePersonalDetails } from "./parsers/personalDetailsParser.js";
import { buildPensionSummary } from "./parsers/buildPensionSummary.js";
import { buildUnifiedPensionPersonalData } from "./parsers/unifiedPensionPersonalDataBuilder.js";
import { buildPensionAnalytics } from "./unified/analyticsEngine.js";
import { buildDataQuality } from "./unified/dataQualityEngine.js";

import "./styles.css";

const DEFAULT_MANAGER_ID = "manager_1";

function createManager(index = 1) {
  return {
    id: `manager_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `מנהל הסדר ${index}`,
    dataFile: null,
    agreementsFile: null,
    personalDetailsFile: null,
  };
}

function createInitialFilesState() {
  return {
    managers: [
      {
        id: DEFAULT_MANAGER_ID,
        name: "מנהל הסדר 1",
        dataFile: null,
        agreementsFile: null,
        personalDetailsFile: null,
      },
    ],
  };
}

function normalizeManagers(filesState) {
  if (Array.isArray(filesState?.managers) && filesState.managers.length) {
    return filesState.managers.map((manager, index) => ({
      id: manager.id || `manager_${index + 1}`,
      name: manager.name || `מנהל הסדר ${index + 1}`,
      dataFile: manager.dataFile || null,
      agreementsFile: manager.agreementsFile || null,
      personalDetailsFile: manager.personalDetailsFile || null,
    }));
  }

  return [
    {
      id: DEFAULT_MANAGER_ID,
      name: "מנהל הסדר 1",
      dataFile: filesState?.dataFile || null,
      agreementsFile: filesState?.agreementsFile || null,
      personalDetailsFile: filesState?.personalDetailsFile || null,
    },
  ];
}

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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createEmptyPersonalDetails(warning = "") {
  return {
    hasFile: false,
    rows: [],
    rawRows: [],
    clientProfiles: [],
    metadata: {
      rowCount: 0,
      warning,
    },
  };
}

function runAnalysisStage(stageKey, label, callback) {
  try {
    return callback();
  } catch (error) {
    console.error(`analysis stage failed: ${stageKey}`, { label, error });

    const wrapped = new Error(`ANALYSIS_STAGE_FAILED:${stageKey}`);
    wrapped.cause = error;
    wrapped.stageLabel = label;
    throw wrapped;
  }
}

function createUserAnalysisError(error) {
  const message = String(error?.message || "");

  if (message.startsWith("MISSING_REQUIRED_FILES")) {
    return "חסרים קבצי חובה. לכל מנהל הסדר פעיל יש להעלות דוח נתונים ודוח הסכמים.";
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

  if (message.startsWith("INVALID_UNIFIED_RESULT")) {
    return "הנתונים נקראו, אבל שכבת האיחוד החזירה מבנה לא תקין. זה בדרך כלל אומר שאחד הקבצים במבנה שונה מהצפוי.";
  }

  if (message.startsWith("ANALYSIS_STAGE_FAILED")) {
    const stageLabel = error?.stageLabel || "אחד משלבי הניתוח";
    return `${stageLabel} נכשל. הקבצים לא אבדו — אפשר לבדוק את שיוך הקבצים ולנסות שוב.`;
  }

  return "לא הצלחנו לנתח את הקבצים. בדוק שהקבצים הם Excel תקינים ונסה שוב.";
}

function attachManagerToRows(rows = [], manager) {
  return asArray(rows).map((row) => ({
    ...row,
    arrangementManager: manager.name,
    arrangementManagerName: manager.name,
    brokerId: manager.id,
    brokerName: manager.name,
    sourceManagerId: manager.id,
    sourceManagerName: manager.name,
    raw: {
      ...(row?.raw || {}),
      arrangementManager: manager.name,
      arrangementManagerName: manager.name,
      "מנהל הסדר": manager.name,
    },
  }));
}

function hasAnyAgreement(row) {
  return Boolean(
    row.agreementIssuerFound ||
      row.auditMatchRuleType === "INLINE_AGREEMENT" ||
      row.auditMatchResult === "MATCH_INLINE_AGREEMENT" ||
      row.auditMatchResult === "FAIL_INLINE_AGREEMENT" ||
      row.depositFeeAgreement !== null && row.depositFeeAgreement !== undefined && row.depositFeeAgreement !== "" ||
      row.accumulationFeeAgreement !== null && row.accumulationFeeAgreement !== undefined && row.accumulationFeeAgreement !== "" ||
      row.auditReferenceDepositFee !== null && row.auditReferenceDepositFee !== undefined && row.auditReferenceDepositFee !== "" ||
      row.auditReferenceAccumulationFee !== null && row.auditReferenceAccumulationFee !== undefined && row.auditReferenceAccumulationFee !== ""
  );
}

function buildCombinedPensionSummary(managerResults) {
  const unifiedRows = managerResults.flatMap((result) => asArray(result?.pensionSummary?.unifiedRows));
  const analytics = buildPensionAnalytics(unifiedRows);
  const dataQuality = buildDataQuality(unifiedRows);
  const auditedRows = unifiedRows.filter((row) => row.auditStatus !== "excluded");

  return {
    ...analytics,
    unifiedRows,
    dataQuality,
    managerResults,
    managementFeesAudit: analytics.managementAudit,
    actionCenter: analytics.actionCenter || analytics.actionDrilldown || [],
    actionDrilldown: analytics.actionDrilldown || analytics.actionCenter || [],
    summary: {
      total: unifiedRows.length,
      audited: auditedRows.length,
      valid: unifiedRows.filter((row) => row.auditStatus === "valid").length,
      invalid: unifiedRows.filter((row) => row.auditStatus === "invalid").length,
      excluded: unifiedRows.filter((row) => row.auditStatus === "excluded").length,
      tierPotential: unifiedRows.filter((row) => row.tierPotentialNotUsed).length,
      noAgreement: auditedRows.filter((row) => !hasAnyAgreement(row)).length,
      dataQualityIssues: dataQuality?.summary?.issueCount || 0,
      dataQualityHighIssues: dataQuality?.summary?.highIssues || 0,
      managers: managerResults.length,
    },
  };
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
  const [files, setFiles] = useState(createInitialFilesState);

  const managers = useMemo(() => normalizeManagers(files), [files]);

  function resetAnalysis() {
    setAnalysisStarted(false);
    setAnalysisData(null);
    setAnalysisError("");
  }

  async function analyzeSingleManager(manager, index) {
    const managerLabel = manager.name || `מנהל הסדר ${index + 1}`;

    const dataWorkbook = await readWorkbook(manager.dataFile, `${managerLabel} — דוח נתונים`);
    const agreementsWorkbook = await readWorkbook(manager.agreementsFile, `${managerLabel} — דוח הסכמים`);
    const personalDetailsWorkbook = await readWorkbook(
      manager.personalDetailsFile,
      `${managerLabel} — פרטים אישיים`
    );

    if (!hasWorkbookSheets(dataWorkbook)) throw new Error("EMPTY_DATA_FILE");
    if (!hasWorkbookSheets(agreementsWorkbook)) throw new Error("EMPTY_AGREEMENTS_FILE");

    const pensionRowsRaw = runAnalysisStage(
      "parsePensionFund",
      `${managerLabel}: קריאת דוח הנתונים`,
      () => parsePensionFund(dataWorkbook)
    );

    const agreements = runAnalysisStage(
      "parseAgreements",
      `${managerLabel}: קריאת דוח ההסכמים`,
      () => parseAgreements(agreementsWorkbook)
    );

    let personalDetails = createEmptyPersonalDetails();
    const warnings = [];

    if (personalDetailsWorkbook) {
      try {
        personalDetails = parsePersonalDetails(personalDetailsWorkbook);
      } catch (error) {
        console.error("optional personal details parsing failed", { managerLabel, error });
        warnings.push(`${managerLabel}: קובץ הפרטים האישיים לא נותח בהצלחה, ולכן הניתוח ממשיך בלי העשרת פרטים אישיים.`);
        personalDetails = createEmptyPersonalDetails("personal details parser failed");
      }
    }

    if (!Array.isArray(pensionRowsRaw) || pensionRowsRaw.length === 0) {
      throw new Error("EMPTY_DATA_FILE");
    }

    if (!Array.isArray(agreements) || agreements.length === 0) {
      throw new Error("EMPTY_AGREEMENTS_FILE");
    }

    const pensionRowsRawWithManager = attachManagerToRows(pensionRowsRaw, manager);

    const unifiedPensionPersonalData = runAnalysisStage(
      "buildUnifiedPensionPersonalData",
      `${managerLabel}: איחוד דוח הנתונים עם פרטים אישיים`,
      () => buildUnifiedPensionPersonalData(pensionRowsRawWithManager, personalDetails)
    );

    if (!unifiedPensionPersonalData || !Array.isArray(unifiedPensionPersonalData.rows)) {
      throw new Error("INVALID_UNIFIED_RESULT");
    }

    const pensionRows = attachManagerToRows(unifiedPensionPersonalData.rows, manager);
    const unifiedMetadata = unifiedPensionPersonalData.metadata || {};

    const personalRows =
      personalDetails?.clientProfiles ||
      personalDetails?.rows ||
      personalDetails?.rawRows ||
      [];

    const personalDetailsMerge = {
      source: "unifiedPensionPersonalData",
      managerId: manager.id,
      managerName: managerLabel,
      hasPersonalDetailsFile: Boolean(personalDetails?.hasFile),
      joinKey: "employeeCode",
      metadata: {
        pensionRowCount: unifiedMetadata.pensionRows || pensionRows.length,
        clientProfileCount: unifiedMetadata.personalProfiles || asArray(personalRows).length,
        matchedPensionRows: unifiedMetadata.matchedPensionRows || 0,
        unmatchedPensionRows: unifiedMetadata.unmatchedPensionRows || 0,
        matchedClientProfiles: unifiedMetadata.matchedEmployees || 0,
        unmatchedClientProfiles: unifiedMetadata.personalProfilesWithoutPensionRows || 0,
        matchRate: unifiedMetadata.rowMatchRate || 0,
        matchMethods: {
          employeeCode: unifiedMetadata.matchedPensionRows || 0,
        },
      },
    };

    const pensionSummary = runAnalysisStage(
      "buildPensionSummary",
      `${managerLabel}: בניית סיכום ואנליטיקה`,
      () => buildPensionSummary(pensionRows, agreements, {
        personalRows,
        broker: {
          brokerId: manager.id,
          brokerName: managerLabel,
          batchId: manager.id,
        },
        batchId: manager.id,
      })
    );

    return {
      manager: {
        id: manager.id,
        name: managerLabel,
        files: {
          dataFile: manager.dataFile?.name || "",
          agreementsFile: manager.agreementsFile?.name || "",
          personalDetailsFile: manager.personalDetailsFile?.name || "",
        },
      },
      pensionRows,
      rawPensionRows: pensionRowsRawWithManager,
      agreements,
      personalDetails,
      personalRows,
      personalDetailsMerge,
      unifiedPensionPersonalData: {
        ...unifiedPensionPersonalData,
        rows: pensionRows,
      },
      unifiedEmployeeData: {
        ...unifiedPensionPersonalData,
        rows: pensionRows,
      },
      pensionSummary,
      warnings,
      counts: {
        dataSheets: dataWorkbook.SheetNames.length,
        agreementSheets: agreementsWorkbook.SheetNames.length,
        personalDetailsSheets: personalDetailsWorkbook?.SheetNames?.length || 0,
        rawPensionRows: pensionRowsRawWithManager.length,
        agreements: agreements.length,
        personalProfiles: asArray(personalDetails?.clientProfiles).length,
        unifiedRows: pensionRows.length,
      },
    };
  }

  async function handleStartAnalysis() {
    if (isAnalyzing) return;

    const currentManagers = normalizeManagers(files);
    const activeManagers = currentManagers.filter(
      (manager) => manager.dataFile || manager.agreementsFile || manager.personalDetailsFile
    );
    const managersToAnalyze = activeManagers.length ? activeManagers : currentManagers;
    const invalidManagers = managersToAnalyze.filter(
      (manager) => !manager.dataFile || !manager.agreementsFile
    );

    if (invalidManagers.length) {
      setAnalysisError(createUserAnalysisError(new Error("MISSING_REQUIRED_FILES")));
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisData(null);

    const diagnostics = {
      warnings: [],
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
        const result = await analyzeSingleManager(managersToAnalyze[index], index);
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
            files={{ ...files, managers }}
            setFiles={setFiles}
            onStart={handleStartAnalysis}
            isAnalyzing={isAnalyzing}
          />

          {isAnalyzing && <div className="statusBox">מנתח את הקבצים...</div>}

          {analysisError && <div className="errorBox">{analysisError}</div>}
        </>
      ) : (
        <DashboardErrorBoundary onReset={resetAnalysis}>
          <Dashboard files={files} analysisData={analysisData} />
        </DashboardErrorBoundary>
      )}
    </main>
  );
}
