import React from "react";
import { buildDrilldownKey } from "../unified/analyticsEngine.js";

export default function ManagementFeesAuditDrilldown({
  managementFeesAudit = [],
  managementFeesAuditDrilldown = {},
}) {
  const [selectedCell, setSelectedCell] = React.useState(null);

  const issuers = React.useMemo(() => {
    const issuerSet = new Set();

    managementFeesAudit.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (
          key !== "key" &&
          key !== "label" &&
          key !== "total"
        ) {
          issuerSet.add(key);
        }
      });
    });

    return Array.from(issuerSet);
  }, [managementFeesAudit]);

  const selectedRows = React.useMemo(() => {
    if (!selectedCell) return [];

    const drilldownKey = buildDrilldownKey({
      statusKey: selectedCell.statusKey,
      issuer: selectedCell.issuer,
    });

    return (
      managementFeesAuditDrilldown[drilldownKey]?.rows || []
    );
  }, [selectedCell, managementFeesAuditDrilldown]);

  function openDrilldown(statusKey, statusLabel, issuer, value) {
    if (!value || Number(value) === 0) return;

    setSelectedCell({
      statusKey,
      statusLabel,
      issuer,
      value,
    });
  }

  function closeDrilldown() {
    setSelectedCell(null);
  }

  return (
    <section className="management-fees-audit-section">
      <div className="table-shell">
        <table className="management-fees-audit-table">
          <thead>
            <tr>
              <th>מדד</th>
              {issuers.map((issuer) => (
                <th key={issuer}>{issuer}</th>
              ))}
              <th>סה״כ</th>
            </tr>
          </thead>

          <tbody>
            {managementFeesAudit.map((row) => (
              <tr key={row.key}>
                <td className="row-label">{row.label}</td>

                {issuers.map((issuer) => {
                  const value = row[issuer] || 0;

                  return (
                    <td key={`${row.key}-${issuer}`}>
                      <button
                        type="button"
                        className={
                          value
                            ? "drilldown-cell active"
                            : "drilldown-cell"
                        }
                        onClick={() =>
                          openDrilldown(
                            row.key,
                            row.label,
                            issuer,
                            value
                          )
                        }
                        disabled={!value}
                        title={
                          value
                            ? "לחץ לצפייה בפירוט"
                            : ""
                        }
                      >
                        {value}
                      </button>
                    </td>
                  );
                })}

                <td className="total-cell">
                  {row.total || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <div
          className="drilldown-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="drilldown-panel">
            <div className="drilldown-header">
              <div>
                <h3>פירוט בקרת דמי ניהול</h3>
                <p>
                  {selectedCell.issuer} ·{" "}
                  {selectedCell.statusLabel} ·{" "}
                  {selectedCell.value} שורות
                </p>
              </div>

              <button
                type="button"
                className="drilldown-close"
                onClick={closeDrilldown}
              >
                ×
              </button>
            </div>

            <div className="drilldown-body">
              <table className="drilldown-table">
                <thead>
                  <tr>
                    <th>לקוח</th>
                    <th>ת.ז</th>
                    <th>פוליסה</th>
                    <th>צבירה</th>
                    <th>דמי ניהול מצבירה</th>
                    <th>מאושר מצבירה</th>
                    <th>דמי ניהול מהפקדה</th>
                    <th>מאושר מהפקדה</th>
                    <th>מודל</th>
                    <th>סיבת בקרה</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedRows.map((row, index) => (
                    <tr key={`${row.policyNumber}-${index}`}>
                      <td>{row.fullName || "-"}</td>
                      <td>{row.clientId || "-"}</td>
                      <td>{row.policyNumber || "-"}</td>
                      <td>{formatCurrency(row.accumulation)}</td>
                      <td>{formatPercent(row.actualAccumulationFee)}</td>
                      <td>{formatPercent(row.approvedAccumulationFee)}</td>
                      <td>{formatPercent(row.actualDepositFee)}</td>
                      <td>{formatPercent(row.approvedDepositFee)}</td>
                      <td>{formatModel(row.auditModel || row.matchedModel)}</td>
                      <td>
                        <div className="audit-reason">
                          <strong>{row.auditReason || "-"}</strong>

                          {row.failedReasons?.length > 0 && (
                            <ul>
                              {row.failedReasons.map((reason, reasonIndex) => (
                                <li key={reasonIndex}>{reason}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!selectedRows.length && (
                    <tr>
                      <td colSpan={10}>
                        אין שורות להצגה עבור הבחירה הזו.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function formatCurrency(value) {
  const numberValue = Number(value || 0);

  return numberValue.toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return "-";
  }

  return `${numberValue}%`;
}

function formatModel(model) {
  const map = {
    MODEL_A: "מודל א",
    MODEL_B: "מודל ב",
    TIER_MODEL: "צבירות גבוהות",
    BASELINE: "כלל בסיס",
    APPROVED_ACCUMULATION: "צבירה מאושרת",
    STANDARD_MODEL: "מודל הסכם",
  };

  return map[model] || model || "-";
}
