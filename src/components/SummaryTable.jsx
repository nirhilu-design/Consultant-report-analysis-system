export default function SummaryTable({ rows = [] }) {
  return (
    <table border="1" cellPadding="8">
      <thead>
        <tr>
          <th>יצרן</th>
          <th>תקין</th>
          <th>לא תקין</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td>{row.name}</td>
            <td>{row.valid}</td>
            <td>{row.invalid}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
