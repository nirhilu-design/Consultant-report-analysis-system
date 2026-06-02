// Path: src/parsing/parseExecutiveInsuranceManagerFiles.js
// v66.1 — Executive Insurance integration layer
// Fix: self-contained parser, no imports from ../parsers/* to avoid Cloudflare build path failure.

import * as XLSX from "xlsx";

const PRODUCT_TYPE = "executiveInsurance";
const PRODUCT_LABEL = "ביטוח מנהלים";
const DATA_PARSER_VERSION = "executive_insurance_v66_1";
const AGREEMENTS_PARSER_VERSION = "executive_insurance_agreements_v77";

const HEADER_ALIASES = {
  employeeCode: ["קוד מזהה של העובד", "קוד עובד", "מספר עובד"],
  idNumber: ['ת"ז', "ת.ז", "תעודת זהות"],
  firstName: ["שם פרטי"],
  lastName: ["שם משפחה"],
  marketingStatus: ["סטטוס שיווקי"],
  agencyProgramCode: ["קוד מזהה של הסוכנות למספר תוכנית"],
  arrangementManager: ["שם מנהל הסדר", "מנהל הסדר"],
  policyId: ["קוד מזהה פוליסה"],
  policyNumber: ["מספר פוליסה"],
  issuer: ["חברת ביטוח", "יצרן", "שם יצרן"],
  insuranceStartDate: ["תחילת ביטוח", "ת.ת.ביטוח"],
  employerCompensationRate: ["אחוז פיצויים"],
  employerRewardsRate: ["אחוז תגמולי מעסיק"],
  disabilityRate: ['אחוז אכ"ע מעסיק', "אחוז אכע מעסיק"],
  employeeRewardsRate: ["אחוז תגמולי עובד"],
  totalDepositRate: ['סה"כ אחוזי הפקדה', "סה״כ אחוזי הפקדה"],
  rewardsTrackName: ["שם מסלול השקעה - תגמולים"],
  compensationTrackName: ["שם מסלול השקעה - פיצויים"],
  activeStatus: ["סטטוס פעיל / מסולק"],
  deathCoverAmount: ["סכום ביטוח למקרה מוות"],
  accumulationFeeAgreement: ["שיעור דמי ניהול מצבירה - לפי הסכם"],
  variableAccumulationFee: ["שיעור דמי ניהול משתנים מצבירה"],
  premiumFeeAmount: ["דמי ניהול מפרמיה בשקלים בפועל"],
  premiumFeePercent: ["דמי ניהול מפרמיה באחוזים"],
  totalAccumulation: ["ערך פדיון כולל", "ערך פדיון כולל ", "ערך פדיון כולל ", "צבירה"],
  agencySalary: ["שכר נתוני סוכנות"],
  clearinghouseSalary: ["שכר נתוני מסלקה"],
  isArrangementAgent: ["האם מנהל ההסדר סוכן בפוליסה"],
  policyStatus: ["סטטוס פוליסה"],
  validityMonth: ["חודש נכונות"],
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[.:]/g, "")
    .replace(/[־–—_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFeePercent(value) {
  const num = normalizeNumber(value);
  if (num === null) return null;
  if (Math.abs(num) > 20) return null;
  if (num !== 0 && Math.abs(num) < 0.1) return Number((num * 100).toFixed(4));
  return Number(num.toFixed(4));
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  return normalizeText(value) || null;
}

function getYear(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getFullYear();
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed?.y || null;
  }
  const text = normalizeText(value);
  const match = text.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function normalizeExecutiveIssuer(value) {
  return normalizeText(value)
    .replace(/בע"מ/g, "")
    .replace(/בעמ/g, "")
    .replace(/חברה לביטוח/g, "")
    .replace(/חברת ביטוח/g, "")
    .replace(/ביטוח/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) || [];
}

function buildHeaderIndex(headerRow) {
  const normalizedCells = Array.isArray(headerRow) ? headerRow.map(normalizeHeader) : [];
  const indexMap = {};

  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    const normalizedAliases = aliases.map(normalizeHeader).filter(Boolean);
    const exactIndex = normalizedCells.findIndex((cell) => normalizedAliases.includes(cell));
    if (exactIndex >= 0) {
      indexMap[field] = exactIndex;
      return;
    }

    const fuzzyIndex = normalizedCells.findIndex((cell) =>
      normalizedAliases.some((alias) => alias && cell && (cell.includes(alias) || alias.includes(cell)))
    );
    if (fuzzyIndex >= 0) indexMap[field] = fuzzyIndex;
  });

  return indexMap;
}

function detectHeaderInfo(rows) {
  const candidates = rows.slice(0, 12).map((row, index) => ({ index, map: buildHeaderIndex(row) }));
  return candidates.sort((a, b) => Object.keys(b.map).length - Object.keys(a.map).length)[0] || { index: 0, map: {} };
}

function cell(row, indexMap, key, fallbackIndex = null) {
  const idx = indexMap[key] ?? fallbackIndex;
  return idx === null || idx === undefined ? null : row?.[idx];
}

function isExcelFile(file) {
  if (!file?.name) return false;
  const lower = String(file.name).toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm");
}

async function readWorkbook(file) {
  if (!file) return null;
  if (!isExcelFile(file)) throw new Error(`קובץ לא נתמך: ${file.name || "ללא שם"}`);

  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
}

function parseExecutiveInsurance(workbook) {
  const sheetName = workbook?.SheetNames?.[0];
  if (!sheetName) {
    return {
      rows: [],
      warnings: ["לא נמצאו גיליונות בקובץ ביטוח מנהלים."],
      metadata: { parserVersion: DATA_PARSER_VERSION },
    };
  }

  const rows = readSheetRows(workbook, sheetName);
  const headerInfo = detectHeaderInfo(rows);
  const dataRows = rows.slice(headerInfo.index + 1);
  const parsedRows = [];
  const warnings = [];

  dataRows.forEach((rawRow, rowOffset) => {
    if (!Array.isArray(rawRow) || rawRow.every((value) => value === null || value === "")) return;

    const issuerOriginal = normalizeText(cell(rawRow, headerInfo.map, "issuer", 11));
    const employeeCode = normalizeText(cell(rawRow, headerInfo.map, "employeeCode", 0));
    const policyId = normalizeText(cell(rawRow, headerInfo.map, "policyId", 7));

    if (!issuerOriginal && !employeeCode && !policyId) return;

    const startDateRaw = cell(rawRow, headerInfo.map, "insuranceStartDate", 12);
    const actualPremiumFeePercent = normalizeFeePercent(cell(rawRow, headerInfo.map, "premiumFeePercent", 36));
    const actualAccumulationFeePercent =
      normalizeFeePercent(cell(rawRow, headerInfo.map, "variableAccumulationFee", 34)) ??
      normalizeFeePercent(cell(rawRow, headerInfo.map, "accumulationFeeAgreement", 33));

    parsedRows.push({
      productType: PRODUCT_TYPE,
      productLabel: PRODUCT_LABEL,
      sourceRowNumber: headerInfo.index + rowOffset + 2,
      employeeCode,
      idNumber: normalizeText(cell(rawRow, headerInfo.map, "idNumber", 1)),
      firstName: normalizeText(cell(rawRow, headerInfo.map, "firstName", 2)),
      lastName: normalizeText(cell(rawRow, headerInfo.map, "lastName", 3)),
      memberName: [cell(rawRow, headerInfo.map, "firstName", 2), cell(rawRow, headerInfo.map, "lastName", 3)]
        .map(normalizeText)
        .filter(Boolean)
        .join(" "),
      marketingStatus: normalizeText(cell(rawRow, headerInfo.map, "marketingStatus", 4)),
      arrangementManagerName: normalizeText(cell(rawRow, headerInfo.map, "arrangementManager", 6)),
      policyId,
      policyNumber: normalizeText(cell(rawRow, headerInfo.map, "policyNumber", 8)),
      issuerOriginal,
      issuer: normalizeExecutiveIssuer(issuerOriginal) || issuerOriginal,
      companyName: normalizeExecutiveIssuer(issuerOriginal) || issuerOriginal,
      insuranceStartDate: normalizeDate(startDateRaw),
      insuranceStartYear: getYear(startDateRaw),
      activeStatus: normalizeText(cell(rawRow, headerInfo.map, "activeStatus", 26)),
      policyStatus: normalizeText(cell(rawRow, headerInfo.map, "policyStatus", 41)),
      actualPremiumFeePercent,
      actualAccumulationFeePercent,
      premiumFeeAmount: normalizeNumber(cell(rawRow, headerInfo.map, "premiumFeeAmount", 35)),
      totalAccumulation: normalizeNumber(cell(rawRow, headerInfo.map, "totalAccumulation", 37)) || 0,
      accumulation: normalizeNumber(cell(rawRow, headerInfo.map, "totalAccumulation", 37)) || 0,
      deathCoverAmount: normalizeNumber(cell(rawRow, headerInfo.map, "deathCoverAmount", 27)) || 0,
      rewardsTrackName: normalizeText(cell(rawRow, headerInfo.map, "rewardsTrackName", 23)),
      compensationTrackName: normalizeText(cell(rawRow, headerInfo.map, "compensationTrackName", 25)),
      validityMonth: normalizeText(cell(rawRow, headerInfo.map, "validityMonth", 42)),
      feeStatus: "לא נבדק",
    });
  });

  if (!parsedRows.length) warnings.push("קובץ ביטוח מנהלים נטען, אך לא זוהו שורות מוצר תקינות.");

  return {
    rows: parsedRows,
    warnings,
    metadata: {
      parserVersion: DATA_PARSER_VERSION,
      sheetName,
      headerRow: headerInfo.index + 1,
      rawRowCount: dataRows.length,
      parsedRowCount: parsedRows.length,
    },
  };
}

function isNoAgreement(value) {
  const text = normalizeText(value);
  return !text || /אין\s*הסכם/.test(text);
}

function isOperatorOnlyAgreementValue(value) {
  const text = normalizeText(value);
  return (
    !text ||
    /^[-–—]+$/.test(text) ||
    /^\*+$/.test(text) ||
    /אין\s*הסכם/.test(text) ||
    /מתפעל|תפעול|ללא\s*דמי\s*ניהול/.test(text)
  );
}

function extractPercentCandidates(value) {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "number") {
    const normalized = normalizeFeePercent(value);
    return normalized === null ? [] : [normalized];
  }

  const text = normalizeText(value);
  if (!text) return [];

  const percentMatches = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((match) => Number(String(match[1]).replace(",", ".")))
    .filter((number) => Number.isFinite(number) && Math.abs(number) <= 20);

  if (percentMatches.length) return percentMatches;

  const normalized = normalizeFeePercent(text);
  return normalized === null ? [] : [normalized];
}

