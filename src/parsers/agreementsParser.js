// REPLACE EXISTING FILE
// Path: src/parsers/agreementsParser.js

import * as XLSX from "xlsx";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function normalizePercent(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 1 ? value : value * 100;
  }

  const text = String(value)
    .replace(",", ".")
    .replace("%", "")
    .replace(/[^\d.-]/g, "");

  if (!text) return null;

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;

  return parsed > 1 ? parsed : parsed * 100;
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === "") return null;

  const text = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowToText(row) {
  return row.map(normalizeText).join(" ");
}

function canonicalIssuerFromText(text) {
  const clean = normalizeText(text);

  if (/הפניקס|פניקס/.test(clean)) return "הפניקס";
  if (/הראל/.test(clean)) return "הראל";
  if (/כלל/.test(clean)) return "כלל";
  if (/מגדל|מקפת/.test(clean)) return "מגדל";
  if (/מנורה|מבטחים/.test(clean)) return "מנורה מבטחים";
  if (/איילון/.test(clean)) return "איילון";
  if (/אלטשולר/.test(clean)) return "אלטשולר שחם";
  if (/מור/.test(clean)) return "מור";
  if (/מיטב/.test(clean)) return "מיטב";
  if (/ילין/.test(clean)) return "ילין לפידות";
  if (/אנליסט/.test(clean)) return "אנליסט";

  return "";
}

function detectThresholdFromSheet(rows) {
  const text = rows.map(rowToText).join(" ");
  const matches = text.match(/(\d{2,3}(?:,\d{3})+|\d{5,})/g);

  if (!matches) return null;

  const values = matches
    .map((value) => normalizeMoney(value))
    .filter((value) => Number.isFinite(value) && value >= 100000);

  return values.length ? Math.min(...values) : null;
}

function isAgreementDataRow(row) {
  const issuer = canonicalIssuerFromText(rowToText(row));
  if (!issuer) return false;

  const feeCells = row.slice(1, 5).map(normalizePercent).filter((v) => v !== null);
  return feeCells.length >= 2;
}

function getCellPercent(row, index) {
  const value = normalizePercent(row[index]);

  // Fee percentages in this business table should be small values such as 1, 1.75, 0.15, 0.05.
  // Large numbers are usually thresholds inside notes, not fees.
  if (value !== null && value > 20) return null;

  return value;
}

export function parseAgreements(workbook) {
  if (!workbook) return [];

  const agreements = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    if (!rows.length) return;

    const sheetThreshold = detectThresholdFromSheet(rows);

    rows.forEach((row) => {
      if (!isAgreementDataRow(row)) return;

      const text = rowToText(row);
      const issuer = canonicalIssuerFromText(text);
      if (!issuer) return;

      const modelADepositFee = getCellPercent(row, 1);
      const modelAAccumulationFee = getCellPercent(row, 2);
      const highAccumulationDepositFee = getCellPercent(row, 3);
      const highAccumulationAccumulationFee = getCellPercent(row, 4);

      if (modelADepositFee !== null || modelAAccumulationFee !== null) {
        agreements.push({
          sheetName,
          manager: issuer,
          originalManager: issuer,
          issuer,
          optionName: "מודל א",
          depositFee: modelADepositFee,
          accumulationFee: modelAAccumulationFee,
          conditionType: "DEFAULT",
          conditionValue: null,
          isDefault: true,
          raw: { row, text },
        });
      }

      if (
        (highAccumulationDepositFee !== null || highAccumulationAccumulationFee !== null) &&
        sheetThreshold
      ) {
        agreements.push({
          sheetName,
          manager: issuer,
          originalManager: issuer,
          issuer,
          optionName: "מודל צבירות גבוהות",
          depositFee: highAccumulationDepositFee,
          accumulationFee: highAccumulationAccumulationFee,
          conditionType: "MIN_ACCUMULATION",
          conditionValue: sheetThreshold,
          isDefault: false,
          raw: {
            row,
            text,
            detectedThreshold: sheetThreshold,
          },
        });
      }
    });
  });

  console.log("parseAgreements result:", {
    rows: agreements.length,
    sample: agreements.slice(0, 10),
  });

  return agreements;
}
