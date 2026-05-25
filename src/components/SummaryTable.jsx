// OPTIONAL REPLACE
// Path in project: src/components/SummaryTable.jsx

export default function SummaryTable({ rows = [] }) {
  return (
    <div className="tableWrap">
      <table className="analysisTable">
        <thead>
          <tr>
            <th>יצרן</th>
            <th>תקין</th>
            <th>לא תקין</th>
            <th>סה״כ</th>
            <th>אחוז תקינות</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const valid = Number(row.valid || 0);
            const invalid = Number(row.invalid || 0);
            const total = Number(row.total ?? valid + invalid);
            const compliance = total ? valid / total : 0;

            return (
              <tr key={row.name || index}>
                <td>{row.name}</td>
                <td>{valid.toLocaleString("he-IL")}</td>
                <td>{invalid.toLocaleString("he-IL")}</td>
                <td>{total.toLocaleString("he-IL")}</td>
                <td>{`${(compliance * 100).toFixed(1)}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
