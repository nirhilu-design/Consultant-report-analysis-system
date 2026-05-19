function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function normalizePercent(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue > 1
    ? numberValue
    : numberValue * 100;
}

function isHighAccumulationTrack(track = "") {
  return /עתיר|מוגבר|צבירה גבוהה|מניות|כללי/.test(
    String(track)
  );
}

function getCleanManagerName(policyOrAgreement) {
  const manager =
    policyOrAgreement.originalManager ||
    policyOrAgreement.manager ||
    "";

  const cleanManager = normalizeText(manager);

  return cleanManager || "לא מזוהה";
}

function getDisplayManagerName(managerName) {
  const text = normalizeText(managerName);

  if (!text) return "לא מזוהה";

  if (/הפניקס|פניקס/.test(text)) return "הפניקס";
  if (/הראל/.test(text)) return "הראל";
  if (/כלל/.test(text)) return "כלל";
  if (/מקפת|מגדל/.test(text)) return "מגדל מקפת";
  if (/מבטחים|מנורה/.test(text)) return "מנורה מבטחים";
  if (/מיטב/.test(text)) return "מיטב";
  if (/אלטשולר/.test(text)) return "אלטשולר";
  if (/מור/.test(text)) return "מור";

  return text;
}

function emptyManagerMap(managerColumns) {
  return managerColumns.reduce(
    (acc, manager) => {
      acc[manager] = 0;
      return acc;
    },
    {}
  );
}

function buildAgreementMap(agreements = []) {
  return agreements.reduce(
    (acc, agreement) => {
      const managerName = getDisplayManagerName(
        getCleanManagerName(agreement)
      );

      if (!acc[managerName]) {
        acc[managerName] = agreement;
      }

      return acc;
    },
    {}
  );
}

function isFeeValid(policy, agreement) {
  if (!agreement) return false;

  const policyDepositFee =
    normalizePercent(policy.depositFee);

  const policyAccumulationFee =
    normalizePercent(policy.accumulationFee);

  const agreementDepositFee =
    normalizePercent(agreement.depositFee);

  const agreementAccumulationFee =
    normalizePercent(agreement.accumulationFee);

  const hasDepositCheck =
    policyDepositFee !== null &&
    agreementDepositFee !== null;

  const hasAccumulationCheck =
    policyAccumulationFee !== null &&
    agreementAccumulationFee !== null;

  if (
    !hasDepositCheck &&
    !hasAccumulationCheck
  ) {
    return false;
  }

  const depositValid =
    !hasDepositCheck ||
    policyDepositFee <= agreementDepositFee;

  const accumulationValid =
    !hasAccumulationCheck ||
    policyAccumulationFee <= agreementAccumulationFee;

  return depositValid && accumulationValid;
}

function buildDynamicManagerColumns(
  pensionRows = [],
  agreements = []
) {
  const managerSet = new Set();

  agreements.forEach((agreement) => {
    const managerName = getDisplayManagerName(
      getCleanManagerName(agreement)
    );

    if (
      managerName &&
      managerName !== "אחרים" &&
      managerName !== "לא מזוהה"
    ) {
      managerSet.add(managerName);
    }
  });

  pensionRows.forEach((policy) => {
    const managerName = getDisplayManagerName(
      getCleanManagerName(policy)
    );

    if (
      managerName &&
      managerName !== "אחרים" &&
      managerName !== "לא מזוהה"
    ) {
      managerSet.add(managerName);
    }
  });

  const managerColumns = Array.from(managerSet).sort(
    (a, b) => a.localeCompare(b, "he")
  );

  managerColumns.push("אחרים / ללא הסכם");

  return managerColumns;
}

const WAIVER_ROWS = [
  "לא קיים ויתור שארים",
  "ויתור על בת זוג בלבד",
  "קיים ויתור מלא",
  "חסר נתון",
];

export function buildPensionSummary(
  pensionRows = [],
  agreements = []
) {
  const agreementMap = buildAgreementMap(agreements);

  const managerColumns = buildDynamicManagerColumns(
    pensionRows,
    agreements
  );

  const otherColumnName = "אחרים / ללא הסכם";

  // =========================
  // מסלול ביטוח
  // =========================

  const insurancePath =
    WAIVER_ROWS.reduce(
      (acc, row) => {
        acc[row] = emptyManagerMap(managerColumns);
        return acc;
      },
      {}
    );

  const insurancePathTotals =
    WAIVER_ROWS.reduce(
      (acc, row) => {
        acc[row] = 0;
        return acc;
      },
      {}
    );

  const insuranceManagerTotals =
    emptyManagerMap(managerColumns);

  // =========================
  // דמי ניהול
  // =========================

  const managementFees = {
    valid: emptyManagerMap(managerColumns),
    invalid: emptyManagerMap(managerColumns),
    total: emptyManagerMap(managerColumns),
    over500k: emptyManagerMap(managerColumns),
    highAccumulationTrack: emptyManagerMap(managerColumns),
    totalFocus: emptyManagerMap(managerColumns),
  };

  // =========================
  // KPI
  // =========================

  const noAgreementDetails = new Set();

  let totalPolicies = 0;
  let validFeePolicies = 0;
  let invalidFeePolicies = 0;
  let noAgreementPolicies = 0;

  // =========================
  // Main Loop
  // =========================

  pensionRows.forEach((policy) => {
    const originalManagerName = getDisplayManagerName(
      getCleanManagerName(policy)
    );

    const hasAgreement =
      Boolean(agreementMap[originalManagerName]);

    const manager =
      hasAgreement &&
      managerColumns.includes(originalManagerName)
        ? originalManagerName
        : otherColumnName;

    // =========================
    // מסלול ביטוח
    // =========================

    const waiverLabel =
      WAIVER_ROWS.includes(policy.insuranceWaiver)
        ? policy.insuranceWaiver
        : "חסר נתון";

    insurancePath[waiverLabel][manager] += 1;
    insurancePathTotals[waiverLabel] += 1;
    insuranceManagerTotals[manager] += 1;

    // =========================
    // Totals
    // =========================

    totalPolicies += 1;
    managementFees.total[manager] += 1;

    // =========================
    // Agreement Logic
    // =========================

    if (!hasAgreement) {
      noAgreementPolicies += 1;
      invalidFeePolicies += 1;
      managementFees.invalid[manager] += 1;

      noAgreementDetails.add(originalManagerName);
    } else if (
      isFeeValid(
        policy,
        agreementMap[originalManagerName]
      )
    ) {
      validFeePolicies += 1;
      managementFees.valid[manager] += 1;
    } else {
      invalidFeePolicies += 1;
      managementFees.invalid[manager] += 1;
    }

    // =========================
    // צבירה גבוהה
    // =========================

    if (Number(policy.accumulation || 0) > 500000) {
      managementFees.over500k[manager] += 1;
      managementFees.totalFocus[manager] += 1;
    }

    // =========================
    // מסלול עתיר צבירה
    // =========================

    if (isHighAccumulationTrack(policy.track)) {
      managementFees.highAccumulationTrack[manager] += 1;
      managementFees.totalFocus[manager] += 1;
    }
  });

  // =========================
  // Final Object
  // =========================

  return {
    managerColumns,

    totalPolicies,
    validFeePolicies,
    invalidFeePolicies,
    noAgreementPolicies,

    noAgreementDetails:
      Array.from(noAgreementDetails)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "he")),

    insurancePath,
    insurancePathTotals,
    insuranceManagerTotals,
    managementFees,
  };
}
