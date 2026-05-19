const MANAGERS = [
  "הפניקס",
  "הראל",
  "כלל",
  "מקפת",
  "מבטחים",
  "מיטב",
  "אלטשולר",
  "מור",
  "אחרים",
];

const WAIVER_ROWS = [
  "לא קיים ויתור שארים",
  "ויתור על בת זוג בלבד",
  "קיים ויתור מלא",
  "חסר נתון",
];

function emptyManagerMap() {
  return MANAGERS.reduce(
    (acc, manager) => {
      acc[manager] = 0;

      return acc;
    },
    {}
  );
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

function isHighAccumulationTrack(
  track = ""
) {
  return /עתיר|מוגבר|צבירה גבוהה|מניות|כללי/.test(
    String(track)
  );
}

function buildAgreementMap(
  agreements
) {
  return agreements.reduce(
    (acc, agreement) => {
      if (!acc[agreement.manager]) {
        acc[agreement.manager] =
          agreement;
      }

      return acc;
    },
    {}
  );
}

function isFeeValid(
  policy,
  agreement
) {
  if (!agreement) return false;

  const policyDepositFee =
    normalizePercent(
      policy.depositFee
    );

  const policyAccumulationFee =
    normalizePercent(
      policy.accumulationFee
    );

  const agreementDepositFee =
    normalizePercent(
      agreement.depositFee
    );

  const agreementAccumulationFee =
    normalizePercent(
      agreement.accumulationFee
    );

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
    policyDepositFee <=
      agreementDepositFee;

  const accumulationValid =
    !hasAccumulationCheck ||
    policyAccumulationFee <=
      agreementAccumulationFee;

  return (
    depositValid &&
    accumulationValid
  );
}

export function buildPensionSummary(
  pensionRows = [],
  agreements = []
) {
  const agreementMap =
    buildAgreementMap(agreements);

  // =========================
  // מסלול ביטוח
  // =========================

  const insurancePath =
    WAIVER_ROWS.reduce(
      (acc, row) => {
        acc[row] =
          emptyManagerMap();

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
    emptyManagerMap();

  // =========================
  // דמי ניהול
  // =========================

  const managementFees = {
    valid: emptyManagerMap(),

    invalid: emptyManagerMap(),

    total: emptyManagerMap(),

    over500k:
      emptyManagerMap(),

    highAccumulationTrack:
      emptyManagerMap(),

    totalFocus:
      emptyManagerMap(),
  };

  // =========================
  // KPI
  // =========================

  const noAgreementDetails =
    new Set();

  let totalPolicies = 0;

  let validFeePolicies = 0;

  let invalidFeePolicies = 0;

  let noAgreementPolicies = 0;

  // =========================
  // Main Loop
  // =========================

  pensionRows.forEach((policy) => {
    const hasAgreement =
      Boolean(
        agreementMap[
          policy.manager
        ]
      );

    const manager =
      policy.manager ===
        "אחרים" ||
      !hasAgreement
        ? "אחרים"
        : policy.manager;

    // =========================
    // מסלול ביטוח
    // =========================

    const waiverLabel =
      WAIVER_ROWS.includes(
        policy.insuranceWaiver
      )
        ? policy.insuranceWaiver
        : "חסר נתון";

    insurancePath[
      waiverLabel
    ][manager] += 1;

    insurancePathTotals[
      waiverLabel
    ] += 1;

    insuranceManagerTotals[
      manager
    ] += 1;

    // =========================
    // Totals
    // =========================

    totalPolicies += 1;

    managementFees.total[
      manager
    ] += 1;

    // =========================
    // Agreement Logic
    // =========================

    if (!hasAgreement) {
      noAgreementPolicies += 1;

      invalidFeePolicies += 1;

      managementFees.invalid[
        manager
      ] += 1;

      const originalManager =
        policy.originalManager ||
        policy.manager ||
        "לא מזוהה";

      noAgreementDetails.add(
        originalManager
      );
    } else if (
      isFeeValid(
        policy,
        agreementMap[
          policy.manager
        ]
      )
    ) {
      validFeePolicies += 1;

      managementFees.valid[
        manager
      ] += 1;
    } else {
      invalidFeePolicies += 1;

      managementFees.invalid[
        manager
      ] += 1;
    }

    // =========================
    // צבירה גבוהה
    // =========================

    if (
      Number(
        policy.accumulation || 0
      ) > 500000
    ) {
      managementFees.over500k[
        manager
      ] += 1;

      managementFees.totalFocus[
        manager
      ] += 1;
    }

    // =========================
    // מסלול עתיר צבירה
    // =========================

    if (
      isHighAccumulationTrack(
        policy.track
      )
    ) {
      managementFees.highAccumulationTrack[
        manager
      ] += 1;

      managementFees.totalFocus[
        manager
      ] += 1;
    }
  });

  // =========================
  // Final Object
  // =========================

  return {
    totalPolicies,

    validFeePolicies,

    invalidFeePolicies,

    noAgreementPolicies,

    noAgreementDetails:
      Array.from(
        noAgreementDetails
      ).filter(Boolean),

    insurancePath,

    insurancePathTotals,

    insuranceManagerTotals,

    managementFees,
  };
}
