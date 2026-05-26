function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeJoinCode(value) {
  const text = normalizeText(value)
    .replace(/[״"]/g, "")
    .replace(/[׳']/g, "")
    .replace(/\u00a0/g, " ")
    .trim();

  if (!text) return "";

  const numericText = text.replace(/,/g, "");

  if (/^\d+(\.0+)?$/.test(numericText)) {
    return String(Number(numericText));
  }

  return numericText.replace(/\s+/g, "").toLowerCase();
}

function getValueByAliases(row, aliases) {
  if (!row || !Array.isArray(aliases)) return "";

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      const value = row[alias];

      if (value !== undefined && value !== null && normalizeText(value) !== "") {
        return value;
      }
    }
  }

  return "";
}

const EMPLOYEE_CODE_ALIASES = [
  "קוד מזהה של העובד",
  "קוד מזהה עובד",
  "קוד מזהה לקוח",
  "קוד לקוח",
  "קוד עובד",
  "מספר עובד",
  "clientId",
  "clientID",
  "clientCode",
  "customerId",
  "customerID",
  "customerCode",
  "memberId",
  "memberID",
  "memberCode",
  "employeeCode",
  "employeeId",
  "employeeID",
  "workerCode",
  "memberEmployeeCode",
];

const PERSONAL_PREFIX = "personal_";

function getEmployeeCode(row) {
  return getValueByAliases(row, EMPLOYEE_CODE_ALIASES);
}

function getEmployeeJoinKey(row) {
  return normalizeJoinCode(getEmployeeCode(row));
}

function buildPersonalIndex(clientProfiles) {
  const byEmployeeCode = new Map();
  const duplicates = [];
  const withoutCode = [];

  for (const profile of clientProfiles || []) {
    const key = normalizeJoinCode(profile.employeeCode);

    if (!key) {
      withoutCode.push(profile);
      continue;
    }

    if (byEmployeeCode.has(key)) {
      duplicates.push(key);
    }

    byEmployeeCode.set(key, profile);
  }

  return {
    byEmployeeCode,
    duplicates: [...new Set(duplicates)],
    withoutCode,
  };
}

function prefixPersonalFields(profile) {
  if (!profile) return {};

  return {
    [`${PERSONAL_PREFIX}employeeCode`]: profile.employeeCode || "",
    [`${PERSONAL_PREFIX}idNumber`]: profile.idNumber || "",
    [`${PERSONAL_PREFIX}firstName`]: profile.firstName || "",
    [`${PERSONAL_PREFIX}lastName`]: profile.lastName || "",
    [`${PERSONAL_PREFIX}fullName`]: profile.fullName || "",
    [`${PERSONAL_PREFIX}birthDate`]: profile.birthDate || "",
    [`${PERSONAL_PREFIX}birthYear`]: profile.birthYear ?? "",
    [`${PERSONAL_PREFIX}calculatedAge`]: profile.calculatedAge ?? "",
    [`${PERSONAL_PREFIX}gender`]: profile.gender || "",
    [`${PERSONAL_PREFIX}maritalStatus`]: profile.maritalStatus || "",
    [`${PERSONAL_PREFIX}childrenCount`]: profile.childrenCount ?? "",
    [`${PERSONAL_PREFIX}smokingStatus`]: profile.smokingStatus || "",
    [`${PERSONAL_PREFIX}isSmoker`]: profile.isSmoker ?? "",
    [`${PERSONAL_PREFIX}pensionSalary`]: profile.pensionSalary ?? "",
    [`${PERSONAL_PREFIX}salaryMonth`]: profile.salaryMonth || "",
    [`${PERSONAL_PREFIX}insuredSalaryPensionFund`]: profile.insuredSalaryPensionFund ?? "",
    [`${PERSONAL_PREFIX}insuredSalaryManagerInsurance`]: profile.insuredSalaryManagerInsurance ?? "",
    [`${PERSONAL_PREFIX}insuredSalaryProvidentFund`]: profile.insuredSalaryProvidentFund ?? "",
    [`${PERSONAL_PREFIX}employmentStartDate`]: profile.employmentStartDate || "",
    [`${PERSONAL_PREFIX}employmentEndDate`]: profile.employmentEndDate || "",
    [`${PERSONAL_PREFIX}section14`]: profile.section14 ?? "",
    [`${PERSONAL_PREFIX}arrangementManagerName`]: profile.arrangementManagerName || "",
    [`${PERSONAL_PREFIX}marketingStatus`]: profile.marketingStatus || "",
    [`${PERSONAL_PREFIX}marketingStatusDetails`]: profile.marketingStatusDetails || "",
    [`${PERSONAL_PREFIX}spouseBirthDate`]: profile.spouseBirthDate || "",
    [`${PERSONAL_PREFIX}spouseBirthYear`]: profile.spouseBirthYear ?? "",
    [`${PERSONAL_PREFIX}companyHasDynamicModel`]: profile.companyHasDynamicModel ?? "",
    [`${PERSONAL_PREFIX}employeeSignedDynamicModel`]: profile.employeeSignedDynamicModel ?? "",
    [`${PERSONAL_PREFIX}validityMonth`]: profile.validityMonth || "",
  };
}

function groupRowsByEmployee(joinedRows) {
  const byEmployee = new Map();

  for (const row of joinedRows) {
    const key = row.employeeJoinKey;

    if (!key) continue;

    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeCode: row.employeeCode,
        employeeJoinKey: key,
        personal: row.clientProfile || null,
        pensionRows: [],
      });
    }

    byEmployee.get(key).pensionRows.push(row);
  }

  return [...byEmployee.values()].map((employee) => ({
    ...employee,
    pensionRowCount: employee.pensionRows.length,
    matchedPersonalProfile: Boolean(employee.personal),
  }));
}

