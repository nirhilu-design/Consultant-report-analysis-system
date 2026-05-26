import * as XLSX from "xlsx";

const COLUMN_ALIASES = {
  employeeCode: ["קוד מזהה של העובד", "קוד עובד", "מספר עובד"],
  idNumber: ["ת\"ז", "תז", "מספר זהות", "מספר תעודת זהות"],
  firstName: ["שם פרטי"],
  lastName: ["שם משפחה"],
  employerGroupId: ["קוד מזהה קבוצת מעסיק", "קוד קבוצת מעסיק"],
  employerId: ["קוד מזהה מעסיק ספציפי", "קוד מעסיק", "מזהה מעסיק"],
  arrangementManagerName: ["שם מנהל ההסדר", "מנהל הסדר"],
  birthDate: ["תאריך לידה"],
  birthMonthYear: ["חודש ושנת לידה"],
  birthYear: ["שנת לידה"],
  calculatedAge: ["גיל מחושב", "גיל"],
  employmentStartDate: ["תאריך תחילת עבודה"],
  employmentEndDate: ["תאריך סיום עבודה"],
  section14: ["סעיף 14"],
  gender: ["מין"],
  smokingStatus: ["מעשן", "סטטוס עישון"],
  pensionSalary: ["שכר פנסיוני"],
  salaryMonth: ["חודש שכר"],
  insuredSalaryPensionFund: ["שכר מבוטח בקרן פנסיה"],
  insuredSalaryManagerInsurance: ["שכר מבוטח בביטוח מנהלים"],
  insuredSalaryProvidentFund: ["שכר מבוטח בקופ\"ג", "שכר מבוטח בקופת גמל"],
  marketingStatus: ["סטטוס שיווקי"],
  marketingStatusChangedLast3Months: ["סטטוס שיווקי השתנה ב 3 חודשים אחרונים"],
  marketingStatusDetails: ["פירוט סטטוס"],
  maritalStatus: ["מצב משפחתי"],
  childrenCount: ["מספר ילדים"],
  spouseBirthDate: ["תאריך לידה בן בת זוג", "תאריך לידה בן/בת זוג"],
  companyHasDynamicModel: ["האם בחברה יש מודל דינאמי"],
  employeeSignedDynamicModel: ["עובד חתם על מודל דינאמי"],
  validityMonth: ["חודש נכונות"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function isBlank(value) {
  return value === undefined || value === null || normalizeText(value) === "";
}

function normalizeCell(value) {
  if (value === undefined || value === null) return "";

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    return normalizeText(value);
  }

  return value;
}

function toNumber(value) {
  if (isBlank(value)) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = normalizeText(value)
    .replace(/,/g, "")
    .replace(/₪/g, "")
    .replace(/%/g, "");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  const parsed = toNumber(value);

  return parsed === null ? null : Math.round(parsed);
}

function excelSerialToDate(serial) {
  if (typeof serial !== "number" || !Number.isFinite(serial)) return null;

  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  const date = new Date(utcValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateToIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function normalizeDate(value) {
  if (isBlank(value)) return "";

  if (value instanceof Date) {
    return dateToIsoDate(value);
  }

  if (typeof value === "number") {
    const date = excelSerialToDate(value);

    if (date) return dateToIsoDate(date);

    if (value >= 1900 && value <= 2200) {
      return String(Math.round(value));
    }

    return "";
  }

  const text = normalizeText(value);

  const dayMonthYear = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dayMonthYear) {
    const [, day, month, rawYear] = dayMonthYear;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;

    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  const monthYear = text.match(/^(\d{1,2})[./-](\d{4})$/);
  if (monthYear) {
    const [, month, year] = monthYear;

    return `${year}-${pad2(month)}`;
  }

  const yearOnly = text.match(/^(19|20)\d{2}$/);
  if (yearOnly) return text;

  return text;
}

function extractYear(value) {
  if (isBlank(value)) return null;

  if (value instanceof Date) {
    return value.getFullYear();
  }

  if (typeof value === "number") {
    if (value >= 1900 && value <= 2200) return Math.round(value);

    const date = excelSerialToDate(value);
    return date ? date.getFullYear() : null;
  }

  const text = normalizeText(value);
  const match = text.match(/(19|20)\d{2}/);

  return match ? Number(match[0]) : null;
}

function toBooleanHebrew(value) {
  if (isBlank(value)) return null;

  const text = normalizeText(value);

  if (["כן", "true", "1", "y", "yes"].includes(text.toLowerCase())) return true;
  if (["לא", "false", "0", "n", "no"].includes(text.toLowerCase())) return false;

  return null;
}

function normalizeSmokingStatus(value) {
  if (isBlank(value)) {
    return {
      smokingStatus: "",
      isSmoker: null,
    };
  }

  const text = normalizeText(value);

  if (text.includes("לא") && text.includes("מעשן")) {
    return {
      smokingStatus: text,
      isSmoker: false,
    };
  }

  if (text.includes("מעשן")) {
    return {
      smokingStatus: text,
      isSmoker: true,
    };
  }

  return {
    smokingStatus: text,
    isSmoker: null,
  };
}

function getFirstSheet(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    return null;
  }

  const preferredSheetName =
    workbook.SheetNames.find((name) => normalizeText(name).includes("נתונים")) ||
    workbook.SheetNames[0];

  return workbook.Sheets[preferredSheetName] || null;
}

function sheetToObjects(sheet) {
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (!rows.length) return [];

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => String(cell ?? "").trim())
  );

  if (headerRowIndex === -1) return [];

  const headers = rows[headerRowIndex].map(normalizeHeader);

  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row, rowIndex) => {
      const record = {
        rowIndex: headerRowIndex + rowIndex + 2,
      };

      headers.forEach((header, columnIndex) => {
        if (!header) return;

        record[header] = normalizeCell(row[columnIndex]);
      });

      return record;
    });
}