function parseAgreementFee(value) {
  if (isOperatorOnlyAgreementValue(value)) return null;
  const candidates = extractPercentCandidates(value);
  if (!candidates.length) return null;

  // When the agreement cell contains wording such as "1.25% יורד ל-1.06%",
  // the allowed ceiling for a compliance check is the highest explicit percent in that cell.
  // Large currency thresholds that appear without a percent sign are ignored.
  return Number(Math.max(...candidates).toFixed(4));
}

function getExecutivePeriodKeyFromYear(year) {
  const parsedYear = Number(year || 0);
  if (!parsedYear) return "unknown";
  if (parsedYear < 2004) return "before2004";
  if (parsedYear >= 2004 && parsedYear <= 2012) return "from2004To2013";
  return "from2013NoCoefficient";
}

function toAgreementPeriodKey(executivePeriodKey) {
  if (executivePeriodKey === "from2004To2013") return "legacy2004To2012";
  if (executivePeriodKey === "from2013NoCoefficient") return "from2013";
  return null;
}

function hasFeeValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function isOperatorOnlyAgreementPeriod(periodAgreement) {
  if (!periodAgreement) return false;
  return !hasFeeValue(periodAgreement.premiumFeePercent) && !hasFeeValue(periodAgreement.accumulationFeePercent);
}

