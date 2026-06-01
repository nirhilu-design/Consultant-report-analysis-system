// Path: src/parsing/parseExecutiveInsuranceManagerFiles.js
// v66.1 — Executive Insurance integration layer
// Fix: self-contained parser, no imports from ../parsers/* to avoid Cloudflare build path failure.

import * as XLSX from "xlsx";

const PRODUCT_TYPE = "executiveInsurance";
const PRODUCT_LABEL = "ביטוח מנהלים";
const DATA_PARSER_VERSION = "executive_insurance_v67";
const AGREEMENTS_PARSER_VERSION = "executive_insurance_agreements_v67";

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

  const text = String(value).replace(/,/g, "").trim();
  const cleaned = text.replace(/%/g, "").replace(/[^\d.-]/g, "");
  if (cleaned) {
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }

  // Agreement cells sometimes contain text like "0.5% יורד ל 0.2%".
  // Use the first numeric fee as the conservative agreement ceiling for now.
  const firstNumber = text.match(/-?\d+(?:\.\d+)?/);
  if (!firstNumber) return null;
  const parsed = Number(firstNumber[0]);
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


function getExecutiveInsurancePeriodByYear(year) {
  const numericYear = Number(year || 0);
  if (!numericYear) return "unknown";
  if (numericYear < 2004) return "before2004";
  if (numericYear >= 2004 && numericYear < 2013) return "from2004To2013";
  return "from2013NoCoefficient";
}

const PERIOD_LABELS = {
  before2004: "לפני 2004",
  from2004To2013: "2004-2013",
  from2013NoCoefficient: "2013 והלאה ללא מקדם",
  unknown: "לא זוהתה תקופה",
};