function pickValue(row, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias) && !isBlank(row[alias])) {
      return row[alias];
    }
  }

  return "";
}

function buildFullName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function normalizePersonalDetailsRow(row) {
  const value = (fieldName) => pickValue(row, COLUMN_ALIASES[fieldName] || []);

  const firstName = normalizeText(value("firstName"));
  const lastName = normalizeText(value("lastName"));
  const fullName = buildFullName(firstName, lastName);

  const employeeCode = normalizeText(value("employeeCode"));
  const idNumber = normalizeText(value("idNumber"));

  const smoking = normalizeSmokingStatus(value("smokingStatus"));

  const birthDateRaw = value("birthDate");
  const birthYearRaw = value("birthYear");
  const spouseBirthDateRaw = value("spouseBirthDate");

  const birthDate = normalizeDate(birthDateRaw);
  const birthYear = extractYear(birthYearRaw) ?? extractYear(birthDateRaw);
  const spouseBirthDate = normalizeDate(spouseBirthDateRaw);
  const spouseBirthYear = extractYear(spouseBirthDateRaw);

  const profile = {
    sourceRowIndex: row.rowIndex,

    identityKey: idNumber || employeeCode || fullName || `row-${row.rowIndex}`,
    employeeCode,
    idNumber,

    firstName,
    lastName,
    fullName,

    birthDate,
    birthMonthYear: normalizeText(value("birthMonthYear")),
    birthYear,
    calculatedAge: toInteger(value("calculatedAge")),

    gender: normalizeText(value("gender")),
    maritalStatus: normalizeText(value("maritalStatus")),
    childrenCount: toInteger(value("childrenCount")),

    smokingStatus: smoking.smokingStatus,
    isSmoker: smoking.isSmoker,

    employerGroupId: normalizeText(value("employerGroupId")),
    employerId: normalizeText(value("employerId")),
    arrangementManagerName: normalizeText(value("arrangementManagerName")),

    employmentStartDate: normalizeDate(value("employmentStartDate")),
    employmentEndDate: normalizeDate(value("employmentEndDate")),
    section14: toBooleanHebrew(value("section14")),

    pensionSalary: toNumber(value("pensionSalary")),
    salaryMonth: normalizeDate(value("salaryMonth")),
    insuredSalaryPensionFund: toNumber(value("insuredSalaryPensionFund")),
    insuredSalaryManagerInsurance: toNumber(value("insuredSalaryManagerInsurance")),
    insuredSalaryProvidentFund: toNumber(value("insuredSalaryProvidentFund")),

    marketingStatus: normalizeText(value("marketingStatus")),
    marketingStatusChangedLast3Months: toBooleanHebrew(value("marketingStatusChangedLast3Months")),
    marketingStatusDetails: normalizeText(value("marketingStatusDetails")),

    spouseBirthDate,
    spouseBirthYear,

    companyHasDynamicModel: toBooleanHebrew(value("companyHasDynamicModel")),
    employeeSignedDynamicModel: toBooleanHebrew(value("employeeSignedDynamicModel")),
    validityMonth: normalizeDate(value("validityMonth")),

    employmentProfile: {
      employerGroupId: normalizeText(value("employerGroupId")),
      employerId: normalizeText(value("employerId")),
      arrangementManagerName: normalizeText(value("arrangementManagerName")),
      employmentStartDate: normalizeDate(value("employmentStartDate")),
      employmentEndDate: normalizeDate(value("employmentEndDate")),
      section14: toBooleanHebrew(value("section14")),
    },

    salaryProfile: {
      pensionSalary: toNumber(value("pensionSalary")),
      salaryMonth: normalizeDate(value("salaryMonth")),
      insuredSalaryPensionFund: toNumber(value("insuredSalaryPensionFund")),
      insuredSalaryManagerInsurance: toNumber(value("insuredSalaryManagerInsurance")),
      insuredSalaryProvidentFund: toNumber(value("insuredSalaryProvidentFund")),
    },

    familyProfile: {
      maritalStatus: normalizeText(value("maritalStatus")),
      childrenCount: toInteger(value("childrenCount")),
      spouseBirthDate,
      spouseBirthYear,
    },

    riskProfile: {
      gender: normalizeText(value("gender")),
      smokingStatus: smoking.smokingStatus,
      isSmoker: smoking.isSmoker,
    },
  };

  return profile;
}

function buildMetadata(rawRows, clientProfiles) {
  return {
    rawRowCount: rawRows.length,
    profileCount: clientProfiles.length,
    withIdNumber: clientProfiles.filter((profile) => profile.idNumber).length,
    withEmployeeCode: clientProfiles.filter((profile) => profile.employeeCode).length,
    withPensionSalary: clientProfiles.filter((profile) => profile.pensionSalary !== null).length,
  };
}

export function parsePersonalDetails(workbook) {
  if (!workbook) {
    return {
      source: "personalDetails",
      rows: [],
      rawRows: [],
      clientProfiles: [],
      count: 0,
      hasFile: false,
      metadata: {
        rawRowCount: 0,
        profileCount: 0,
        withIdNumber: 0,
        withEmployeeCode: 0,
        withPensionSalary: 0,
      },
    };
  }

  const sheet = getFirstSheet(workbook);
  const rawRows = sheetToObjects(sheet);
  const clientProfiles = rawRows.map(normalizePersonalDetailsRow);

  return {
    source: "personalDetails",
    rows: rawRows,
    rawRows,
    clientProfiles,
    count: clientProfiles.length,
    hasFile: true,
    metadata: buildMetadata(rawRows, clientProfiles),
  };
}