function pickAgreementColumns(rows) {
  let issuerIndex = 0;
  let disabilityIndex = 5;
  const premiumByPeriod = {
    legacy2004To2012: 1,
    from2013: 3,
  };
  const accumulationByPeriod = {
    legacy2004To2012: 2,
    from2013: 4,
  };

  const headerRows = rows.slice(0, 8);

  headerRows.forEach((row) => {
    (row || []).forEach((cellValue, index) => {
      const textValue = normalizeText(cellValue);
      if (textValue.includes("חברת ביטוח")) issuerIndex = index;
      if (/אובדן|א\.כ\.ע|אכע/.test(textValue)) disabilityIndex = index;
    });
  });

  function findPeriodStart(pattern, fallbackIndex) {
    for (const row of headerRows) {
      const found = (row || []).findIndex((cellValue) => pattern.test(normalizeText(cellValue)));
      if (found >= 0) return found;
    }
    return fallbackIndex;
  }

  function findSubColumn(startIndex, keywords, fallbackIndex) {
    const candidates = [startIndex, startIndex + 1, startIndex + 2].filter((index) => index >= 0);
    for (const row of headerRows) {
      for (const index of candidates) {
        const textValue = normalizeText(row?.[index]);
        if (keywords.some((keyword) => textValue.includes(keyword))) return index;
      }
    }
    return fallbackIndex;
  }

  const legacyStart = findPeriodStart(/2004.*2012|2012.*2004/, 1);
  const from2013Start = findPeriodStart(/2013|לאחר\s*2013|החל\s*2013/, 3);

  premiumByPeriod.legacy2004To2012 = findSubColumn(legacyStart, ["הפקדה", "פרמיה"], legacyStart);
  accumulationByPeriod.legacy2004To2012 = findSubColumn(legacyStart, ["צבירה"], legacyStart + 1);
  premiumByPeriod.from2013 = findSubColumn(from2013Start, ["הפקדה", "פרמיה"], from2013Start);
  accumulationByPeriod.from2013 = findSubColumn(from2013Start, ["צבירה"], from2013Start + 1);

  return { issuerIndex, disabilityIndex, premiumByPeriod, accumulationByPeriod };
}

