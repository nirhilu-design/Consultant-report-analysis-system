import React from "react";
import {
  buildDrilldownKey,
} from "../unified/analyticsEngine.js";

import "./managementFeesDrilldown.css";

const LABEL_TO_STATUS_KEY = {
  "תקין לפי מודל א": "MODEL_A",
  "תקין לפי מודל ב": "MODEL_B",
  "תקין לפי מודל צבירות גבוהות / מדרגה": "TIER",
  "תקין לפי מצבירה מאושרת": "ACCUMULATION_FEE_ONLY",
  "תקין לפי צבירה מאושרת": "ACCUMULATION_FEE_ONLY",
  "תקין לפי כלל בסיס ללא הסדר": "BASELINE",
  "ד.נ תקולים": "INVALID",
  "חריג / לא תקין": "INVALID",
  "הוחרגו - תפעול בלבד / חסר מידע": "EXCLUDED",
};

export default function ManagementFeesAuditDrilldown({
  audit,
  managementFeesAudit,
  managementFeesAuditDrilldown = {},
}) {
  const [selectedCell, setSelectedCell] = React.useState(null);

  const normalizedAudit = React.useMemo(() => {
    if (audit?.issuers && audit?.rows) {
      return audit;
    }

    if (managementFeesAudit?.issuers && managementFeesAudit?.rows) {
      return managementFeesAudit;
    }

    if (Array.isArray(managementFeesAudit)) {
      const issuers = new Set();

      managementFeesAudit.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (
            key !== "key" &&
            key !== "label" &&
            key !== "total"
          ) {
            issuers.add(key);
          }
        });
      });

      return {
        issuers: Array.from(issuers),
        rows: managementFeesAudit,
      };
    }

    return {
      issuers: [],
      rows: [],
    };
  }, [audit, managementFeesAudit]);

  const issuers = normalizedAudit.issuers || [];
  const rows = normalizedAudit.rows || [];

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

  function openDrilldown(row, issuer, value) {
    if (!value || Number(value) === 0) return;

    const statusKey =
      row.key ||
      LABEL_TO_STATUS_KEY[row.label];

    if (!statusKey) return;

    setSelectedCell({
      statusKey,
      statusLabel: row.label,
      issuer,
      value,
    });
  }

  function closeDrilldown() {
    setSelectedCell(null);
  }

  if (!issuers.length || !rows.length) {
    return (
      <div className="emptyState">
        <p>אין נתוני בקרת דמי ניהול להצגה</p>
      </div>
    );
  }

  return (
    <section className="management-fees-audit-section">
      <div className="table-shell">
        <table className="management-fees-audit-table analysisTable">
          <thead>
            <tr>
              <th>מדד</th>
              {issuers.map((issuer) => (
                <th key={issuer}>{issuer}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key || row.label}
                className={
                  row.label?.includes("תקולים")
                    ? "dangerRow"
                    : row.label?.includes("תקין")
                      ? "successRow"
                      : row.label?.includes("סה״כ")
                        ? "totalRow"
                        : ""
                }
              >
                <td className="rowTitle">{row.label}</td>

                {issuers.map((issuer) => {
                  const value = row[issuer] || 0;
                  const isPercent = row.label?.includes("אחוז");
                  const canDrill =
                    !isPercent &&
                    !row.label?.includes("סה״כ") &&
                    Number(value) > 0;

                  return (
                    <td key={`${row.key || row.label}-${issuer}`}>
                      <button
                        type="button"
                        className={
                          canDrill
                            ? "drilldown-cell active"
                            : "drilldown-cell"
                        }
                        onClick={() =>
                          openDrilldown(row, issuer, value)
                        }
                        disabled={!canDrill}
                        title={
                          canDrill
                            ? "לחץ לצפייה בפירוט"
                            : ""
                        }
                      >
                        {isPercent
                          ? `${(Number(value || 0) * 100).toFixed(1)}%`
                          : Number(value || 0).toLocaleString("he-IL")}
                      </button>
                    </td>
                  );
                })}
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
                    <th>ד.נ מצבירה</th>
                    <th>מאושר מצבירה</th>
                    <th>ד.נ מהפקדה</th>
                    <th>מאושר מהפקדה</th>
                    <th>מודל</th>
                    <th>סיבת בקרה</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedRows.map((row, index) => (
                    <tr key={`${row.auditRowId || row.policyNumber || row.clientId}-${index}`}>
                      <td>{row.fullName || row.clientId || "-"}</td>
                      <td>{row.clientId || "-"}</td>
                      <td>{row.policyNumber || "-"}</td>
                      <td>{formatCurrency(row.accumulation)}</td>
                      <td>{formatPercent(row.actualAccumulationFee)}</td>
                      <td>{formatPercent(row.approvedAccumulationFee)}</td>
                      <td>{formatPercent(row.actualDepositFee)}</td>
                      <td>{formatPercent(row.approvedDepositFee)}</td>
                      <td>{row.matchedModel || row.auditModel || "-"}</td>
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

  return `${numberValue.toFixed(2)}%`;
}
