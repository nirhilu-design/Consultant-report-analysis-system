// Path: src/parsers/unifiedPensionPersonalDataBuilder.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED PENSION PERSONAL DATA BUILDER
// מחבר בין שורות פנסיה לפרופילים אישיים לפי קוד מזהה של העובד
//
// קלט:
//   pensionRows[]   — פלט של parsePensionFund  (employeeCode: string)
//   personalDetails — פלט של parsePersonalDetails (clientProfiles[])
//
// פלט:
//   {
//     rows[]      — 74 שורות מועשרות (פנסיה + אישי + metadata)
//     employees[] — 69 עובדים, כל אחד עם כל הפוליסות שלו
//     metadata    — סטטיסטיקת JOIN לבקרה
//   }
//
// עובדות על הקבצים האמיתיים (verified 2025-10):
//   · קוד עובד הוא int בשני הקבצים (1, 2, … 74)
//   · 69 קודים ייחודיים בפנסיה · 74 בפרטים אישיים
//   · 4 עובדים עם 2 פוליסות (19, 21, 28, 30)
//   · 5 עובדים בפרטים אישיים ללא פנסיה (16, 36, 50, 63, 71)
//   · match rate צפוי: 100% (כל קוד פנסיה מוצא התאמה)
// ─────────────────────────────────────────────────────────────────────────────

// ─── JOIN key normalization ───────────────────────────────────────────────────
// שני הקבצים שומרים int. אחרי parsePensionFund הקוד הוא string ("53").
// אחרי parsePersonalDetails הקוד הוא גם string.
// נרמול: הסר רווחים, המר לספרות בלבד, הסר אפסים מובילים.
// "053" → "53" | " 53 " → "53" | 53 → "53"

function normalizeJoinCode(value) {
  if (value === null || value === undefined) return "";

  const str = String(value).trim().replace(/\s/g, "");
  if (!str) return "";

  // אם מספרי — הסר אפסים מובילים
  if (/^\d+$/.test(str)) return String(Number(str));

  return str.toLowerCase();
}

// ─── Build lookup: employeeCode → clientProfile ───────────────────────────────

function buildPersonalIndex(clientProfiles) {
  const byCode = new Map();
  const withoutCode = [];

  for (const profile of clientProfiles || []) {
    const key = normalizeJoinCode(profile.employeeCode);

    if (!key) {
      withoutCode.push(profile);
      continue;
    }

    // במקרה של כפל — נשמור את הראשון (לא צפוי בקבצים אלה)
    if (!byCode.has(key)) {
      byCode.set(key, profile);
    }
  }

  return { byCode, withoutCode };
}

// ─── Enrich a single pension row with personal data ──────────────────────────