function parseExecutiveInsuranceAgreements(workbook) {
  const sheetName = workbook?.SheetNames?.[0];
  if (!sheetName) {
    return {
      agreements: [],
      warnings: ["לא נמצאו גיליונות בקובץ ההסכמים של ביטוח מנהלים."],
      metadata: { parserVersion: AGREEMENTS_PARSER_VERSION },
    };
  }

  const rows = readSheetRows(workbook, sheetName);
  const columns = pickAgreementColumns(rows);
  const agreements = [];

  rows.slice(2).forEach((row, index) => {
    const issuerOriginal = normalizeText(row?.[columns.issuerIndex]);
    if (!issuerOriginal || issuerOriginal.includes("חברת ביטוח")) return;

    const legacyPremiumRaw = row?.[columns.premiumByPeriod.legacy2004To2012];
    const legacyAccumulationRaw = row?.[columns.accumulationByPeriod.legacy2004To2012];
    const from2013PremiumRaw = row?.[columns.premiumByPeriod.from2013];
    const from2013AccumulationRaw = row?.[columns.accumulationByPeriod.from2013];

    const legacyPeriod = {
      premiumFeePercent: parseAgreementFee(legacyPremiumRaw),
      accumulationFeePercent: parseAgreementFee(legacyAccumulationRaw),
      rawPremiumAgreement: normalizeText(legacyPremiumRaw),
      rawAccumulationAgreement: normalizeText(legacyAccumulationRaw),
    };

    const from2013Period = {
      premiumFeePercent: parseAgreementFee(from2013PremiumRaw),
      accumulationFeePercent: parseAgreementFee(from2013AccumulationRaw),
      rawPremiumAgreement: normalizeText(from2013PremiumRaw),
      rawAccumulationAgreement: normalizeText(from2013AccumulationRaw),
    };

    agreements.push({
      productType: PRODUCT_TYPE,
      sourceRowNumber: index + 3,
      issuerOriginal,
      issuer: normalizeExecutiveIssuer(issuerOriginal) || issuerOriginal,
      disabilityCoverCostPercent: parseAgreementFee(row?.[columns.disabilityIndex]),
      periods: {
        legacy2004To2012: {
          ...legacyPeriod,
          operatorOnly: isOperatorOnlyAgreementPeriod(legacyPeriod),
        },
        from2013: {
          ...from2013Period,
          operatorOnly: isOperatorOnlyAgreementPeriod(from2013Period),
        },
      },
    });
  });

  return {
    agreements,
    warnings: agreements.length ? [] : ["קובץ הסכמים נטען, אך לא זוהו הסכמי ביטוח מנהלים."],
    metadata: {
      parserVersion: AGREEMENTS_PARSER_VERSION,
      sheetName,
      agreementCount: agreements.length,
      columns,
    },
  };
}

