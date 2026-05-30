// Path: src/components/EducationFundAnalysisView.jsx
// CORE HARDENING v36
// Education Fund Analysis View — קרן השתלמות
//
// Tabs:
// 1. דמי ניהול מול קובץ הסכמים
// 2. ניתוח לפי צבירה
// 3. מסלולי השקעה לפי גיל לקוח
// 4. צבירות לפי מנהלי השקעות
// 5. עובדים עם שגיאות לפי מס עובד
//
// Notes:
// - This component is presentation/analysis only.
// - It does not mutate upload/session state.
// - It expects education fund rows from analysisData.productResults.hishtalmut.
// - Personal details are optional. If birth date is unavailable, age analysis falls back gracefully.

import React, { useEffect, useMemo, useState } from "react";

const EDUCATION_TABS = [
  {
    key: "fees",
    title: "ניתוח דמי ניהול",
  },
  {
    key: "accumulation",
    title: "טבלת צבירה מסכמת",
  },
  {
    key: "tracksByAge",
    title: "מסלול השקעה מול פרטים אישיים",
  },
  {
    key: "managers",
    title: "טבלת מנהלי השקעות",
  },
  {
    key: "errors",
    title: "עובדים עם שגיאות לפי מס עובד",
  },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(number);
}

function formatNumber(value) {
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toFixed(digits)}%`;
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200E\u200F]/g, " ")
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value)
    .replace(/[₪,\s]/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}


function firstDefined(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function normalizeEducationRow(row, index = 0, source = "unknown") {
  const raw = row?.rawProductRow || row?.raw || {};

  const currentBalance = safeNumber(firstDefined(
    row?.currentBalance,
    row?.accumulation,
    row?.balance,
    row?.totalAccumulation,
    raw?.currentBalance,
    raw?.accumulation,
    raw?.balance
  ));

  const monthlyDeposit = safeNumber(firstDefined(
    row?.monthlyDeposit,
    row?.lastPremium,
    row?.premium,
    row?.deposit,
    raw?.monthlyDeposit,
    raw?.lastPremium,
    raw?.premium,
    raw?.deposit
  ));

  return {
    ...row,
    sourceFallback: source,
    rowKey: row?.rowKey || `${source}-${row?.policyNumber || row?.fundName || row?.employeeCode || index}`,
    productType: row?.productType || raw?.productType || "hishtalmut",
    productLabel: row?.productLabel || raw?.productLabel || "קרן השתלמות",

    issuer: firstDefined(row?.issuer, row?.issuerOriginal, row?.manager, raw?.issuer, raw?.issuerOriginal, raw?.manager, ""),
    issuerOriginal: firstDefined(row?.issuerOriginal, row?.issuer, row?.manager, raw?.issuerOriginal, raw?.issuer, raw?.manager, ""),
    manager: firstDefined(row?.manager, row?.issuerOriginal, row?.issuer, raw?.manager, raw?.issuerOriginal, raw?.issuer, ""),

    employeeCode: firstDefined(row?.employeeCode, raw?.employeeCode, ""),
    idNumber: firstDefined(row?.idNumber, raw?.idNumber, ""),
    memberKey: firstDefined(row?.memberKey, row?.employeeCode, row?.idNumber, raw?.employeeCode, raw?.idNumber, ""),
    clientName: firstDefined(row?.clientName, raw?.clientName, ""),

    policyNumber: firstDefined(row?.policyNumber, raw?.policyNumber, ""),
    fundName: firstDefined(row?.fundName, row?.productName, raw?.fundName, raw?.productName, ""),
    productName: firstDefined(row?.productName, row?.fundName, raw?.productName, raw?.fundName, "קרן השתלמות"),

    investmentTrack: firstDefined(row?.investmentTrack, row?.investmentTrackRewards, row?.investmentTrackCompensation, raw?.investmentTrack, raw?.investmentTrackRewards, raw?.investmentTrackCompensation, ""),
    investmentTrackRewards: firstDefined(row?.investmentTrackRewards, raw?.investmentTrackRewards, ""),
    investmentTrackCompensation: firstDefined(row?.investmentTrackCompensation, raw?.investmentTrackCompensation, ""),

    currentBalance,
    accumulation: currentBalance,
    monthlyDeposit,
    lastPremium: monthlyDeposit,

    accumulationFee: firstDefined(row?.accumulationFee, raw?.accumulationFee, null),
    accumulationFeeAgreement: firstDefined(row?.accumulationFeeAgreement, raw?.accumulationFeeAgreement, null),
    feeStatus: firstDefined(row?.feeStatus, row?.calculatedFeeStatus, raw?.feeStatus, "unknown"),
    agreementMatched: Boolean(firstDefined(row?.agreementMatched, raw?.agreementMatched, false)),

    birthDate: firstDefined(row?.birthDate, row?.dateOfBirth, row?.memberBirthDate, raw?.birthDate, raw?.dateOfBirth, raw?.memberBirthDate, null),
    rawProductRow: raw && Object.keys(raw).length ? raw : row,
  };
}

function normalizeEducationRows(rows, source) {
  return asArray(rows)
    .filter(Boolean)
    .map((row, index) => normalizeEducationRow(row, index, source));
}

function getEducationFundData(analysisData) {
  const productResults = analysisData?.productResults || {};
  const productResult =
    productResults.hishtalmut ||
    productResults.educationFund ||
    productResults[analysisData?.activeProductMode] ||
    (analysisData?.productMode === "hishtalmut" || analysisData?.productType === "hishtalmut" ? analysisData : null) ||
    {};

  const directRows = [
    ...normalizeEducationRows(productResult.unifiedRows, "productResult.unifiedRows"),
    ...normalizeEducationRows(productResult.educationFundRows, "productResult.educationFundRows"),
    ...normalizeEducationRows(analysisData?.educationFundRows, "analysisData.educationFundRows"),
  ];

  const fallbackRows = directRows.length
    ? []
    : [
        ...normalizeEducationRows(productResult.rawRows, "productResult.rawRows"),
        ...normalizeEducationRows(productResult.rowsRaw, "productResult.rowsRaw"),
        ...normalizeEducationRows(productResult.educationFundRowsRaw, "productResult.educationFundRowsRaw"),
        ...normalizeEducationRows(analysisData?.rawRows, "analysisData.rawRows"),
      ];

  const managerRows = directRows.length || fallbackRows.length
    ? []
    : asArray(productResult.managerResults).flatMap((managerResult, managerIndex) => [
        ...normalizeEducationRows(managerResult.unifiedRows, `managerResults.${managerIndex}.unifiedRows`),
        ...normalizeEducationRows(managerResult.educationFundRows, `managerResults.${managerIndex}.educationFundRows`),
        ...normalizeEducationRows(managerResult.rawRows, `managerResults.${managerIndex}.rawRows`),
        ...normalizeEducationRows(managerResult.rowsRaw, `managerResults.${managerIndex}.rowsRaw`),
        ...normalizeEducationRows(managerResult.educationFundRowsRaw, `managerResults.${managerIndex}.educationFundRowsRaw`),
      ]);

  const rows = directRows.length ? directRows : fallbackRows.length ? fallbackRows : managerRows;

  const calculatedSummary = {
    unifiedRowCount: rows.length,
    totalAccumulation: rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0),
    totalMonthlyDeposits: rows.reduce((sum, row) => sum + safeNumber(row.monthlyDeposit), 0),
    issuerCount: new Set(rows.map((row) => row.issuerOriginal || row.issuer).filter(Boolean)).size,
  };

  const summary = {
    ...(productResult.productSummary || {}),
    ...(productResult.educationFundSummary || {}),
    ...(productResult.summary || {}),
    ...(analysisData?.educationFundSummary || {}),
    ...(analysisData?.productSummary || {}),
    // Calculated summary must be last. Some combined summaries can legally miss counters
    // or keep zero values before rows are normalized, but the UI should reflect the rows
    // that are actually available to this component.
    ...calculatedSummary,
  };

  let warnings = [
    ...asArray(productResult?.diagnostics?.warnings),
    ...asArray(productResult?.warnings),
  ];

  if (rows.length) {
    warnings = warnings.filter((message) => {
      const text = normalizeText(message);
      return !(text.includes("לא זוהו שורות") || text.includes("לא נמצאו שורות"));
    });
  }

  if (!directRows.length && fallbackRows.length) {
    warnings.push("הניתוח משתמש בנתוני rawRows כגיבוי כי unifiedRows לא נמצאו בתוצאת קרן ההשתלמות.");
  }

  if (!rows.length) {
    warnings.push("לא נמצאו שורות קרן השתלמות לניתוח. יש לבדוק שהועלה קובץ נתונים למוצר קרן השתלמות ולא רק קובץ הסכמים.");
  }

  return {
    productResult,
    rows,
    summary,
    warnings: [...new Set(warnings.filter(Boolean))],
  };
}

function getArrangementManagerKey(row) {
  return (
    normalizeText(row.arrangementManagerId) ||
    normalizeText(row.managerId) ||
    normalizeText(row.uploadManagerName) ||
    normalizeText(row.arrangementManagerName) ||
    normalizeText(row.arrangementManager) ||
    "unknown_manager"
  );
}

function getArrangementManagerName(row) {
  return (
    normalizeText(row.arrangementManagerName) ||
    normalizeText(row.uploadManagerName) ||
    normalizeText(row.arrangementManager) ||
    normalizeText(row.managerName) ||
    "מנהל הסדר לא ידוע"
  );
}

function buildArrangementManagerOptions(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = getArrangementManagerKey(row);
    const name = getArrangementManagerName(row);
    const current = map.get(key) || {
      key,
      name,
      rowCount: 0,
      totalAccumulation: 0,
      totalMonthlyDeposits: 0,
      sourceFiles: new Set(),
    };

    current.rowCount += 1;
    current.totalAccumulation += safeNumber(row.currentBalance);
    current.totalMonthlyDeposits += safeNumber(row.monthlyDeposit);
    if (row.sourceFileName) current.sourceFiles.add(row.sourceFileName);
    map.set(key, current);
  });

  return Array.from(map.values())
    .map((manager) => ({
      ...manager,
      sourceFiles: Array.from(manager.sourceFiles),
    }))
    .sort((a, b) => b.totalAccumulation - a.totalAccumulation);
}

function ManagerScopeSelector({ options, selectedKey, onChange }) {
  if (options.length <= 1) {
    return null;
  }

  const totalAccumulation = options.reduce((sum, option) => sum + safeNumber(option.totalAccumulation), 0);
  const totalRows = options.reduce((sum, option) => sum + Number(option.rowCount || 0), 0);

  return (
    <section className="workspaceCard educationManagerScopeCard">
      <div>
        <h3>בחירת שכבת ניתוח</h3>
        <p className="hint">
          כברירת מחדל מוצגת אגריגציה של כל מנהלי ההסדר. ניתן לעבור למנהל הסדר בודד בלי לשנות את הטאבים או את מבנה הניתוח.
        </p>
      </div>

      <div className="educationManagerScopeTabs" dir="rtl">
        <button
          type="button"
          className={selectedKey === "all" ? "active" : ""}
          onClick={() => onChange("all")}
        >
          <strong>כל מנהלי ההסדר</strong>
          <span>{formatCurrency(totalAccumulation)} · {totalRows} שורות</span>
        </button>

        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={selectedKey === option.key ? "active" : ""}
            onClick={() => onChange(option.key)}
          >
            <strong>{option.name}</strong>
            <span>{formatCurrency(option.totalAccumulation)} · {option.rowCount} שורות</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function getEmployeeErrorKey(row) {
  return normalizeText(row.employeeCode) || normalizeText(row.idNumber) || normalizeText(row.memberKey) || normalizeText(row.clientName);
}

function getMemberKey(row) {
  return getEmployeeErrorKey(row);
}

function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date rough conversion.
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = normalizeText(value);
  if (!text) return null;

  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) return iso;

  const ddmmyyyy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = Number(ddmmyyyy[3].length === 2 ? `19${ddmmyyyy[3]}` : ddmmyyyy[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function calculateAge(value) {
  const birthDate = parseDateValue(value);
  if (!birthDate) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  if (age < 0 || age > 120) return null;
  return age;
}

function extractBirthDateFromRow(row) {
  // For education fund, age analysis must be based on the personal-details file,
  // not on the product file. Parser v33 enriches row.personalDetails by employeeCode/idNumber.
  return (
    row.personalDetails?.birthDate ||
    row.personalDetails?.birthYear ||
    row.birthDate ||
    row.dateOfBirth ||
    row.memberBirthDate ||
    null
  );
}

function getAgeBucket(age) {
  if (age === null || age === undefined) return "לא ידוע";
  if (age < 30) return "עד גיל 30";
  if (age < 40) return "30–39";
  if (age < 50) return "40–49";
  if (age < 60) return "50–59";
  return "60+";
}

function classifyTrackRisk(trackName) {
  const text = normalizeText(trackName);

  if (!text) return "לא ידוע";

  if (/מניית|מניות|s&p|s\s*and\s*p|sp500|נאסדק|nasdaq|100%|מחקה מדד|מדדי מניות/i.test(text)) {
    return "גבוה";
  }

  if (/אג"ח|אגח|שקלי|כספי|סולידי|פנסיונרים|קצר/i.test(text)) {
    return "נמוך";
  }

  if (/כללי|לבני|גילאי|50|60|מסלול כללי|ברירת מחדל/i.test(text)) {
    return "בינוני";
  }

  return "בינוני";
}

function classifyAgeDesignatedTrack(trackName) {
  const text = normalizeText(trackName);
  if (!text) {
    return { type: "unknown", label: "לא זוהה", minAge: null, maxAge: null };
  }

  if (/60\s*(ומעלה|\+|פלוס)|לבני\s*60|גילאי\s*60|בני\s*60/i.test(text)) {
    return { type: "ageDesignated", label: "מיועד לגיל 60+", minAge: 60, maxAge: null };
  }

  if (/50\s*[-–]\s*60|50\s*(עד|\/)\s*60|לבני\s*50\s*(עד|[-–])\s*60|גילאי\s*50\s*(עד|[-–])\s*60/i.test(text)) {
    return { type: "ageDesignated", label: "מיועד לגיל 50–60", minAge: 50, maxAge: 60 };
  }

  if (/(עד|מתחת|פחות מ|קטן מ)\s*50|50\s*(ומטה|ומטה)|לבני\s*50\s*(ומטה|ומטה)|גילאי\s*עד\s*50/i.test(text)) {
    return { type: "ageDesignated", label: "מיועד עד גיל 50", minAge: null, maxAge: 50 };
  }

  if (/כללי|ברירת מחדל|מסלול כללי/i.test(text)) {
    return { type: "general", label: "מסלול כללי", minAge: null, maxAge: null };
  }

  return { type: "riskOnly", label: "ללא יעד גיל מפורש", minAge: null, maxAge: null };
}

function getSuggestedRiskByAge(age) {
  if (age === null || age === undefined) return "לא ידוע";
  if (age < 50) return "עד גיל 50 / בינוני-גבוה";
  if (age < 60) return "גילאי 50–60 / בינוני";
  return "60+ / נמוך-בינוני";
}

function getAgeRuleLabel(age) {
  if (age === null || age === undefined) return "לא ידוע";
  if (age < 50) return "עד גיל 50";
  if (age < 60) return "גילאי 50–60";
  return "גיל 60+";
}

function checkTrackAgeFit(age, trackRisk, trackName = "") {
  const suggested = getSuggestedRiskByAge(age);
  const ageTrack = classifyAgeDesignatedTrack(trackName);

  if (age === null || age === undefined || !normalizeText(trackName)) {
    return {
      status: "unknown",
      label: "חסר גיל / מסלול",
      explanation: "לא ניתן לבדוק התאמת מסלול ללא גיל מקובץ פרטים אישיים או ללא שם מסלול השקעה.",
      suggested,
      ageRuleLabel: getAgeRuleLabel(age),
      ageTrackLabel: ageTrack.label,
    };
  }

  if (ageTrack.type === "ageDesignated") {
    const belowMin = ageTrack.minAge !== null && age < ageTrack.minAge;
    const aboveMax = ageTrack.maxAge !== null && age >= ageTrack.maxAge;

    if (belowMin || aboveMax) {
      return {
        status: "review",
        label: "לא תואם גיל",
        explanation: `המסלול ${ageTrack.label}, בעוד שהעובד נמצא בקבוצת ${getAgeRuleLabel(age)}. יש לבדוק העברה למסלול גיל מתאים או אישור בחירה מודעת.`,
        suggested,
        ageRuleLabel: getAgeRuleLabel(age),
        ageTrackLabel: ageTrack.label,
      };
    }

    return {
      status: "ok",
      label: "תואם גיל",
      explanation: `המסלול ${ageTrack.label} ותואם לקבוצת הגיל של העובד.`,
      suggested,
      ageRuleLabel: getAgeRuleLabel(age),
      ageTrackLabel: ageTrack.label,
    };
  }

  if (age < 50 && trackRisk === "נמוך") {
    return {
      status: "review",
      label: "סולידי לצעיר",
      explanation: "עובד מתחת לגיל 50 במסלול סולידי/כספי. לא בהכרח שגיאה, אבל דורש בדיקת התאמה לאופק השקעה ארוך.",
      suggested,
      ageRuleLabel: getAgeRuleLabel(age),
      ageTrackLabel: ageTrack.label,
    };
  }

  if (age >= 60 && trackRisk === "גבוה") {
    return {
      status: "review",
      label: "מנייתי לגיל 60+",
      explanation: "עובד בגיל 60 ומעלה במסלול בעל סיכון גבוה. יש לבדוק התאמה לאופק, סיבולת סיכון וצורך בנזילות.",
      suggested,
      ageRuleLabel: getAgeRuleLabel(age),
      ageTrackLabel: ageTrack.label,
    };
  }

  return {
    status: "ok",
    label: ageTrack.type === "general" ? "כללי / לבדיקה פרטנית" : "נראה סביר",
    explanation: ageTrack.type === "general"
      ? "מסלול כללי אינו מסלול גיל מפורש. הוא לא מסומן כחריגה, אבל מומלץ לבדוק אם קיימת מדיניות לקוח למסלול תלוי גיל."
      : "לא זוהתה חריגה ברורה בין גיל העובד לבין מאפייני המסלול.",
    suggested,
    ageRuleLabel: getAgeRuleLabel(age),
    ageTrackLabel: ageTrack.label,
  };
}

function groupBy(rows, keyFn) {
  const map = new Map();

  rows.forEach((row) => {
    const key = keyFn(row) || "לא ידוע";
    const current = map.get(key) || [];
    current.push(row);
    map.set(key, current);
  });

  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    rows: items,
  }));
}

function aggregateRows(rows, keyFn) {
  return groupBy(rows, keyFn)
    .map((group) => {
      const totalAccumulation = group.rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);
      const totalMonthlyDeposits = group.rows.reduce((sum, row) => sum + safeNumber(row.monthlyDeposit), 0);
      const averageAccumulationFee = weightedAverage(group.rows, "accumulationFee", "currentBalance");
      const agreementMatched = group.rows.filter((row) => row.agreementMatched).length;
      const feeWarnings = group.rows.filter((row) => row.feeStatus === "warning").length;

      return {
        key: group.key,
        rowCount: group.rows.length,
        totalAccumulation,
        totalMonthlyDeposits,
        averageAccumulationFee,
        agreementMatched,
        feeWarnings,
        rows: group.rows,
      };
    })
    .sort((a, b) => b.totalAccumulation - a.totalAccumulation);
}

function weightedAverage(rows, valueField, weightField) {
  let weightedSum = 0;
  let weightSum = 0;

  rows.forEach((row) => {
    const value = row[valueField];
    const weight = safeNumber(row[weightField]);

    if (value === null || value === undefined || value === "") return;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;

    weightedSum += numericValue * weight;
    weightSum += weight;
  });

  if (!weightSum) return null;
  return Number((weightedSum / weightSum).toFixed(4));
}

function average(values) {
  const numericValues = values.map(safeNumber).filter((value) => Number.isFinite(value));
  if (!numericValues.length) return 0;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function median(values) {
  const numericValues = values
    .map(safeNumber)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!numericValues.length) return 0;

  const middle = Math.floor(numericValues.length / 2);
  if (numericValues.length % 2) return numericValues[middle];
  return (numericValues[middle - 1] + numericValues[middle]) / 2;
}

function getAccumulationBucket(value) {
  const amount = safeNumber(value);

  if (amount < 50000) return "עד 50K";
  if (amount < 100000) return "50K–100K";
  if (amount < 250000) return "100K–250K";
  if (amount < 500000) return "250K–500K";
  return "500K+";
}

function buildFeeAnalysis(rows) {
  const enriched = rows.map((row) => {
    const actualFee = row.accumulationFee;
    const agreementFee = row.accumulationFeeAgreement;
    const gap =
      actualFee === null || actualFee === undefined || agreementFee === null || agreementFee === undefined
        ? null
        : Number((Number(actualFee) - Number(agreementFee)).toFixed(4));

    let status = "unknown";
    if (gap !== null) status = gap <= 0.0001 ? "ok" : "warning";
    if (row.feeStatus === "ok") status = "ok";
    if (row.feeStatus === "warning") status = "warning";

    return {
      ...row,
      calculatedFeeGap: gap,
      calculatedFeeStatus: status,
    };
  });

  const warningRows = enriched.filter((row) => row.calculatedFeeStatus === "warning");
  const okRows = enriched.filter((row) => row.calculatedFeeStatus === "ok");
  const unknownRows = enriched.filter((row) => row.calculatedFeeStatus === "unknown");

  return {
    rows: enriched,
    warningRows,
    okRows,
    unknownRows,
    okCount: okRows.length,
    warningCount: warningRows.length,
    unknownCount: unknownRows.length,
    agreementCoverage: rows.length ? Math.round(((okRows.length + warningRows.length) / rows.length) * 100) : 0,
  };
}


function isPresentNumber(value) {
  if (value === null || value === undefined || value === "") return false;
  const number = Number(value);
  return Number.isFinite(number);
}

function getFeeDisplayStatus(status) {
  if (status === "ok") return "תקין";
  if (status === "warning") return "לא תקין";
  return "חסר מידע";
}

function buildFeeCompanyChart(rows) {
  const analysis = buildFeeAnalysis(rows);
  const map = new Map();

  analysis.rows.forEach((row, index) => {
    const issuer = normalizeText(row.issuerOriginal || row.issuer || row.manager || "לא ידוע");
    const actualFeeExists = isPresentNumber(row.accumulationFee);
    const agreementFeeExists = isPresentNumber(row.accumulationFeeAgreement);
    const memberKey = getMemberKey(row) || `${row.policyNumber || row.fundName || "row"}-${index}`;

    const current = map.get(issuer) || {
      issuer,
      okMembers: new Set(),
      warningMembers: new Set(),
      unknownMembers: new Set(),
      validFeeRows: 0,
      rowCount: 0,
      totalAccumulation: 0,
    };

    current.rowCount += 1;
    current.totalAccumulation += safeNumber(row.currentBalance);

    if (actualFeeExists && agreementFeeExists) {
      current.validFeeRows += 1;
      if (row.calculatedFeeStatus === "warning") current.warningMembers.add(memberKey);
      else current.okMembers.add(memberKey);
    } else {
      current.unknownMembers.add(memberKey);
    }

    map.set(issuer, current);
  });

  return Array.from(map.values())
    .map((item) => ({
      issuer: item.issuer,
      okCount: item.okMembers.size,
      warningCount: item.warningMembers.size,
      unknownCount: item.unknownMembers.size,
      validFeeRows: item.validFeeRows,
      rowCount: item.rowCount,
      totalAccumulation: item.totalAccumulation,
    }))
    .sort((a, b) => b.warningCount - a.warningCount || b.okCount - a.okCount || b.totalAccumulation - a.totalAccumulation);
}

function buildFeeStatusMatrix(companyChart) {
  const issuers = companyChart.map((item) => item.issuer);
  const totals = companyChart.reduce(
    (acc, item) => {
      acc.ok += item.okCount;
      acc.warning += item.warningCount;
      acc.unknown += item.unknownCount;
      return acc;
    },
    { ok: 0, warning: 0, unknown: 0 }
  );

  const rows = [
    { key: "ok", label: "תקין", className: "ok", total: totals.ok, getValue: (item) => item.okCount },
    { key: "warning", label: "לא תקין", className: "warning", total: totals.warning, getValue: (item) => item.warningCount },
    { key: "unknown", label: "חסר מידע", className: "unknown", total: totals.unknown, getValue: (item) => item.unknownCount },
  ];

  return { issuers, rows };
}

function buildEducationEmployeeErrors(rows) {
  const feeAnalysis = buildFeeAnalysis(rows);
  const ageAnalysis = buildAgeTrackAnalysis(rows);
  const ageByRowKey = new Map(ageAnalysis.map((row) => [row.rowKey, row]));

  const errors = [];

  feeAnalysis.rows.forEach((row, index) => {
    const ageRow = ageByRowKey.get(row.rowKey) || row;
    const reasons = [];

    if (!getEmployeeErrorKey(row)) reasons.push("חסר מס עובד / תעודת זהות");
    if (!normalizeText(row.issuerOriginal || row.issuer || row.manager)) reasons.push("חסר שם גוף מנהל / חברת ביטוח");
    if (!safeNumber(row.currentBalance)) reasons.push("חסרה או מאופסת צבירה");
    if (!isPresentNumber(row.accumulationFee)) reasons.push("חסרים דמי ניהול בפועל");
    if (!isPresentNumber(row.accumulationFeeAgreement)) reasons.push("חסר הסכם דמי ניהול מתאים");
    if (row.calculatedFeeStatus === "warning") reasons.push("דמי הניהול בפועל גבוהים מההסכם");
    if (!row.personalDetailsMatched) reasons.push("לא נמצא עובד תואם בקובץ פרטים אישיים לפי מס עובד/תעודת זהות");
    if (ageRow.ageTrackStatus === "unknown") reasons.push("חסר גיל מקובץ פרטים אישיים / מסלול השקעה");
    if (ageRow.ageTrackStatus === "review") reasons.push("מסלול השקעה דורש בדיקת התאמה לגיל");

    if (!reasons.length) return;

    errors.push({
      ...row,
      calculatedAge: ageRow.calculatedAge,
      trackName: ageRow.trackName,
      ageTrackLabel: ageRow.ageTrackLabel,
      errorReasons: [...new Set(reasons)],
      severity: row.calculatedFeeStatus === "warning" || ageRow.ageTrackStatus === "review" ? "warning" : "unknown",
      sortValue: safeNumber(row.currentBalance),
      key: `${row.rowKey || row.policyNumber || row.fundName || "err"}-${index}`,
    });
  });

  return errors.sort((a, b) => b.sortValue - a.sortValue);
}

function buildAgeTrackAnalysis(rows) {
  return rows.map((row) => {
    const age = calculateAge(extractBirthDateFromRow(row));
    const trackName = row.investmentTrack || row.investmentTrackRewards || row.investmentTrackCompensation || "";
    const trackRisk = classifyTrackRisk(trackName);
    const fit = checkTrackAgeFit(age, trackRisk, trackName);

    return {
      ...row,
      calculatedAge: age,
      ageBucket: getAgeBucket(age),
      trackName,
      trackRisk,
      suggestedRisk: fit.suggested || getSuggestedRiskByAge(age),
      suggestedAgeRule: fit.ageRuleLabel || getAgeRuleLabel(age),
      detectedTrackAgeRule: fit.ageTrackLabel || classifyAgeDesignatedTrack(trackName).label,
      ageTrackStatus: fit.status,
      ageTrackLabel: fit.label,
      ageTrackExplanation: fit.explanation,
      personalDetailsMatched: Boolean(row.personalDetailsMatched || row.personalDetails),
    };
  });
}

function KpiCard({ label, value, hint }) {
  return (
    <article className="educationKpiCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

function EducationTabs({ activeTab, onChange }) {
  return (
    <div className="educationAnalysisTabs" dir="rtl">
      {EDUCATION_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeTab === tab.key ? "active" : ""}
          onClick={() => onChange(tab.key)}
        >
          {tab.title}
        </button>
      ))}
    </div>
  );
}

function FeesTab({ rows }) {
  const analysis = useMemo(() => buildFeeAnalysis(rows), [rows]);
  const companyChart = useMemo(() => buildFeeCompanyChart(rows), [rows]);
  const maxCount = Math.max(1, ...companyChart.flatMap((item) => [item.okCount, item.warningCount]));
  const validEmployeeCount = companyChart.reduce((sum, item) => sum + item.okCount + item.warningCount, 0);
  const companiesWithWarnings = companyChart.filter((item) => item.warningCount > 0).length;

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="עובדים תקינים" value={analysis.okCount} />
        <KpiCard label="עובדים לא תקינים" value={analysis.warningCount} />
        <KpiCard label="שורות חסרות מידע" value={analysis.unknownCount} />
        <KpiCard label="חברות עם חריגה" value={companiesWithWarnings} />
      </div>

      <section className="workspaceCard">
        <div className="sectionHeaderRow">
          <div>
            <h3>דמי ניהול לפי חברת ביטוח</h3>
            <p className="hint">
              הספירה מתבצעת לפי עובדים/עמיתים עם שורות תקינות לבדיקה: יש דמי ניהול בפועל ויש דמי ניהול לפי הסכם.
              ציר X מציג חברות ביטוח / גופים מנהלים, וציר Y מציג מספר עובדים תקינים ולא תקינים.
            </p>
          </div>
          <span className="educationStatusPill ok">{validEmployeeCount} עובדים נספרו</span>
        </div>

        {companyChart.length ? (
          <div className="educationFeeChartWrap" dir="rtl">
            <div className="educationFeeChartLegend">
              <span><i className="ok" /> תקין</span>
              <span><i className="warning" /> לא תקין</span>
            </div>

            <div className="educationFeeChart">
              {companyChart.map((item) => {
                const okHeight = Math.max(6, Math.round((item.okCount / maxCount) * 180));
                const warningHeight = Math.max(6, Math.round((item.warningCount / maxCount) * 180));

                return (
                  <article key={item.issuer} className="educationFeeChartGroup">
                    <div className="educationFeeBars" aria-label={`${item.issuer}: ${item.okCount} תקין, ${item.warningCount} לא תקין`}>
                      <div className="educationFeeBarColumn">
                        <span>{item.okCount}</span>
                        <i className="ok" style={{ height: `${okHeight}px` }} />
                      </div>
                      <div className="educationFeeBarColumn">
                        <span>{item.warningCount}</span>
                        <i className="warning" style={{ height: `${warningHeight}px` }} />
                      </div>
                    </div>
                    <strong title={item.issuer}>{item.issuer}</strong>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="hint">אין מספיק נתונים לבניית גרף דמי ניהול לפי חברות.</p>
        )}
      </section>

      <section className="workspaceCard">
        <h3>טבלה מסכמת — סטטוס בדיקה לפי חברת ביטוח</h3>
        <p className="hint">
          מבנה הטבלה עודכן: החברות מוצגות בציר האופקי, וסטטוס הבדיקה מוצג בציר האנכי. כך קל לזהות באיזה גוף מנהל יש ריכוז חריגות.
        </p>
        <div className="tableScroll">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>סטטוס</th>
                {buildFeeStatusMatrix(companyChart).issuers.map((issuer) => (
                  <th key={issuer}>{issuer}</th>
                ))}
                <th>סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {buildFeeStatusMatrix(companyChart).rows.map((statusRow) => (
                <tr key={statusRow.key}>
                  <td>
                    <span className={`educationStatusPill ${statusRow.className}`}>
                      {statusRow.label}
                    </span>
                  </td>
                  {companyChart.map((item) => (
                    <td key={`${statusRow.key}-${item.issuer}`}>{statusRow.getValue(item)}</td>
                  ))}
                  <td><strong>{statusRow.total}</strong></td>
                </tr>
              ))}
              <tr>
                <td><strong>אחוז חריגה</strong></td>
                {companyChart.map((item) => {
                  const checked = item.okCount + item.warningCount;
                  const percent = checked ? Math.round((item.warningCount / checked) * 100) : 0;
                  return <td key={`warning-rate-${item.issuer}`}>{percent}%</td>;
                })}
                <td>
                  {validEmployeeCount ? Math.round((analysis.warningCount / validEmployeeCount) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td><strong>סה״כ צבירה</strong></td>
                {companyChart.map((item) => (
                  <td key={`accumulation-${item.issuer}`}>{formatCurrency(item.totalAccumulation)}</td>
                ))}
                <td>{formatCurrency(companyChart.reduce((sum, item) => sum + safeNumber(item.totalAccumulation), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspaceCard">
        <h3>פירוט שורות דמי ניהול</h3>
        {analysis.rows.length ? (
          <div className="tableScroll">
            <table className="miniTable productRowsTable">
              <thead>
                <tr>
                  <th>עובד</th>
                  <th>חברת ביטוח</th>
                  <th>שם קופה</th>
                  <th>צבירה</th>
                  <th>בפועל</th>
                  <th>בהסכם</th>
                  <th>פער</th>
                  <th>סטטוס</th>
                </tr>
              </thead>

              <tbody>
                {analysis.rows.map((row, index) => (
                  <tr key={`${row.policyNumber || row.fundName || "fee"}-${index}`}>
                    <td>{row.clientName || row.employeeCode || row.idNumber || "-"}</td>
                    <td>{row.issuerOriginal || row.issuer || "-"}</td>
                    <td>{row.fundName || row.productName || "-"}</td>
                    <td>{formatCurrency(row.currentBalance)}</td>
                    <td>{formatPercent(row.accumulationFee)}</td>
                    <td>{formatPercent(row.accumulationFeeAgreement)}</td>
                    <td>{row.calculatedFeeGap === null ? "-" : formatPercent(row.calculatedFeeGap, 4)}</td>
                    <td>
                      <span className={`educationStatusPill ${row.calculatedFeeStatus}`}>
                        {getFeeDisplayStatus(row.calculatedFeeStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">אין נתונים לבדיקת דמי ניהול.</p>
        )}
      </section>
    </section>
  );
}


function AccumulationTab({ rows }) {
  const byBucket = useMemo(
    () =>
      aggregateRows(rows, (row) => getAccumulationBucket(row.currentBalance)).sort((a, b) => {
        const order = ["עד 50K", "50K–100K", "100K–250K", "250K–500K", "500K+"];
        return order.indexOf(a.key) - order.indexOf(b.key);
      }),
    [rows]
  );

  const byManager = useMemo(
    () => aggregateRows(rows, (row) => row.issuerOriginal || row.issuer || row.manager || "לא ידוע"),
    [rows]
  );

  const totalAccumulation = rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);
  const balances = rows.map((row) => row.currentBalance);
  const averageBalance = average(balances);
  const medianBalance = median(balances);
  const activeRows = rows.filter((row) => safeNumber(row.currentBalance) > 0);

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="סה״כ צבירה" value={formatCurrency(totalAccumulation)} />
        <KpiCard label="ממוצע לשורה" value={formatCurrency(averageBalance)} />
        <KpiCard label="חציון לשורה" value={formatCurrency(medianBalance)} />
        <KpiCard label="שורות עם צבירה" value={`${formatNumber(activeRows.length)} / ${formatNumber(rows.length)}`} />
      </div>

      <section className="workspaceCard">
        <h3>טבלה מסכמת — צבירה לפי מדרגות</h3>
        <p className="hint">
          הטבלה מסכמת את הפיזור לפי מדרגות צבירה. היא לא מציגה רשימת קופות בודדות ולכן לא אמורה להכפיל שורות בגלל ריבוי מסלולים או מוצרים לעובד.
        </p>

        <div className="educationBucketGrid">
          {byBucket.map((bucket) => {
            const percent = totalAccumulation
              ? Math.round((bucket.totalAccumulation / totalAccumulation) * 100)
              : 0;

            return (
              <article key={bucket.key} className="educationBucketCard">
                <strong>{bucket.key}</strong>
                <span>{formatCurrency(bucket.totalAccumulation)}</span>
                <small>
                  {bucket.rowCount} שורות · {percent}% מהצבירה
                </small>
                <div className="educationMiniBar">
                  <i style={{ width: `${percent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="workspaceCard">
        <h3>פירוט מדרגות צבירה</h3>
        <div className="tableScroll">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>מדרגת צבירה</th>
                <th>מספר שורות</th>
                <th>סה״כ צבירה</th>
                <th>אחוז מהתיק</th>
                <th>הפקדה / פרמיה אחרונה</th>
                <th>דמי ניהול ממוצעים</th>
              </tr>
            </thead>
            <tbody>
              {byBucket.map((bucket) => {
                const percent = totalAccumulation ? Math.round((bucket.totalAccumulation / totalAccumulation) * 100) : 0;
                return (
                  <tr key={bucket.key}>
                    <td>{bucket.key}</td>
                    <td>{bucket.rowCount}</td>
                    <td>{formatCurrency(bucket.totalAccumulation)}</td>
                    <td>{percent}%</td>
                    <td>{formatCurrency(bucket.totalMonthlyDeposits)}</td>
                    <td>{formatPercent(bucket.averageAccumulationFee)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspaceCard">
        <h3>סיכום צבירה לפי גוף מנהל</h3>
        <p className="hint">
          במקום טבלת “הקופות הגדולות ביותר” שהציגה שורות גולמיות ועלולה להיראות כמו כפילות, מוצג כאן ריכוז אגרגטיבי לפי גוף מנהל.
        </p>

        <div className="tableScroll">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>גוף מנהל</th>
                <th>מספר שורות</th>
                <th>סה״כ צבירה</th>
                <th>אחוז מהתיק</th>
                <th>צבירה ממוצעת</th>
                <th>הפקדה / פרמיה אחרונה</th>
                <th>דמי ניהול ממוצעים</th>
              </tr>
            </thead>

            <tbody>
              {byManager.map((manager) => {
                const percent = totalAccumulation
                  ? Math.round((manager.totalAccumulation / totalAccumulation) * 100)
                  : 0;
                const managerAverage = manager.rowCount ? manager.totalAccumulation / manager.rowCount : 0;

                return (
                  <tr key={manager.key}>
                    <td>{manager.key}</td>
                    <td>{manager.rowCount}</td>
                    <td>{formatCurrency(manager.totalAccumulation)}</td>
                    <td>{percent}%</td>
                    <td>{formatCurrency(managerAverage)}</td>
                    <td>{formatCurrency(manager.totalMonthlyDeposits)}</td>
                    <td>{formatPercent(manager.averageAccumulationFee)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function TracksByAgeTab({ rows }) {
  const enriched = useMemo(() => buildAgeTrackAnalysis(rows), [rows]);
  const byAge = useMemo(() => aggregateRows(enriched, (row) => row.ageBucket), [enriched]);
  const reviewRows = enriched.filter((row) => row.ageTrackStatus === "review");
  const unknownAgeRows = enriched.filter((row) => row.ageTrackStatus === "unknown");
  const matchedPersonalRows = enriched.filter((row) => row.personalDetailsMatched);
  const hasPersonalDetailsData = matchedPersonalRows.length > 0;

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="דורשים בדיקה" value={reviewRows.length} />
        <KpiCard label="חסר גיל / מסלול" value={unknownAgeRows.length} />
        <KpiCard label="מסלולים שונים" value={new Set(enriched.map((row) => row.trackName).filter(Boolean)).size} />
        <KpiCard label="שורות עם פרטים אישיים" value={`${formatNumber(matchedPersonalRows.length)} / ${formatNumber(enriched.length)}`} />
      </div>

      <section className="workspaceCard">
        <h3>התאמת מסלול השקעה לפי גיל</h3>
        <p className="hint">
          הבדיקה כאן היא אינדיקציה ייעוצית: קודם היא מזהה מסלולים תלויי גיל כמו עד 50, 50–60 ו־60+, ורק לאחר מכן בודקת רמת סיכון משוערת במסלולים שאינם תלויי גיל מפורשים.
          מקור הגיל הוא קובץ הפרטים האישיים הרוחבי; אם הוא כבר הועלה תחת קרנות הפנסיה, המערכת משתמשת בו גם כאן ואין צורך להעלות אותו שוב תחת השתלמות.
        </p>
        {!hasPersonalDetailsData && (
          <p className="hint warningText">
            לא נמצאה התאמה לפרטים אישיים בשורות ההשתלמות. אם קובץ הפרטים האישיים כבר הועלה בפנסיה, יש לוודא שהניתוח הורץ יחד עם מוצר הפנסיה ושמספר עובד/תעודת זהות זהים בין הקבצים.
          </p>
        )}

        <div className="tableScroll">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>גיל</th>
                <th>קבוצת גיל</th>
                <th>מסלול</th>
                <th>סיכון מסלול</th>
                <th>קבוצת גיל מומלצת</th>
                <th>יעד גיל מהמסלול</th>
                <th>סטטוס</th>
                <th>הסבר</th>
              </tr>
            </thead>

            <tbody>
              {enriched.map((row, index) => (
                <tr key={`${row.policyNumber || row.fundName || "age"}-${index}`}>
                  <td>{row.clientName || row.employeeCode || row.idNumber || "-"}</td>
                  <td>{row.calculatedAge ?? "-"}</td>
                  <td>{row.ageBucket}</td>
                  <td>{row.trackName || "-"}</td>
                  <td>{row.trackRisk}</td>
                  <td>{row.suggestedAgeRule || row.suggestedRisk}</td>
                  <td>{row.detectedTrackAgeRule || "-"}</td>
                  <td>
                    <span className={`educationStatusPill ${row.ageTrackStatus}`}>
                      {row.ageTrackLabel}
                    </span>
                  </td>
                  <td>{row.ageTrackExplanation || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspaceCard">
        <h3>צבירה לפי קבוצות גיל</h3>

        <div className="educationBucketGrid">
          {byAge.map((bucket) => (
            <article key={bucket.key} className="educationBucketCard">
              <strong>{bucket.key}</strong>
              <span>{formatCurrency(bucket.totalAccumulation)}</span>
              <small>{bucket.rowCount} שורות</small>
            </article>
          ))}
        </div>

        <div className="tableScroll educationTableSpacing">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>קבוצת גיל</th>
                <th>שורות</th>
                <th>סה״כ צבירה</th>
                <th>תקין / סביר</th>
                <th>דורש בדיקה</th>
                <th>חסר מידע</th>
                <th>דמי ניהול ממוצעים</th>
              </tr>
            </thead>
            <tbody>
              {byAge.map((bucket) => {
                const okCount = bucket.rows.filter((row) => row.ageTrackStatus === "ok").length;
                const reviewCount = bucket.rows.filter((row) => row.ageTrackStatus === "review").length;
                const unknownCount = bucket.rows.filter((row) => row.ageTrackStatus === "unknown").length;
                return (
                  <tr key={bucket.key}>
                    <td>{bucket.key}</td>
                    <td>{bucket.rowCount}</td>
                    <td>{formatCurrency(bucket.totalAccumulation)}</td>
                    <td>{okCount}</td>
                    <td>{reviewCount}</td>
                    <td>{unknownCount}</td>
                    <td>{formatPercent(bucket.averageAccumulationFee)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ManagersTab({ rows }) {
  const byManager = useMemo(
    () => aggregateRows(rows, (row) => row.issuerOriginal || row.issuer || row.manager || "לא ידוע"),
    [rows]
  );

  const totalAccumulation = rows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="מנהלי השקעות" value={byManager.length} />
        <KpiCard label="סה״כ צבירה" value={formatCurrency(totalAccumulation)} />
        <KpiCard label="מנהל מוביל" value={byManager[0]?.key || "-"} />
        <KpiCard
          label="ריכוזיות מנהל מוביל"
          value={totalAccumulation ? `${Math.round((safeNumber(byManager[0]?.totalAccumulation) / totalAccumulation) * 100)}%` : "0%"}
        />
      </div>

      <section className="workspaceCard">
        <h3>צבירות לפי מנהלי השקעות</h3>

        <div className="tableScroll">
          <table className="miniTable productRowsTable">
            <thead>
              <tr>
                <th>מנהל השקעות / גוף מנהל</th>
                <th>מספר קופות</th>
                <th>סה״כ צבירה</th>
                <th>אחוז מהתיק</th>
                <th>הפקדה / פרמיה אחרונה</th>
                <th>דמי ניהול ממוצעים</th>
                <th>חריגות דמי ניהול</th>
              </tr>
            </thead>

            <tbody>
              {byManager.map((manager) => {
                const percent = totalAccumulation
                  ? Math.round((manager.totalAccumulation / totalAccumulation) * 100)
                  : 0;

                return (
                  <tr key={manager.key}>
                    <td>{manager.key}</td>
                    <td>{manager.rowCount}</td>
                    <td>{formatCurrency(manager.totalAccumulation)}</td>
                    <td>{percent}%</td>
                    <td>{formatCurrency(manager.totalMonthlyDeposits)}</td>
                    <td>{formatPercent(manager.averageAccumulationFee)}</td>
                    <td>{manager.feeWarnings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspaceCard">
        <h3>פיזור מנהלים</h3>
        <div className="educationManagerBars">
          {byManager.map((manager) => {
            const percent = totalAccumulation
              ? Math.round((manager.totalAccumulation / totalAccumulation) * 100)
              : 0;

            return (
              <div key={manager.key} className="educationManagerBarRow">
                <div>
                  <strong>{manager.key}</strong>
                  <span>{formatCurrency(manager.totalAccumulation)} · {percent}%</span>
                </div>
                <div className="educationMiniBar">
                  <i style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}


function ErrorsTab({ rows }) {
  const errors = useMemo(() => buildEducationEmployeeErrors(rows), [rows]);
  const feeErrors = errors.filter((row) => row.errorReasons.some((reason) => reason.includes("דמי") || reason.includes("הסכם"))).length;
  const trackErrors = errors.filter((row) => row.errorReasons.some((reason) => reason.includes("גיל") || reason.includes("מסלול"))).length;
  const missingDataErrors = errors.filter((row) => row.severity === "unknown").length;

  return (
    <section className="educationTabPanel">
      <div className="educationKpiGrid">
        <KpiCard label="עובדים / שורות עם שגיאה" value={errors.length} />
        <KpiCard label="שגיאות דמי ניהול" value={feeErrors} />
        <KpiCard label="שגיאות מסלול / גיל" value={trackErrors} />
        <KpiCard label="חוסרי מידע" value={missingDataErrors} />
      </div>

      <section className="workspaceCard">
        <h3>רשימת עובדים עם שגיאות לפי מס עובד</h3>
        <p className="hint">
          החוצץ הזה מרכז רק עובדים/שורות שדורשים טיפול: חריגות דמי ניהול, חוסר התאמה להסכם, חסר גיל/מסלול או נתוני בסיס חסרים.
        </p>

        {errors.length ? (
          <div className="tableScroll">
            <table className="miniTable productRowsTable">
              <thead>
                <tr>
                  <th>עובד</th>
                  <th>מזהה</th>
                  <th>חברת ביטוח</th>
                  <th>קופה</th>
                  <th>מנהל הסדר</th>
                  <th>צבירה</th>
                  <th>דמי ניהול</th>
                  <th>גיל / מסלול</th>
                  <th>שגיאות</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((row) => (
                  <tr key={row.key}>
                    <td>{row.clientName || row.employeeCode || row.idNumber || "-"}</td>
                    <td>{row.employeeCode || row.idNumber || row.memberKey || "-"}</td>
                    <td>{row.issuerOriginal || row.issuer || "-"}</td>
                    <td>{row.fundName || row.productName || "-"}</td>
                    <td>{getArrangementManagerName(row)}</td>
                    <td>{formatCurrency(row.currentBalance)}</td>
                    <td>{formatPercent(row.accumulationFee)} / {formatPercent(row.accumulationFeeAgreement)}</td>
                    <td>{row.calculatedAge ?? "-"} · {row.trackName || "-"}</td>
                    <td>
                      <ul className="educationCompactReasonList">
                        {row.errorReasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </td>
                    <td>
                      <span className={`educationStatusPill ${row.severity}`}>
                        {row.severity === "warning" ? "לא תקין" : "חסר מידע"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">לא נמצאו עובדים עם שגיאות לפי מס עובד בשכבת הניתוח הנוכחית.</p>
        )}
      </section>
    </section>
  );
}

export default function EducationFundAnalysisView({ analysisData }) {
  const { rows, summary, warnings } = getEducationFundData(analysisData);
  const [activeTab, setActiveTab] = useState("fees");
  const [selectedManagerKey, setSelectedManagerKey] = useState("all");

  const managerOptions = useMemo(() => buildArrangementManagerOptions(rows), [rows]);
  const selectedRows = useMemo(() => {
    if (selectedManagerKey === "all") return rows;
    return rows.filter((row) => getArrangementManagerKey(row) === selectedManagerKey);
  }, [rows, selectedManagerKey]);

  useEffect(() => {
    if (selectedManagerKey === "all") return;
    if (!managerOptions.some((option) => option.key === selectedManagerKey)) {
      setSelectedManagerKey("all");
    }
  }, [managerOptions, selectedManagerKey]);

  const selectedManager = managerOptions.find((option) => option.key === selectedManagerKey) || null;
  const scopeLabel = selectedManagerKey === "all" ? "כל מנהלי ההסדר" : selectedManager?.name || "מנהל הסדר";
  const totalAccumulation = selectedRows.reduce((sum, row) => sum + safeNumber(row.currentBalance), 0);
  const totalMonthlyDeposits = selectedRows.reduce((sum, row) => sum + safeNumber(row.monthlyDeposit), 0);
  const issuerCount = new Set(selectedRows.map((row) => row.issuerOriginal || row.issuer).filter(Boolean)).size;

  return (
    <section className="educationFundAnalysisView" dir="rtl">
      <div className="productAnalysisHeader">
        <div>
          <p className="eyebrow">Education Fund</p>
          <h2>ניתוח קרן השתלמות</h2>
          <p>
            ניתוח לפי דמי ניהול, צבירה, התאמת מסלול השקעה לגיל, צבירות לפי מנהלי השקעות ורשימת עובדים עם שגיאות לפי מס עובד — באגריגציה כוללת או לפי מנהל הסדר.
          </p>
        </div>
      </div>

      <ManagerScopeSelector
        options={managerOptions}
        selectedKey={selectedManagerKey}
        onChange={setSelectedManagerKey}
      />

      <div className="educationTopKpiGrid">
        <KpiCard label="שכבת ניתוח" value={scopeLabel} />
        <KpiCard label="שורות שנקלטו" value={selectedRows.length || summary.unifiedRowCount || 0} />
        <KpiCard label="סה״כ צבירה" value={formatCurrency(totalAccumulation || summary.totalAccumulation)} />
        <KpiCard label="הפקדה / פרמיה אחרונה" value={formatCurrency(totalMonthlyDeposits || summary.totalMonthlyDeposits)} />
        <KpiCard label="גופים מנהלים" value={issuerCount || summary.issuerCount || 0} />
      </div>

      {warnings.length > 0 && (
        <section className="workspaceCard">
          <h3>אזהרות כלליות</h3>
          <ul className="warningList">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      {!rows.length && (
        <section className="workspaceCard">
          <h3>אין עדיין נתונים לניתוח</h3>
          <p className="hint">
            החוצצים נטענו, אבל לא נמצאו שורות קרן השתלמות בפלט הניתוח. בדרך כלל זה קורה כאשר חסר קובץ נתונים,
            כאשר הועלה רק קובץ הסכמים, או כאשר הפלט נשמר תחת שדה raw בלבד. גרסה זו כוללת גיבוי אוטומטי גם ל־rawRows.
          </p>
        </section>
      )}

      <EducationTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "fees" && <FeesTab rows={selectedRows} />}
      {activeTab === "accumulation" && <AccumulationTab rows={selectedRows} />}
      {activeTab === "tracksByAge" && <TracksByAgeTab rows={selectedRows} />}
      {activeTab === "managers" && <ManagersTab rows={selectedRows} />}
      {activeTab === "errors" && <ErrorsTab rows={selectedRows} />}
    </section>
  );
}