function enrichRow(pensionRow, profile, joinKey) {
  // אם אין פרופיל אישי — מחזירים את שורת הפנסיה עם סימון "לא נמצא"
  if (!profile) {
    return {
      ...pensionRow,
      employeeJoinKey:    joinKey,
      personalMatched:    false,
      personalMatchMethod: "none",

      // שדות אישיים ריקים
      personal_fullName:         "",
      personal_firstName:        "",
      personal_lastName:         "",
      personal_idNumber:         "",
      personal_age:              null,
      personal_birthYear:        null,
      personal_gender:           "",
      personal_maritalStatus:    "",
      personal_childrenCount:    null,
      personal_isSmoker:         null,
      personal_smokingStatus:    "",
      personal_section14:        null,
      personal_pensionSalary:    null,
      personal_salaryMonth:      "",
      personal_insuredSalaryPensionFund: null,
      personal_employmentStartDate: "",
      personal_employmentEndDate:   "",
      personal_employerGroupId:  "",
      personal_arrangementManagerName: "",
      personal_marketingStatus:  "",
      personal_marketingStatusDetails: "",
      personal_spouseBirthYear:  null,
      personal_hasDynamicModel:  null,
      personal_signedDynamicModel: null,
      personal_validityMonth:    "",
    };
  }

  return {
    ...pensionRow,

    // ── JOIN metadata ─────────────────────────────────────────────
    employeeJoinKey:     joinKey,
    personalMatched:     true,
    personalMatchMethod: "employeeCode",

    // ── זיהוי ────────────────────────────────────────────────────
    personal_fullName:   profile.fullName    || "",
    personal_firstName:  profile.firstName   || "",
    personal_lastName:   profile.lastName    || "",
    personal_idNumber:   profile.idNumber    || "",

    // ── דמוגרפי ──────────────────────────────────────────────────
    personal_age:          profile.calculatedAge ?? null,
    personal_birthYear:    profile.birthYear    ?? null,
    personal_gender:       profile.gender        || "",
    personal_maritalStatus: profile.maritalStatus || "",
    personal_childrenCount: profile.childrenCount ?? null,
    personal_isSmoker:     profile.isSmoker      ?? null,
    personal_smokingStatus: profile.smokingStatus || "",

    // ── העסקה ────────────────────────────────────────────────────
    personal_section14:          profile.section14          ?? null,
    personal_pensionSalary:      profile.pensionSalary       ?? null,
    personal_salaryMonth:        profile.salaryMonth          || "",
    personal_insuredSalaryPensionFund: profile.insuredSalaryPensionFund ?? null,
    personal_employmentStartDate: profile.employmentStartDate || "",
    personal_employmentEndDate:   profile.employmentEndDate   || "",
    personal_employerGroupId:     profile.employerGroupId     || "",
    personal_arrangementManagerName: profile.arrangementManagerName || "",

    // ── שיווק ────────────────────────────────────────────────────
    personal_marketingStatus:        profile.marketingStatus        || "",
    personal_marketingStatusDetails: profile.marketingStatusDetails || "",

    // ── משפחה ────────────────────────────────────────────────────
    personal_spouseBirthYear: profile.spouseBirthYear ?? null,

    // ── מודל דינמי ───────────────────────────────────────────────
    personal_hasDynamicModel:    profile.companyHasDynamicModel   ?? null,
    personal_signedDynamicModel: profile.employeeSignedDynamicModel ?? null,
    personal_validityMonth:      profile.validityMonth              || "",
  };
}

// ─── Group enriched rows by employee ─────────────────────────────────────────
// מייצר רשימת עובדים, כל אחד עם כל הפוליסות שלו מאוחדות

function buildEmployees(enrichedRows) {
  const byCode = new Map();

  for (const row of enrichedRows) {
    const key = row.employeeJoinKey || row.employeeCode;
    if (!key) continue;

    if (!byCode.has(key)) {
      byCode.set(key, {
        employeeCode:    row.employeeCode,
        employeeJoinKey: key,

        // נתונים אישיים — זהים לכל הפוליסות של אותו עובד
        personal: row.personalMatched
          ? {
              fullName:         row.personal_fullName,
              firstName:        row.personal_firstName,
              lastName:         row.personal_lastName,
              idNumber:         row.personal_idNumber,
              age:              row.personal_age,
              birthYear:        row.personal_birthYear,
              gender:           row.personal_gender,
              maritalStatus:    row.personal_maritalStatus,
              childrenCount:    row.personal_childrenCount,
              isSmoker:         row.personal_isSmoker,
              smokingStatus:    row.personal_smokingStatus,
              section14:        row.personal_section14,
              pensionSalary:    row.personal_pensionSalary,
              salaryMonth:      row.personal_salaryMonth,
              insuredSalaryPensionFund: row.personal_insuredSalaryPensionFund,
              employmentStartDate: row.personal_employmentStartDate,
              employmentEndDate:   row.personal_employmentEndDate,
              employerGroupId:     row.personal_employerGroupId,
              arrangementManagerName: row.personal_arrangementManagerName,
              marketingStatus:     row.personal_marketingStatus,
              hasDynamicModel:     row.personal_hasDynamicModel,
              signedDynamicModel:  row.personal_signedDynamicModel,
            }
          : null,

        matchedPersonalProfile: row.personalMatched,
        pensionRows: [],
      });
    }

    byCode.get(key).pensionRows.push(row);
  }

  // חישוב totals לכל עובד
  return [...byCode.values()].map((emp) => {
    const activeRows = emp.pensionRows.filter((r) => !r.isOperationOnly);

    return {
      ...emp,
      pensionRowCount:   emp.pensionRows.length,
      activePolicies:    activeRows.length,
      totalAccumulation: activeRows.reduce((sum, r) => sum + (r.accumulation || 0), 0),
      issuers: [...new Set(emp.pensionRows.map((r) => r.issuerOriginal).filter(Boolean))],
    };
  }).sort((a, b) => {
    // מיון לפי קוד עובד מספרי
    return Number(a.employeeCode) - Number(b.employeeCode);
  });
}