function resolveExecutiveInsuranceAgreement(row, agreements) {
  const issuer = normalizeExecutiveIssuer(row?.issuerOriginal || row?.issuer || row?.companyName);
  const executivePeriod = getExecutivePeriodKeyFromYear(row?.insuranceStartYear);
  const agreementPeriod = toAgreementPeriodKey(executivePeriod);

  if (!agreementPeriod) {
    return {
      issuer: null,
      executivePeriod,
      period: "",
      premiumFeePercent: null,
      accumulationFeePercent: null,
      disabilityCoverCostPercent: null,
      issueCode: executivePeriod === "unknown" ? "unknownPeriod" : "missingAgreement",
      issue: executivePeriod === "unknown" ? "לא זוהתה תקופת פוליסה" : "אין הסכם דמי ניהול לתקופת הפוליסה בדוח ההסכמים",
      agreementMatched: false,
      operatorOnly: false,
    };
  }

  const candidates = (agreements || []).filter((agreement) => {
    const agreementIssuer = normalizeExecutiveIssuer(agreement.issuerOriginal || agreement.issuer);
    return issuer && agreementIssuer && (issuer === agreementIssuer || issuer.includes(agreementIssuer) || agreementIssuer.includes(issuer));
  });

  if (!candidates.length) {
    return {
      issuer: null,
      executivePeriod,
      period: agreementPeriod,
      premiumFeePercent: null,
      accumulationFeePercent: null,
      disabilityCoverCostPercent: null,
      issueCode: "missingAgreement",
      issue: "לא נמצא הסכם מתאים לחברת הביטוח בדוח ההסכמים",
      agreementMatched: false,
      operatorOnly: false,
    };
  }

  const candidate = candidates[0];
  const periodAgreement = candidate.periods?.[agreementPeriod] || null;

  if (!periodAgreement) {
    return {
      issuer: candidate.issuer,
      executivePeriod,
      period: agreementPeriod,
      premiumFeePercent: null,
      accumulationFeePercent: null,
      disabilityCoverCostPercent: candidate.disabilityCoverCostPercent ?? null,
      issueCode: "missingAgreement",
      issue: "לא נמצא הסכם מתאים לתקופת הפוליסה בדוח ההסכמים",
      agreementMatched: true,
      operatorOnly: false,
    };
  }

  const operatorOnly = isOperatorOnlyAgreementPeriod(periodAgreement);

  return {
    issuer: candidate.issuer,
    executivePeriod,
    period: agreementPeriod,
    premiumFeePercent: periodAgreement.premiumFeePercent ?? null,
    accumulationFeePercent: periodAgreement.accumulationFeePercent ?? null,
    disabilityCoverCostPercent: candidate.disabilityCoverCostPercent ?? null,
    rawPremiumAgreement: periodAgreement.rawPremiumAgreement || "",
    rawAccumulationAgreement: periodAgreement.rawAccumulationAgreement || "",
    issueCode: operatorOnly ? "operatorOnly" : "",
    issue: operatorOnly ? "מתפעל בלבד לפי דוח ההסכמים — אין דמי ניהול לבדיקה" : "",
    agreementMatched: true,
    operatorOnly,
  };
}

