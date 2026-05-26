function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeComparable(value) {
  return normalizeText(value)
    .replace(/[״"]/g, "")
    .replace(/[׳']/g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
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

function findValueByKeyContains(row, keywords) {
  if (!row || !Array.isArray(keywords)) return "";

  const entries = Object.entries(row);

  for (const [key, value] of entries) {
    if (value === undefined || value === null || normalizeText(value) === "") {
      continue;
    }

    const normalizedKey = normalizeComparable(key);

    const hasAllKeywords = keywords.every((keyword) =>
      normalizedKey.includes(normalizeComparable(keyword))
    );

    if (hasAllKeywords) {
      return value;
    }
  }

  return "";
}

const PENSION_EMPLOYEE_CODE_ALIASES = [
  "קוד מזהה של העובד",
  "קוד מזהה עובד",
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

const PENSION_NAME_ALIASES = [
  "שם לקוח",
  "שם מבוטח",
  "שם עמית",
  "שם מלא",
  "fullName",
  "memberName",
  "customerName",
  "clientName",
];

const PENSION_ISSUER_ALIASES = [
  "יצרן",
  "שם יצרן",
  "גוף מוסדי",
  "גוף מנהל",
  "issuer",
  "issuerOriginal",
  "issuerCanonical",
];

const PENSION_PRODUCT_ALIASES = [
  "מוצר",
  "סוג מוצר",
  "product",
  "productType",
  "productName",
];

const PENSION_POLICY_ALIASES = [
  "מספר פוליסה",
  "מספר חשבון",
  "policyNumber",
  "accountNumber",
  "mofid",
];

const PENSION_ACCUMULATION_ALIASES = [
  "צבירה",
  "יתרה",
  "סך צבירה",
  "accumulation",
  "balance",
  "totalAccumulation",
];

const PENSION_DEPOSIT_ALIASES = [
  "הפקדה",
  "הפקדה חודשית",
  "monthlyDeposit",
  "deposit",
];

function getPensionEmployeeCodeRaw(row) {
  const directValue = getValueByAliases(row, PENSION_EMPLOYEE_CODE_ALIASES);
  if (directValue) return directValue;

  const hebrewCodeValue =
    findValueByKeyContains(row, ["קוד", "עובד"]) ||
    findValueByKeyContains(row, ["מזהה", "עובד"]) ||
    findValueByKeyContains(row, ["קוד", "מזהה"]);

  if (hebrewCodeValue) return hebrewCodeValue;

  const englishCodeValue =
    findValueByKeyContains(row, ["employee", "code"]) ||
    findValueByKeyContains(row, ["employee", "id"]) ||
    findValueByKeyContains(row, ["client", "id"]) ||
    findValueByKeyContains(row, ["client", "code"]) ||
    findValueByKeyContains(row, ["member", "id"]) ||
    findValueByKeyContains(row, ["member", "code"]);

  return englishCodeValue || "";
}

function getPensionEmployeeCode(row) {
  return normalizeComparable(getPensionEmployeeCodeRaw(row));
}

function getProfileEmployeeCode(profile) {
  return normalizeComparable(profile?.employeeCode);
}

function toNumber(value) {
  if (value === undefined || value === null || normalizeText(value) === "") {
    return 0;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(
    normalizeText(value)
      .replace(/,/g, "")
      .replace(/₪/g, "")
      .replace(/%/g, "")
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizePensionRow(row) {
  return {
    auditRowId: row.auditRowId || row.rowId || row.id || "",
    employeeCode: getPensionEmployeeCodeRaw(row),
    clientName: getValueByAliases(row, PENSION_NAME_ALIASES),
    issuer:
      row.issuerCanonical ||
      row.issuerOriginal ||
      getValueByAliases(row, PENSION_ISSUER_ALIASES),
    productType:
      row.productType ||
      row.productName ||
      getValueByAliases(row, PENSION_PRODUCT_ALIASES),
    policyNumber:
      row.policyNumber ||
      row.accountNumber ||
      row.mofid ||
      getValueByAliases(row, PENSION_POLICY_ALIASES),
    accumulation:
      row.accumulation ??
      row.balance ??
      toNumber(getValueByAliases(row, PENSION_ACCUMULATION_ALIASES)),
    monthlyDeposit:
      row.monthlyDeposit ??
      row.deposit ??
      toNumber(getValueByAliases(row, PENSION_DEPOSIT_ALIASES)),
    auditStatus:
      row.auditDisplayStatus ||
      row.auditStatusHe ||
      row.auditStatus ||
      "",
    auditReason: row.auditReason || "",
    raw: row,
  };
}

function buildPersonalProfileIndexes(clientProfiles) {
  const byEmployeeCode = new Map();
  const profilesWithoutEmployeeCode = [];

  for (const profile of clientProfiles || []) {
    const employeeCode = getProfileEmployeeCode(profile);

    if (!employeeCode) {
      profilesWithoutEmployeeCode.push(profile);
      continue;
    }

    if (!byEmployeeCode.has(employeeCode)) {
      byEmployeeCode.set(employeeCode, []);
    }

    byEmployeeCode.get(employeeCode).push(profile);
  }

  return {
    byEmployeeCode,
    profilesWithoutEmployeeCode,
  };
}

function buildPensionRowsByEmployeeCode(pensionRows) {
  const byEmployeeCode = new Map();
  const rowsWithoutEmployeeCode = [];

  for (const row of pensionRows || []) {
    const employeeCode = getPensionEmployeeCode(row);

    if (!employeeCode) {
      rowsWithoutEmployeeCode.push(row);
      continue;
    }

    if (!byEmployeeCode.has(employeeCode)) {
      byEmployeeCode.set(employeeCode, []);
    }

    byEmployeeCode.get(employeeCode).push(row);
  }

  return {
    byEmployeeCode,
    rowsWithoutEmployeeCode,
  };
}

function choosePersonalProfile(profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) return null;

  return profiles[0];
}

function buildEmployeeTotals(pensionRows) {
  const summarizedProducts = pensionRows.map(summarizePensionRow);

  return {
    productCount: summarizedProducts.length,
    totalAccumulation: summarizedProducts.reduce(
      (sum, product) => sum + toNumber(product.accumulation),
      0
    ),
    totalMonthlyDeposit: summarizedProducts.reduce(
      (sum, product) => sum + toNumber(product.monthlyDeposit),
      0
    ),
    products: summarizedProducts,
  };
}

function buildUnifiedEmployeeRow(employeeCode, pensionRows, profiles) {
  const personalProfile = choosePersonalProfile(profiles);
  const totals = buildEmployeeTotals(pensionRows);
  const pensionEmployeeCodeRaw = getPensionEmployeeCodeRaw(pensionRows[0]);

  return {
    employeeCode,
    employeeCodeRaw: pensionEmployeeCodeRaw,

    match: {
      matchedPersonalProfile: Boolean(personalProfile),
      personalProfileCount: Array.isArray(profiles) ? profiles.length : 0,
      pensionRowCount: pensionRows.length,
      matchMethod: personalProfile ? "employeeCode" : "none",
      matchConfidence: personalProfile ? "high" : "none",
    },

    personal: personalProfile || null,

    identity: {
      employeeCode,
      employeeCodeRaw: pensionEmployeeCodeRaw,
      idNumber: personalProfile?.idNumber || "",
      firstName: personalProfile?.firstName || "",
      lastName: personalProfile?.lastName || "",
      fullName:
        personalProfile?.fullName ||
        getValueByAliases(pensionRows[0], PENSION_NAME_ALIASES) ||
        "",
    },

    family: personalProfile?.familyProfile || {
      maritalStatus: personalProfile?.maritalStatus || "",
      childrenCount: personalProfile?.childrenCount ?? null,
      spouseBirthDate: personalProfile?.spouseBirthDate || "",
      spouseBirthYear: personalProfile?.spouseBirthYear ?? null,
    },

    salary: personalProfile?.salaryProfile || {
      pensionSalary: personalProfile?.pensionSalary ?? null,
      salaryMonth: personalProfile?.salaryMonth || "",
      insuredSalaryPensionFund: personalProfile?.insuredSalaryPensionFund ?? null,
      insuredSalaryManagerInsurance:
        personalProfile?.insuredSalaryManagerInsurance ?? null,
      insuredSalaryProvidentFund:
        personalProfile?.insuredSalaryProvidentFund ?? null,
    },

    employment: personalProfile?.employmentProfile || {
      employerGroupId: personalProfile?.employerGroupId || "",
      employerId: personalProfile?.employerId || "",
      arrangementManagerName: personalProfile?.arrangementManagerName || "",
      employmentStartDate: personalProfile?.employmentStartDate || "",
      employmentEndDate: personalProfile?.employmentEndDate || "",
      section14: personalProfile?.section14 ?? null,
    },

    risk: personalProfile?.riskProfile || {
      gender: personalProfile?.gender || "",
      smokingStatus: personalProfile?.smokingStatus || "",
      isSmoker: personalProfile?.isSmoker ?? null,
    },

    pension: {
      productCount: totals.productCount,
      totalAccumulation: totals.totalAccumulation,
      totalMonthlyDeposit: totals.totalMonthlyDeposit,
      products: totals.products,
    },

    rawPensionRows: pensionRows,
  };
}

function buildDebugSamples({
  personalProfilesByEmployeeCode,
  pensionRowsByEmployeeCode,
  rowsWithoutEmployeeCode,
  profilesWithoutEmployeeCode,
}) {
  return {
    pensionEmployeeCodeSamples: [...pensionRowsByEmployeeCode.keys()].slice(0, 10),
    personalEmployeeCodeSamples: [...personalProfilesByEmployeeCode.keys()].slice(0, 10),
    pensionRowsWithoutEmployeeCodeSamples: rowsWithoutEmployeeCode.slice(0, 3),
    profilesWithoutEmployeeCodeSamples: profilesWithoutEmployeeCode.slice(0, 3),
  };
}

function buildMetadata({
  unifiedEmployees,
  personalProfilesByEmployeeCode,
  pensionRowsByEmployeeCode,
  rowsWithoutEmployeeCode,
  profilesWithoutEmployeeCode,
}) {
  const employeesWithPersonalProfile = unifiedEmployees.filter(
    (employee) => employee.match.matchedPersonalProfile
  );

  const pensionEmployeeCodes = new Set(pensionRowsByEmployeeCode.keys());
  const personalEmployeeCodes = new Set(personalProfilesByEmployeeCode.keys());

  const personalWithoutPensionRows = [...personalEmployeeCodes].filter(
    (employeeCode) => !pensionEmployeeCodes.has(employeeCode)
  );

  const pensionWithoutPersonalProfile = [...pensionEmployeeCodes].filter(
    (employeeCode) => !personalEmployeeCodes.has(employeeCode)
  );

  return {
    employeeCount: unifiedEmployees.length,
    employeesWithPersonalProfile: employeesWithPersonalProfile.length,
    employeesWithoutPersonalProfile:
      unifiedEmployees.length - employeesWithPersonalProfile.length,

    pensionEmployeeCodeCount: pensionEmployeeCodes.size,
    personalEmployeeCodeCount: personalEmployeeCodes.size,

    pensionRowsWithoutEmployeeCode: rowsWithoutEmployeeCode.length,
    personalProfilesWithoutEmployeeCode: profilesWithoutEmployeeCode.length,
    personalProfilesWithoutPensionRows: personalWithoutPensionRows.length,
    pensionEmployeesWithoutPersonalProfile: pensionWithoutPersonalProfile.length,

    matchRate:
      unifiedEmployees.length > 0
        ? Number(
            (
              employeesWithPersonalProfile.length / unifiedEmployees.length
            ).toFixed(4)
          )
        : 0,

    personalWithoutPensionEmployeeCodes: personalWithoutPensionRows,
    pensionWithoutPersonalEmployeeCodes: pensionWithoutPersonalProfile,
  };
}

export function buildUnifiedEmployeeData(pensionRows, personalDetails) {
  const safePensionRows = Array.isArray(pensionRows) ? pensionRows : [];

  const clientProfiles = Array.isArray(personalDetails?.clientProfiles)
    ? personalDetails.clientProfiles
    : [];

  const {
    byEmployeeCode: personalProfilesByEmployeeCode,
    profilesWithoutEmployeeCode,
  } = buildPersonalProfileIndexes(clientProfiles);

  const {
    byEmployeeCode: pensionRowsByEmployeeCode,
    rowsWithoutEmployeeCode,
  } = buildPensionRowsByEmployeeCode(safePensionRows);

  const unifiedEmployees = [...pensionRowsByEmployeeCode.entries()]
    .map(([employeeCode, employeePensionRows]) =>
      buildUnifiedEmployeeRow(
        employeeCode,
        employeePensionRows,
        personalProfilesByEmployeeCode.get(employeeCode) || []
      )
    )
    .sort((a, b) =>
      normalizeText(a.identity.fullName).localeCompare(
        normalizeText(b.identity.fullName),
        "he"
      )
    );

  const metadata = buildMetadata({
    unifiedEmployees,
    personalProfilesByEmployeeCode,
    pensionRowsByEmployeeCode,
    rowsWithoutEmployeeCode,
    profilesWithoutEmployeeCode,
  });

  return {
    source: "unifiedEmployeeData",
    joinKey: "employeeCode",
    rows: unifiedEmployees,
    employees: unifiedEmployees,
    metadata,
    debug: buildDebugSamples({
      personalProfilesByEmployeeCode,
      pensionRowsByEmployeeCode,
      rowsWithoutEmployeeCode,
      profilesWithoutEmployeeCode,
    }),
  };
}

export function enrichPensionRowsFromUnifiedEmployees(pensionRows, unifiedEmployeeData) {
  const employeesByCode = new Map();

  for (const employee of unifiedEmployeeData?.employees || []) {
    employeesByCode.set(normalizeComparable(employee.employeeCode), employee);
  }

  return (Array.isArray(pensionRows) ? pensionRows : []).map((row) => {
    const employeeCode = getPensionEmployeeCode(row);
    const employee = employeesByCode.get(employeeCode) || null;

    return {
      ...row,
      employeeCode: getPensionEmployeeCodeRaw(row),
      unifiedEmployee: employee,
      clientProfile: employee?.personal || null,
      personalProfileMatch: {
        matched: Boolean(employee?.personal),
        matchMethod: employee?.match?.matchMethod || "none",
        matchConfidence: employee?.match?.matchConfidence || "none",
        identityKey: employee?.personal?.identityKey || "",
        fullName: employee?.identity?.fullName || "",
      },
    };
  });
}
