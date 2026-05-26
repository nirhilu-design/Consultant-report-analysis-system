function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .replace(/[״"]/g, "")
    .replace(/[׳']/g, "")
    .toLowerCase();
}

function onlyDigits(value) {
  return normalizeText(value).replace(/\D/g, "");
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

const PENSION_ROW_ALIASES = {
  idNumber: [
    "תז",
    'ת"ז',
    "מספר זהות",
    "מספר תעודת זהות",
    "idNumber",
    "customerId",
    "memberIdNumber",
  ],

  employeeCode: [
    "קוד עובד",
    "קוד מזהה של העובד",
    "employeeCode",
    "employeeId",
    "workerCode",
  ],

  firstName: [
    "שם פרטי",
    "firstName",
    "memberFirstName",
  ],

  lastName: [
    "שם משפחה",
    "lastName",
    "memberLastName",
  ],

  fullName: [
    "שם לקוח",
    "שם מבוטח",
    "שם עמית",
    "שם מלא",
    "fullName",
    "memberName",
    "customerName",
  ],
};

function buildNameFromRow(row) {
  const firstName = normalizeText(
    getValueByAliases(row, PENSION_ROW_ALIASES.firstName)
  );

  const lastName = normalizeText(
    getValueByAliases(row, PENSION_ROW_ALIASES.lastName)
  );

  const fullName = normalizeText(
    getValueByAliases(row, PENSION_ROW_ALIASES.fullName)
  );

  return fullName || [firstName, lastName].filter(Boolean).join(" ").trim();
}

function buildProfileIndexes(clientProfiles) {
  const byIdNumber = new Map();
  const byEmployeeCode = new Map();
  const byFullName = new Map();

  for (const profile of clientProfiles || []) {
    const idNumber = onlyDigits(profile.idNumber);
    const employeeCode = normalizeComparableText(profile.employeeCode);
    const fullName = normalizeComparableText(profile.fullName);

    if (idNumber) {
      byIdNumber.set(idNumber, profile);
    }

    if (employeeCode) {
      byEmployeeCode.set(employeeCode, profile);
    }

    if (fullName) {
      byFullName.set(fullName, profile);
    }
  }

  return {
    byIdNumber,
    byEmployeeCode,
    byFullName,
  };
}

function resolveProfileForPensionRow(row, indexes) {
  const idNumber = onlyDigits(
    getValueByAliases(row, PENSION_ROW_ALIASES.idNumber)
  );

  const employeeCode = normalizeComparableText(
    getValueByAliases(row, PENSION_ROW_ALIASES.employeeCode)
  );

  const fullName = normalizeComparableText(buildNameFromRow(row));

  if (idNumber && indexes.byIdNumber.has(idNumber)) {
    return {
      profile: indexes.byIdNumber.get(idNumber),
      matchMethod: "idNumber",
      matchConfidence: "high",
    };
  }

  if (employeeCode && indexes.byEmployeeCode.has(employeeCode)) {
    return {
      profile: indexes.byEmployeeCode.get(employeeCode),
      matchMethod: "employeeCode",
      matchConfidence: "medium",
    };
  }

  if (fullName && indexes.byFullName.has(fullName)) {
    return {
      profile: indexes.byFullName.get(fullName),
      matchMethod: "fullName",
      matchConfidence: "low",
    };
  }

  return {
    profile: null,
    matchMethod: "none",
    matchConfidence: "none",
  };
}

function buildClientProfileSummary(profile) {
  if (!profile) return null;

  return {
    identityKey: profile.identityKey,
    employeeCode: profile.employeeCode,
    idNumber: profile.idNumber,

    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: profile.fullName,

    birthDate: profile.birthDate,
    birthMonthYear: profile.birthMonthYear,
    birthYear: profile.birthYear,
    calculatedAge: profile.calculatedAge,

    gender: profile.gender,
    maritalStatus: profile.maritalStatus,
    childrenCount: profile.childrenCount,

    smokingStatus: profile.smokingStatus,
    isSmoker: profile.isSmoker,

    employerGroupId: profile.employerGroupId,
    employerId: profile.employerId,
    arrangementManagerName: profile.arrangementManagerName,

    employmentStartDate: profile.employmentStartDate,
    employmentEndDate: profile.employmentEndDate,
    section14: profile.section14,

    pensionSalary: profile.pensionSalary,
    salaryMonth: profile.salaryMonth,
    insuredSalaryPensionFund: profile.insuredSalaryPensionFund,
    insuredSalaryManagerInsurance: profile.insuredSalaryManagerInsurance,
    insuredSalaryProvidentFund: profile.insuredSalaryProvidentFund,

    marketingStatus: profile.marketingStatus,
    marketingStatusChangedLast3Months: profile.marketingStatusChangedLast3Months,
    marketingStatusDetails: profile.marketingStatusDetails,

    spouseBirthDate: profile.spouseBirthDate,
    spouseBirthYear: profile.spouseBirthYear,

    companyHasDynamicModel: profile.companyHasDynamicModel,
    employeeSignedDynamicModel: profile.employeeSignedDynamicModel,
    validityMonth: profile.validityMonth,

    employmentProfile: profile.employmentProfile,
    salaryProfile: profile.salaryProfile,
    familyProfile: profile.familyProfile,
    riskProfile: profile.riskProfile,
  };
}

function enrichPensionRow(row, indexes) {
  const resolution = resolveProfileForPensionRow(row, indexes);

  return {
    ...row,

    personalProfileMatch: {
      matched: Boolean(resolution.profile),
      matchMethod: resolution.matchMethod,
      matchConfidence: resolution.matchConfidence,
      identityKey: resolution.profile?.identityKey || "",
      fullName: resolution.profile?.fullName || "",
    },

    clientProfile: buildClientProfileSummary(resolution.profile),
  };
}

function buildMergeMetadata(pensionRows, enrichedPensionRows, clientProfiles) {
  const matchedRows = enrichedPensionRows.filter(
    (row) => row.personalProfileMatch?.matched
  );

  const matchMethods = matchedRows.reduce((accumulator, row) => {
    const method = row.personalProfileMatch?.matchMethod || "unknown";

    accumulator[method] = (accumulator[method] || 0) + 1;

    return accumulator;
  }, {});

  const matchedIdentityKeys = new Set(
    matchedRows
      .map((row) => row.personalProfileMatch?.identityKey)
      .filter(Boolean)
  );

  return {
    pensionRowCount: pensionRows.length,
    clientProfileCount: clientProfiles.length,

    matchedPensionRows: matchedRows.length,
    unmatchedPensionRows: enrichedPensionRows.length - matchedRows.length,

    matchedClientProfiles: matchedIdentityKeys.size,
    unmatchedClientProfiles: Math.max(
      clientProfiles.length - matchedIdentityKeys.size,
      0
    ),

    matchRate:
      pensionRows.length > 0
        ? Number((matchedRows.length / pensionRows.length).toFixed(4))
        : 0,

    matchMethods,
  };
}

export function mergePersonalDetailsIntoPensionRows(pensionRows, personalDetails) {
  const safePensionRows = Array.isArray(pensionRows) ? pensionRows : [];

  const clientProfiles = Array.isArray(personalDetails?.clientProfiles)
    ? personalDetails.clientProfiles
    : [];

  const indexes = buildProfileIndexes(clientProfiles);

  const enrichedPensionRows = safePensionRows.map((row) =>
    enrichPensionRow(row, indexes)
  );

  return {
    pensionRows: enrichedPensionRows,
    metadata: buildMergeMetadata(
      safePensionRows,
      enrichedPensionRows,
      clientProfiles
    ),
  };
}

export function buildPersonalDetailsMerge(personalDetails, pensionRows) {
  const result = mergePersonalDetailsIntoPensionRows(
    pensionRows,
    personalDetails
  );

  return {
    source: "personalDetailsMerge",
    hasPersonalDetailsFile: Boolean(personalDetails?.hasFile),
    metadata: result.metadata,
  };
}
