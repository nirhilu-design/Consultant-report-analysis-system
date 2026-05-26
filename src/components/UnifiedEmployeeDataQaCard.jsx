function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "0";
  }

  return Number(value).toLocaleString("he-IL");
}

function formatMoney(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "0";
  }

  return Number(value).toLocaleString("he-IL", {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "0%";
  }

  return `${Math.round(Number(value) * 100)}%`;
}

function getUnifiedEmployeeStatus(unifiedEmployeeData) {
  const metadata = unifiedEmployeeData?.metadata;

  if (!metadata?.employeeCount) {
    return {
      title: "לא נבנה DATA אחיד לפי עובד",
      description:
        "לא נמצאו שורות עם קוד מזהה עובד בקובץ נתוני הפנסיה.",
      statusClassName: "error",
    };
  }

  if (metadata.matchRate === 0) {
    return {
      title: "נבנה DATA לפי עובד, אך ללא התאמות לפרטים האישיים",
      description:
        "יש לבדוק שהשדה קוד מזהה עובד מופיע באותו פורמט בשני הקבצים.",
      statusClassName: "error",
    };
  }

  if (metadata.matchRate < 0.8) {
    return {
      title: "נבנה DATA אחיד עם התאמה חלקית",
      description:
        "חלק מהעובדים קיבלו פרטים אישיים וחלק לא. צריך לבדוק קודים חסרים או שונים.",
      statusClassName: "warning",
    };
  }

  return {
    title: "נבנה DATA אחיד לפי עובד בהצלחה",
    description:
      "כל עובד מופיע כשורה אחת, עם פרטים אישיים וכל מוצרי הפנסיה שלו.",
    statusClassName: "success",
  };
}

export default function UnifiedEmployeeDataQaCard({ unifiedEmployeeData }) {
  const metadata = unifiedEmployeeData?.metadata || {
    employeeCount: 0,
    employeesWithPersonalProfile: 0,
    employeesWithoutPersonalProfile: 0,
    pensionEmployeeCodeCount: 0,
    personalEmployeeCodeCount: 0,
    pensionRowsWithoutEmployeeCode: 0,
    personalProfilesWithoutPensionRows: 0,
    matchRate: 0,
  };

  const employees = unifiedEmployeeData?.employees || [];
  const status = getUnifiedEmployeeStatus(unifiedEmployeeData);

  return (
    <section className="card personalDetailsQaCard">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Unified Employee DATA</p>
          <h2>DATA אחיד לפי קוד מזהה עובד</h2>
        </div>

        <span className={`statusPill ${status.statusClassName}`}>
          {formatPercent(metadata.matchRate)}
        </span>
      </div>

      <div className={`qaStatusBox ${status.statusClassName}`}>
        <strong>{status.title}</strong>
        <p>{status.description}</p>
      </div>

      <div className="qaGrid">
        <div className="qaMetric">
          <span>עובדים בדוח</span>
          <strong>{formatNumber(metadata.employeeCount)}</strong>
        </div>

        <div className="qaMetric">
          <span>עם פרטים אישיים</span>
          <strong>{formatNumber(metadata.employeesWithPersonalProfile)}</strong>
        </div>

        <div className="qaMetric">
          <span>ללא פרטים אישיים</span>
          <strong>{formatNumber(metadata.employeesWithoutPersonalProfile)}</strong>
        </div>

        <div className="qaMetric">
          <span>שורות ללא קוד עובד</span>
          <strong>{formatNumber(metadata.pensionRowsWithoutEmployeeCode)}</strong>
        </div>

        <div className="qaMetric">
          <span>פרופילים ללא שורת פנסיה</span>
          <strong>{formatNumber(metadata.personalProfilesWithoutPensionRows)}</strong>
        </div>
      </div>

      {Boolean(employees.length) && (
        <div className="qaTableWrap">
          <table className="qaTable">
            <thead>
              <tr>
                <th>קוד עובד</th>
                <th>שם</th>
                <th>גיל</th>
                <th>מצב משפחתי</th>
                <th>שכר פנסיוני</th>
                <th>מוצרים</th>
                <th>צבירה כוללת</th>
                <th>הפקדה חודשית</th>
                <th>סטטוס</th>
              </tr>
            </thead>

            <tbody>
              {employees.slice(0, 10).map((employee) => (
                <tr key={employee.employeeCode}>
                  <td>{employee.employeeCode || "-"}</td>
                  <td>{employee.identity.fullName || "-"}</td>
                  <td>{employee.personal?.calculatedAge ?? "-"}</td>
                  <td>{employee.family?.maritalStatus || "-"}</td>
                  <td>
                    {employee.salary?.pensionSalary !== null &&
                    employee.salary?.pensionSalary !== undefined
                      ? `${formatMoney(employee.salary.pensionSalary)} ₪`
                      : "-"}
                  </td>
                  <td>{formatNumber(employee.pension.productCount)}</td>
                  <td>{formatMoney(employee.pension.totalAccumulation)} ₪</td>
                  <td>{formatMoney(employee.pension.totalMonthlyDeposit)} ₪</td>
                  <td>
                    {employee.match.matchedPersonalProfile
                      ? "מחובר"
                      : "ללא פרטים אישיים"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {employees.length > 10 && (
            <p className="hint">
              מוצגים 10 עובדים ראשונים מתוך {formatNumber(employees.length)}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
