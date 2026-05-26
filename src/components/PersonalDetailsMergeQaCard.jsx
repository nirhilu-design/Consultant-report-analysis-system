function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "0";
  }

  return Number(value).toLocaleString("he-IL");
}

function formatPercent(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "0%";
  }

  return `${Math.round(Number(value) * 100)}%`;
}

function getMergeStatus(personalDetailsMerge) {
  if (!personalDetailsMerge?.hasPersonalDetailsFile) {
    return {
      title: "לא בוצע חיבור פרטים אישיים",
      description:
        "לא הועלה קובץ פרטים אישיים ולכן שורות הדוח לא הועשרו בפרופילי לקוח.",
      statusClassName: "warning",
    };
  }

  const matchRate = personalDetailsMerge?.metadata?.matchRate || 0;

  if (matchRate === 0) {
    return {
      title: "לא נמצאו התאמות בין הדוח לפרטים האישיים",
      description:
        "יש לבדוק האם קיימים תעודת זהות, קוד עובד או שם מלא משותף בין הקבצים.",
      statusClassName: "error",
    };
  }

  if (matchRate < 0.6) {
    return {
      title: "נמצאה התאמה חלקית בלבד",
      description:
        "חלק משורות הדוח הועשרו בפרטים אישיים, אך שיעור ההתאמה נמוך ודורש בדיקה.",
      statusClassName: "warning",
    };
  }

  return {
    title: "חיבור פרטים אישיים בוצע בהצלחה",
    description:
      "שורות הדוח הועשרו בפרופילי לקוח לפי מנגנון זיהוי מדורג.",
    statusClassName: "success",
  };
}

export default function PersonalDetailsMergeQaCard({ personalDetailsMerge }) {
  const metadata = personalDetailsMerge?.metadata || {
    pensionRowCount: 0,
    clientProfileCount: 0,
    matchedPensionRows: 0,
    unmatchedPensionRows: 0,
    matchedClientProfiles: 0,
    unmatchedClientProfiles: 0,
    matchRate: 0,
    matchMethods: {},
  };

  const status = getMergeStatus(personalDetailsMerge);

  return (
    <section className="card personalDetailsQaCard">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Identity Merge QA</p>
          <h2>בדיקת חיבור פרטים אישיים לדוח</h2>
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
          <span>שורות דוח</span>
          <strong>{formatNumber(metadata.pensionRowCount)}</strong>
        </div>

        <div className="qaMetric">
          <span>פרופילים אישיים</span>
          <strong>{formatNumber(metadata.clientProfileCount)}</strong>
        </div>

        <div className="qaMetric">
          <span>שורות שהותאמו</span>
          <strong>{formatNumber(metadata.matchedPensionRows)}</strong>
        </div>

        <div className="qaMetric">
          <span>שורות ללא התאמה</span>
          <strong>{formatNumber(metadata.unmatchedPensionRows)}</strong>
        </div>

        <div className="qaMetric">
          <span>לקוחות שהותאמו</span>
          <strong>{formatNumber(metadata.matchedClientProfiles)}</strong>
        </div>
      </div>

      <div className="qaTableWrap">
        <table className="qaTable">
          <thead>
            <tr>
              <th>שיטת התאמה</th>
              <th>כמות שורות</th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(metadata.matchMethods || {}).length ? (
              Object.entries(metadata.matchMethods).map(([method, count]) => (
                <tr key={method}>
                  <td>{method}</td>
                  <td>{formatNumber(count)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td>אין התאמות</td>
                <td>0</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