function getExecutiveInsurancePeriodLabel(period) {
  return PERIOD_LABELS[period] || PERIOD_LABELS.unknown;
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
      executiveInsurancePeriod: getExecutiveInsurancePeriodByYear(getYear(startDateRaw)),
      executiveInsurancePeriodLabel: getExecutiveInsurancePeriodLabel(getExecutiveInsurancePeriodByYear(getYear(startDateRaw))),
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

function parseAgreementFee(value) {
  if (isNoAgreement(value)) return null;
  return normalizeFeePercent(value);
}

function pickAgreementColumns(rows) {
  const columns = {
    issuerIndex: 0,
    disabilityIndex: 1,
    premiumByPeriod: {
      before2004: null,
      from2004To2013: 2,
      from2013NoCoefficient: 6,
    },
    accumulationByPeriod: {
      before2004: null,
      from2004To2013: 3,
      from2013NoCoefficient: 7,
    },
  };

  const headerRows = rows.slice(0, 4);

  headerRows.forEach((row) => {
    (row || []).forEach((cellValue, index) => {
      const text = normalizeText(cellValue);
      if (text.includes("חברת ביטוח") || text.includes("יצרן")) columns.issuerIndex = index;
      if (text.includes("א.כ.ע") || text.includes("אכע")) columns.disabilityIndex = index;
    });
  });

  // Detect two-column period blocks. A block is usually a header cell above
  // "דמי ניהול מפרמיה" and "דמי ניהול מצבירה".
  headerRows.forEach((row, rowIndex) => {
    (row || []).forEach((cellValue, index) => {
      const text = normalizeText(cellValue);
      const nextText = normalizeText(rows?.[rowIndex + 1]?.[index]);
      const nextNextText = normalizeText(rows?.[rowIndex + 1]?.[index + 1]);
      const hasFeePair =
        (nextText.includes("פרמיה") && nextNextText.includes("צבירה")) ||
        (text.includes("פרמיה") && normalizeText(row?.[index + 1]).includes("צבירה"));

      if (!hasFeePair) return;

      if (/לפני|עד\s*2003|2003|טרום/.test(text)) {
        columns.premiumByPeriod.before2004 = index;
        columns.accumulationByPeriod.before2004 = index + 1;
      } else if (/2004|2012/.test(text)) {
        columns.premiumByPeriod.from2004To2013 = index;
        columns.accumulationByPeriod.from2004To2013 = index + 1;
      } else if (/2013/.test(text)) {
        // If the file has two 2013 blocks, use the later one for 2013+ without coefficient.
        columns.premiumByPeriod.from2013NoCoefficient = index;
        columns.accumulationByPeriod.from2013NoCoefficient = index + 1;
      }
    });
  });

  // Common uploaded format has three logical blocks but only two named headers:
  // 2004-2012 at C:D, 2013 at E:F, and another 2013 block at G:H.
  // Treat the last 2013 block as the no-coefficient period, and keep the first as fallback.
  if (columns.premiumByPeriod.from2013NoCoefficient === null && rows?.[1]?.[6] !== undefined) {
    columns.premiumByPeriod.from2013NoCoefficient = 6;
    columns.accumulationByPeriod.from2013NoCoefficient = 7;
  }

  return columns;
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

    agreements.push({
      productType: PRODUCT_TYPE,
      sourceRowNumber: index + 3,
      issuerOriginal,
      issuer: normalizeExecutiveIssuer(issuerOriginal) || issuerOriginal,
      disabilityCoverCostPercent: parseAgreementFee(row?.[columns.disabilityIndex]),
      periods: {
        before2004: {
          premiumFeePercent: parseAgreementFee(row?.[columns.premiumByPeriod.before2004]),
          accumulationFeePercent: parseAgreementFee(row?.[columns.accumulationByPeriod.before2004]),
        },
        from2004To2013: {
          premiumFeePercent: parseAgreementFee(row?.[columns.premiumByPeriod.from2004To2013]),
          accumulationFeePercent: parseAgreementFee(row?.[columns.accumulationByPeriod.from2004To2013]),
        },
        from2013NoCoefficient: {
          premiumFeePercent: parseAgreementFee(row?.[columns.premiumByPeriod.from2013NoCoefficient]),
          accumulationFeePercent: parseAgreementFee(row?.[columns.accumulationByPeriod.from2013NoCoefficient]),
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
    },
  };
}

function resolveExecutiveInsuranceAgreement(row, agreements) {
  const issuer = normalizeExecutiveIssuer(row?.issuerOriginal || row?.issuer || row?.companyName);
  const year = Number(row?.insuranceStartYear || 0);
  const candidates = (agreements || []).filter((agreement) => {
    const agreementIssuer = normalizeExecutiveIssuer(agreement.issuerOriginal || agreement.issuer);
    return issuer && agreementIssuer && (issuer === agreementIssuer || issuer.includes(agreementIssuer) || agreementIssuer.includes(issuer));
  });

  if (!candidates.length) return null;

  const period = getExecutiveInsurancePeriodByYear(year);

  const candidate = candidates[0];
  const periodAgreement = candidate.periods?.[period] || null;

  return {
    issuer: candidate.issuer,
    period,
    periodLabel: getExecutiveInsurancePeriodLabel(period),
    premiumFeePercent: periodAgreement?.premiumFeePercent ?? null,
    accumulationFeePercent: periodAgreement?.accumulationFeePercent ?? null,
    disabilityCoverCostPercent: candidate.disabilityCoverCostPercent ?? null,
  };
}

function compareFee(actual, allowed) {
  if (actual === null || actual === undefined) return false;
  if (allowed === null || allowed === undefined) return false;
  return safeNumber(actual) <= safeNumber(allowed) + 0.0001;
}

function buildFeeAudit(row, agreement) {
  if (!agreement) {
    return {
      status: "לא תקין",
      issueCode: "missingAgreement",
      issue: "לא נמצא הסכם תואם לחברת הביטוח",
    };
  }

  const hasAgreementPremium = agreement.premiumFeePercent !== null && agreement.premiumFeePercent !== undefined;
  const hasAgreementAccumulation = agreement.accumulationFeePercent !== null && agreement.accumulationFeePercent !== undefined;
  const hasActualPremium = row.actualPremiumFeePercent !== null && row.actualPremiumFeePercent !== undefined;
  const hasActualAccumulation = row.actualAccumulationFeePercent !== null && row.actualAccumulationFeePercent !== undefined;

  if (!hasAgreementPremium && !hasAgreementAccumulation) {
    return {
      status: "לא תקין",
      issueCode: "missingAgreement",
      issue: `אין הסכם דמי ניהול לתקופה: ${agreement.periodLabel || "לא ידוע"}`,
    };
  }

  if ((!hasActualPremium && hasAgreementPremium) || (!hasActualAccumulation && hasAgreementAccumulation)) {
    return {
      status: "לא תקין",
      issueCode: "missingData",
      issue: "חסר נתון דמי ניהול בפועל להשוואה",
    };
  }

  const premiumOk = hasAgreementPremium ? compareFee(row.actualPremiumFeePercent, agreement.premiumFeePercent) : true;
  const accumulationOk = hasAgreementAccumulation ? compareFee(row.actualAccumulationFeePercent, agreement.accumulationFeePercent) : true;

  if (premiumOk && accumulationOk) {
    return { status: "תקין", issueCode: "", issue: "" };
  }

  return {
    status: "לא תקין",
    issueCode: "feeMismatch",
    issue: "דמי ניהול בפועל גבוהים מההסכם",
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
    periodCounts: rows.reduce((acc, row) => {
      const period = row.executiveInsurancePeriod || "unknown";
      acc[period] = (acc[period] || 0) + 1;
      return acc;
    }, {}),
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
    const audit = buildFeeAudit(row, agreement);
    const period = agreement?.period || row.executiveInsurancePeriod || getExecutiveInsurancePeriodByYear(row.insuranceStartYear);

    return {
      ...row,
      executiveInsurancePeriod: period,
      executiveInsurancePeriodLabel: getExecutiveInsurancePeriodLabel(period),
      arrangementManagerId: manager?.id || "",
      arrangementManagerName: manager?.name || row.arrangementManagerName || "מנהל הסדר",
      uploadManagerName: manager?.name || "מנהל הסדר",
      agreementPremiumFeePercent: agreement?.premiumFeePercent ?? null,
      agreementAccumulationFeePercent: agreement?.accumulationFeePercent ?? null,
      agreementPeriod: period,
      agreementPeriodLabel: getExecutiveInsurancePeriodLabel(period),
      feeStatus: audit.status,
      feeStatusLabel: audit.status,
      feeIssueCode: audit.issueCode,
      feeIssue: audit.issue,
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