function buildMetadata({
  pensionRows,
  clientProfiles,
  joinedRows,
  personalIndex,
}) {
  const pensionKeys = new Set(
    pensionRows
      .map(getEmployeeJoinKey)
      .filter(Boolean)
  );

  const personalKeys = new Set(
    clientProfiles
      .map((profile) => normalizeJoinCode(profile.employeeCode))
      .filter(Boolean)
  );

  const matchedRows = joinedRows.filter((row) => row.personalJoinMatched);
  const matchedEmployees = new Set(
    matchedRows.map((row) => row.employeeJoinKey).filter(Boolean)
  );

  const pensionWithoutPersonal = [...pensionKeys].filter(
    (key) => !personalKeys.has(key)
  );

  const personalWithoutPension = [...personalKeys].filter(
    (key) => !pensionKeys.has(key)
  );

  return {
    joinKey: "קוד מזהה של העובד / קוד מזהה לקוח",
    pensionRows: pensionRows.length,
    personalProfiles: clientProfiles.length,

    pensionEmployeeCodes: pensionKeys.size,
    personalEmployeeCodes: personalKeys.size,

    matchedPensionRows: matchedRows.length,
    unmatchedPensionRows: joinedRows.length - matchedRows.length,

    matchedEmployees: matchedEmployees.size,
    unmatchedPensionEmployeeCodes: pensionWithoutPersonal.length,
    personalProfilesWithoutPensionRows: personalWithoutPension.length,

    personalDuplicateEmployeeCodes: personalIndex.duplicates.length,
    personalProfilesWithoutEmployeeCode: personalIndex.withoutCode.length,

    rowMatchRate:
      joinedRows.length > 0
        ? Number((matchedRows.length / joinedRows.length).toFixed(4))
        : 0,

    employeeMatchRate:
      pensionKeys.size > 0
        ? Number((matchedEmployees.size / pensionKeys.size).toFixed(4))
        : 0,

    pensionWithoutPersonalEmployeeCodes: pensionWithoutPersonal,
    personalWithoutPensionEmployeeCodes: personalWithoutPension,
  };
}

export function buildUnifiedPensionPersonalData(pensionRows, personalDetails) {
  const safePensionRows = Array.isArray(pensionRows) ? pensionRows : [];

  const clientProfiles = Array.isArray(personalDetails?.clientProfiles)
    ? personalDetails.clientProfiles
    : [];

  const personalIndex = buildPersonalIndex(clientProfiles);

  const joinedRows = safePensionRows.map((pensionRow, index) => {
    const rawCode = getEmployeeCode(pensionRow);
    const joinKey = normalizeJoinCode(rawCode);
    const clientProfile = joinKey
      ? personalIndex.byEmployeeCode.get(joinKey) || null
      : null;

    return {
      ...pensionRow,

      employeeCode: rawCode,
      employeeJoinKey: joinKey,
      personalJoinMatched: Boolean(clientProfile),
      personalJoinMethod: clientProfile ? "employeeCode" : "none",

      clientProfile,
      ...prefixPersonalFields(clientProfile),

      sourceRowIndex: pensionRow.sourceRowIndex || pensionRow.rowIndex || index + 2,
    };
  });

  const employees = groupRowsByEmployee(joinedRows);

  return {
    source: "unifiedPensionPersonalData",
    joinKey: "employeeCode",
    rows: joinedRows,
    employees,
    metadata: buildMetadata({
      pensionRows: safePensionRows,
      clientProfiles,
      joinedRows,
      personalIndex,
    }),
  };
}