// ─── Metadata ────────────────────────────────────────────────────────────────

function buildMetadata(pensionRows, enrichedRows, employees, personalIndex) {
  const matched    = enrichedRows.filter((r) => r.personalMatched);
  const unmatched  = enrichedRows.filter((r) => !r.personalMatched);
  const uniquePensionCodes = new Set(pensionRows.map((r) => normalizeJoinCode(r.employeeCode)));
  const uniquePersonalCodes = new Set([...personalIndex.byCode.keys()]);

  const pensionWithoutPersonal = [...uniquePensionCodes].filter(
    (k) => !uniquePersonalCodes.has(k)
  );
  const personalWithoutPension = [...uniquePersonalCodes].filter(
    (k) => !uniquePensionCodes.has(k)
  );

  return {
    // ספירות בסיסיות
    pensionRows:           pensionRows.length,
    personalProfiles:      personalIndex.byCode.size + personalIndex.withoutCode.length,
    uniquePensionEmployees: uniquePensionCodes.size,
    uniquePersonalEmployees: uniquePersonalCodes.size,

    // JOIN results
    matchedPensionRows:    matched.length,
    unmatchedPensionRows:  unmatched.length,
    matchedEmployees:      employees.filter((e) => e.matchedPersonalProfile).length,
    unmatchedEmployees:    employees.filter((e) => !e.matchedPersonalProfile).length,

    // שיעורי התאמה
    rowMatchRate: pensionRows.length > 0
      ? Number((matched.length / pensionRows.length).toFixed(4))
      : 0,
    employeeMatchRate: uniquePensionCodes.size > 0
      ? Number((employees.filter((e) => e.matchedPersonalProfile).length / uniquePensionCodes.size).toFixed(4))
      : 0,

    // אבחון
    pensionWithoutPersonal,
    personalWithoutPension,
    profilesWithoutCode:   personalIndex.withoutCode.length,

    // פוליסות מרובות
    employeesWithMultiplePolicies: employees.filter((e) => e.pensionRowCount > 1).length,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildUnifiedPensionPersonalData(pensionRows, personalDetails) {
  const safePensionRows = Array.isArray(pensionRows) ? pensionRows : [];
  const clientProfiles  = Array.isArray(personalDetails?.clientProfiles)
    ? personalDetails.clientProfiles
    : [];

  // 1. בנה index של פרופילים אישיים לפי קוד עובד
  const personalIndex = buildPersonalIndex(clientProfiles);

  // 2. הרצת JOIN: כל שורת פנסיה מקבלת את הפרופיל האישי שלה
  const enrichedRows = safePensionRows.map((row) => {
    const joinKey = normalizeJoinCode(row.employeeCode);
    const profile = joinKey ? personalIndex.byCode.get(joinKey) || null : null;
    return enrichRow(row, profile, joinKey);
  });

  // 3. אגרגציה לרמת עובד
  const employees = buildEmployees(enrichedRows);

  // 4. metadata לבקרה
  const metadata = buildMetadata(safePensionRows, enrichedRows, employees, personalIndex);

  // לוג בקרה לקונסול
  console.log("buildUnifiedPensionPersonalData:", {
    pensionRows:     metadata.pensionRows,
    personalProfiles: metadata.personalProfiles,
    matchedRows:     metadata.matchedPensionRows,
    matchRate:       `${(metadata.rowMatchRate * 100).toFixed(1)}%`,
    employees:       employees.length,
    multiPolicy:     metadata.employeesWithMultiplePolicies,
    unmatchedPensionCodes: metadata.pensionWithoutPersonal,
    personalWithoutPension: metadata.personalWithoutPension,
  });

  return {
    source:    "unifiedPensionPersonalData",
    joinKey:   "employeeCode",
    rows:      enrichedRows,   // 74 שורות מועשרות → Audit Engine
    employees,                 // 69 עובדים → Dashboard
    metadata,
  };
}
