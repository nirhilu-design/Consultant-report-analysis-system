.management-fees-audit-section {
  width: 100%;
  direction: rtl;
}

.table-shell {
  width: 100%;
  overflow-x: auto;
}

.management-fees-audit-table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
  font-family: Calibri, Arial, sans-serif;
}

.management-fees-audit-table th,
.management-fees-audit-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #e8edf5;
  text-align: center;
  white-space: nowrap;
}

.management-fees-audit-table th {
  background: #f4f7fb;
  color: #1f365c;
  font-weight: 700;
}

.management-fees-audit-table .row-label {
  text-align: right;
  font-weight: 700;
  color: #1f365c;
}

.total-cell {
  font-weight: 700;
  color: #0f2f57;
  background: #f9fbff;
}

.drilldown-cell {
  min-width: 42px;
  border: none;
  background: transparent;
  color: #334155;
  font: inherit;
  cursor: default;
  padding: 6px 8px;
  border-radius: 8px;
}

.drilldown-cell.active {
  cursor: pointer;
  background: #eef5ff;
  color: #0f4c81;
  font-weight: 700;
}

.drilldown-cell.active:hover {
  background: #dbeafe;
}

.drilldown-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
}

.drilldown-panel {
  width: min(1280px, 96vw);
  max-height: 88vh;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 22px 70px rgba(15, 23, 42, 0.24);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: Calibri, Arial, sans-serif;
  direction: rtl;
}

.drilldown-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid #e8edf5;
  background: linear-gradient(135deg, #f8fbff 0%, #ffffff 100%);
}

.drilldown-header h3 {
  margin: 0;
  color: #0f2f57;
  font-size: 22px;
}

.drilldown-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 15px;
}

.drilldown-close {
  border: none;
  background: #eef2f7;
  color: #0f172a;
  border-radius: 999px;
  width: 34px;
  height: 34px;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.drilldown-close:hover {
  background: #dbeafe;
}

.drilldown-body {
  overflow: auto;
  padding: 0;
}

.drilldown-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;
}

.drilldown-table th,
.drilldown-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #e8edf5;
  text-align: right;
  vertical-align: top;
  font-size: 14px;
}

.drilldown-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f4f7fb;
  color: #1f365c;
  font-weight: 700;
}

.audit-reason strong {
  display: block;
  color: #0f2f57;
  margin-bottom: 4px;
}

.audit-reason ul {
  margin: 6px 0 0;
  padding-right: 18px;
  color: #9f1239;
}

.audit-reason li {
  margin-bottom: 3px;
}
