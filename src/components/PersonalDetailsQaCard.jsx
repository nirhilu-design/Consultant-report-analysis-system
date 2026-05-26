function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "0";
  }

  return Number(value).toLocaleString("he-IL");
}

function getPersonalDetailsStatus(personalDetails) {
  if (!personalDetails?.hasFile) {
    return {
      title: "קובץ פרטים אישיים לא הועלה",
      description: "הניתוח רץ ללא שכבת פרטים אישיים. ניתן להמשיך לעבוד, אך נתוני לקוח ומשפחה לא יועשרו.",
      statusClassName: "warning",
    };
  }

  if (!personalDetails.clientProfiles?.length) {
    return {
      title: "קובץ פרטים אישיים נקלט, אך לא זוהו פרופילים",
      description: "יש לבדוק שהקובץ כולל כותרות ונתונים בטבלה הראשונה.",
      statusClassName: "error",
    };
  }

  return {
    title: "קובץ פרטים אישיים נקלט בהצלחה",
    description: "המערכת זיהתה ונרמלה פרופילי לקוחות מתוך הקובץ.",
    statusClassName: "success",
  };
}

export default function PersonalDetailsQaCard({ personalDetails }) {
  const status = getPersonalDetailsStatus(personalDetails);

  const metadata = personalDetails?.metadata || {
    rawRowCount: 0,
    profileCount: 0,
    withIdNumber: 0,
    withEmployeeCode: 0,
    withPensionSalary: 0,
  };

  return (
    <section className="card personalDetailsQaCard">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Personal Details QA</p>
          <h2>בדיקת קליטת פרטים אישיים</h2>
        </div>

        <span className={`statusPill ${status.statusClassName}`}>
          {personalDetails?.hasFile ? "נקלט" : "לא הועלה"}
        </span>
      </div>

      <div className={`qaStatusBox ${status.statusClassName}`}>
        <strong>{status.title}</strong>
        <p>{status.description}</p>
      </div>

      <div className="qaGrid">
        <div className="qaMetric">
          <span>שורות מקור</span>
          <strong>{formatNumber(metadata.rawRowCount)}</strong>
        </div>

        <div className="qaMetric">
          <span>פרופילים מנורמלים</span>
          <strong>{formatNumber(metadata.profileCount)}</strong>
        </div>

        <div className="qaMetric">
          <span>עם תעודת זהות</span>
          <strong>{formatNumber(metadata.withIdNumber)}</strong>
        </div>

        <div className="qaMetric">
          <span>עם קוד עובד</span>
          <strong>{formatNumber(metadata.withEmployeeCode)}</strong>
        </div>

        <div className="qaMetric">
          <span>עם שכר פנסיוני</span>
          <strong>{formatNumber(metadata.withPensionSalary)}</strong>
        </div>
      </div>

      {Boolean(personalDetails?.clientProfiles?.length) && (
        <div className="qaTableWrap">
          <table className="qaTable">
            <thead>
              <tr>
                <th>שם</th>
                <th>גיל</th>
                <th>מין</th>
                <th>מצב משפחתי</th>
                <th>ילדים</th>
                <th>שכר פנסיוני</th>
                <th>מנהל הסדר</th>
              </tr>
            </thead>

            <tbody>
              {personalDetails.clientProfiles.slice(0, 8).map((profile) => (
                <tr key={profile.identityKey}>
                  <td>{profile.fullName || "-"}</td>
                  <td>{profile.calculatedAge ?? "-"}</td>
                  <td>{profile.gender || "-"}</td>
                  <td>{profile.maritalStatus || "-"}</td>
                  <td>{profile.childrenCount ?? "-"}</td>
                  <td>
                    {profile.pensionSalary !== null
                      ? `${formatNumber(profile.pensionSalary)} ₪`
                      : "-"}
                  </td>
                  <td>{profile.arrangementManagerName || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {personalDetails.clientProfiles.length > 8 && (
            <p className="hint">
              מוצגים 8 פרופילים ראשונים מתוך {formatNumber(personalDetails.clientProfiles.length)}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