function compareFee(actual, allowed) {
  if (!hasFeeValue(actual)) return false;
  if (!hasFeeValue(allowed)) return true;
  return safeNumber(actual) <= safeNumber(allowed) + 0.0001;
}

function getFeeEvaluation(row, agreement) {
  if (!agreement || !agreement.agreementMatched) {
    return {
      feeStatus: "לא ניתן לבדיקה",
      feeIssueCode: agreement?.issueCode || "missingAgreement",
      feeIssue: agreement?.issue || "לא נמצא הסכם מתאים בדוח ההסכמים",
    };
  }

  if (agreement.operatorOnly) {
    return {
      feeStatus: "מתפעל בלבד",
      feeIssueCode: "operatorOnly",
      feeIssue: "מתפעל בלבד לפי דוח ההסכמים — אין דמי ניהול לבדיקה",
      agreementType: "מתפעל בלבד",
      operatorStatus: "מתפעל בלבד",
    };
  }

  const checks = [];

  if (hasFeeValue(agreement.premiumFeePercent)) {
    if (!hasFeeValue(row.actualPremiumFeePercent)) {
      return {
        feeStatus: "לא ניתן לבדיקה",
        feeIssueCode: "missingData",
        feeIssue: "חסר דמי ניהול מפרמיה בדוח היועץ",
      };
    }
    checks.push(compareFee(row.actualPremiumFeePercent, agreement.premiumFeePercent));
  }

  if (hasFeeValue(agreement.accumulationFeePercent)) {
    if (!hasFeeValue(row.actualAccumulationFeePercent)) {
      return {
        feeStatus: "לא ניתן לבדיקה",
        feeIssueCode: "missingData",
        feeIssue: "חסר דמי ניהול מצבירה בדוח היועץ",
      };
    }
    checks.push(compareFee(row.actualAccumulationFeePercent, agreement.accumulationFeePercent));
  }

  if (!checks.length) {
    return {
      feeStatus: "מתפעל בלבד",
      feeIssueCode: "operatorOnly",
      feeIssue: "מתפעל בלבד לפי דוח ההסכמים — אין דמי ניהול לבדיקה",
      agreementType: "מתפעל בלבד",
      operatorStatus: "מתפעל בלבד",
    };
  }

  if (checks.every(Boolean)) {
    return { feeStatus: "תקין", feeIssueCode: "", feeIssue: "" };
  }

  return {
    feeStatus: "חריגה",
    feeIssueCode: "feeException",
    feeIssue: "דמי הניהול בפועל גבוהים מדוח ההסכמים",
  };
}

