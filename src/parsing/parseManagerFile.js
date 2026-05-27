import * as XLSX from "xlsx";

import { parsePensionFund } from "../parsers/pensionFundParser.js";
import { parseAgreements } from "../parsers/agreementsParser.js";
import { parsePersonalDetails } from "../parsers/personalDetailsParser.js";
import { buildPensionSummary } from "../parsers/buildPensionSummary.js";
import { buildUnifiedPensionPersonalData } from "../parsers/unifiedPensionPersonalDataBuilder.js";
import { buildPensionAnalytics } from "../unified/analyticsEngine.js";
import { buildDataQuality } from "../unified/dataQualityEngine.js";
import {
  asArray,
  buildParsingConfidence,
  createEmptyPersonalDetails,
  runParsingStage,
} from "./parsingConfidence.js";
import { attachManagerToRows, ensureRowsArray, hasAnyAgreement } from "./safeRowBuilder.js";

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

export function createUserAnalysisError(error) {
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

export function buildCombinedPensionSummary(managerResults = []) {
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

export async function parseManagerFiles(manager, index = 0) {
  const managerLabel = manager.name || `מנהל הסדר ${index + 1}`;

  const dataWorkbook = await readWorkbook(manager.dataFile, `${managerLabel} — דוח נתונים`);
  const agreementsWorkbook = await readWorkbook(manager.agreementsFile, `${managerLabel} — דוח הסכמים`);
  const personalDetailsWorkbook = await readWorkbook(
    manager.personalDetailsFile,
    `${managerLabel} — פרטים אישיים`
  );

  if (!hasWorkbookSheets(dataWorkbook)) throw new Error("EMPTY_DATA_FILE");
  if (!hasWorkbookSheets(agreementsWorkbook)) throw new Error("EMPTY_AGREEMENTS_FILE");

  const pensionRowsRaw = runParsingStage(
    "parsePensionFund",
    `${managerLabel}: קריאת דוח הנתונים`,
    () => parsePensionFund(dataWorkbook)
  );

  const agreements = runParsingStage(
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

  const validPensionRowsRaw = ensureRowsArray(pensionRowsRaw, "EMPTY_DATA_FILE");
  const validAgreements = ensureRowsArray(agreements, "EMPTY_AGREEMENTS_FILE");
  const pensionRowsRawWithManager = attachManagerToRows(validPensionRowsRaw, manager);

  const unifiedPensionPersonalData = runParsingStage(
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

  const pensionSummary = runParsingStage(
    "buildPensionSummary",
    `${managerLabel}: בניית סיכום ואנליטיקה`,
    () => buildPensionSummary(pensionRows, validAgreements, {
      personalRows,
      broker: {
        brokerId: manager.id,
        brokerName: managerLabel,
        batchId: manager.id,
      },
      batchId: manager.id,
    })
  );

  const parsingConfidence = buildParsingConfidence({
    dataWorkbook,
    agreementsWorkbook,
    personalDetailsWorkbook,
    pensionRowsRaw: pensionRowsRawWithManager,
    agreements: validAgreements,
    personalDetails,
    unifiedRows: pensionRows,
    warnings,
  });

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
    agreements: validAgreements,
    personalDetails,
    personalRows,
    personalDetailsMerge,
    parsingConfidence,
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
      agreements: validAgreements.length,
      personalProfiles: asArray(personalDetails?.clientProfiles).length,
      unifiedRows: pensionRows.length,
    },
  };
}

export { asArray, createEmptyPersonalDetails } from "./parsingConfidence.js";