function buildSummary(rows, agreements) {
  const issuers = [...new Set(rows.map((row) => normalizeText(row.issuer || row.companyName)).filter(Boolean))];
  const activeRows = rows.filter((row) => !/מסולק|לא פעיל/.test(normalizeText(row.activeStatus || row.policyStatus)));
  const feeOk = rows.filter((row) => row.feeStatus === "תקין").length;
  const feeNotOk = rows.filter((row) => row.feeStatus !== "תקין").length;

  return {
    productType: PRODUCT_TYPE,
    productLabel: PRODUCT_LABEL,
    rawRowCount: rows.length,
    unifiedRowCount: rows.length,
    issuerCount: issuers.length,
    issuers,
    agreementCount: agreements.length,
    activePolicyCount: activeRows.length,
    inactivePolicyCount: Math.max(rows.length - activeRows.length, 0),
    totalAccumulation: rows.reduce((sum, row) => sum + safeNumber(row.totalAccumulation), 0),
    totalDeathCover: rows.reduce((sum, row) => sum + safeNumber(row.deathCoverAmount), 0),
    feeOk,
    feeNotOk,
    feeWarnings: feeNotOk,
    feeComplianceRate: rows.length ? Math.round((feeOk / rows.length) * 100) : 0,
  };
}

export async function parseExecutiveInsuranceManagerFiles({ dataFile, agreementsFile, manager = {} }) {
  const warnings = [];

  const dataWorkbook = await readWorkbook(dataFile);
  const agreementWorkbook = await readWorkbook(agreementsFile);

  const parsedData = parseExecutiveInsurance(dataWorkbook);
  const parsedAgreements = parseExecutiveInsuranceAgreements(agreementWorkbook);

  warnings.push(...asArray(parsedData.warnings), ...asArray(parsedAgreements.warnings));

  const agreements = asArray(parsedAgreements.agreements);
  const rows = asArray(parsedData.rows).map((row) => {
    const agreement = resolveExecutiveInsuranceAgreement(row, agreements);
    const feeEvaluation = getFeeEvaluation(row, agreement);

    return {
      ...row,
      arrangementManagerId: manager?.id || "",
      arrangementManagerName: manager?.name || row.arrangementManagerName || "מנהל הסדר",
      uploadManagerName: manager?.name || "מנהל הסדר",
      executiveInsurancePeriod: agreement?.executivePeriod || getExecutivePeriodKeyFromYear(row.insuranceStartYear),
      agreementIssuer: agreement?.issuer || "",
      matchedAgreementIssuer: agreement?.issuer || "",
      agreementPremiumFeePercent: agreement?.premiumFeePercent ?? null,
      agreementAccumulationFeePercent: agreement?.accumulationFeePercent ?? null,
      agreementPremiumRaw: agreement?.rawPremiumAgreement || "",
      agreementAccumulationRaw: agreement?.rawAccumulationAgreement || "",
      agreementPeriod: agreement?.agreementMatched ? agreement?.executivePeriod || "" : "",
      agreementPeriodInternal: agreement?.period || "",
      agreementMatched: Boolean(agreement?.agreementMatched),
      agreementType: feeEvaluation.agreementType || (agreement?.operatorOnly ? "מתפעל בלבד" : "דמי ניהול"),
      operatorStatus: feeEvaluation.operatorStatus || (agreement?.operatorOnly ? "מתפעל בלבד" : ""),
      feeStatus: feeEvaluation.feeStatus,
      feeStatusLabel: feeEvaluation.feeStatus,
      feeIssueCode: feeEvaluation.feeIssueCode,
      feeIssue: feeEvaluation.feeIssue,
    };
  });

  const summary = buildSummary(rows, agreements);

  return {
    productMode: PRODUCT_TYPE,
    productType: PRODUCT_TYPE,
    productLabel: PRODUCT_LABEL,
    manager,
    unifiedRows: rows,
    rawRows: rows,
    executiveInsuranceRows: rows,
    agreements,
    executiveInsuranceAgreements: agreements,
    summary,
    warnings,
    counts: {
      rawRows: rows.length,
      unifiedRows: rows.length,
      agreements: agreements.length,
    },
    metadata: {
      data: parsedData.metadata,
      agreements: parsedAgreements.metadata,
    },
  };
}
