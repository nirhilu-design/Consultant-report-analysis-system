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

function detectModelName(index, numbers) {
  if (index === 0) return "מודל א";
  if (index === 1) return "מודל ב";
  return `מודל ${index + 1}`;
}

function extractNumbersFromRow(row) {
  return row
    .map((cell, index) => ({
      index,
      raw: cell,
      value: normalizePercent(cell),
    }))
    .filter((item) => item.value !== null);
}

function buildOptionsFromNumbers(numbers) {
  if (!numbers.length) return [];

  const values = numbers.map((item) => item.value);

  // Most common agreement matrix:
  // [1.00, 0.15, 2.00, 0.05] = deposit A, asset A, deposit B, asset B
  // Sometimes Hebrew Excel extraction reverses visual order:
  // [0.05, 2.00, 0.15, 1.00] = asset B, deposit B, asset A, deposit A
  const looksReversed =
    values.length >= 4 &&
    values[0] <= 0.3 &&
    values[1] >= 0.5 &&
    values[2] <= 0.3 &&
    values[3] >= 0.5;

  const ordered = looksReversed ? [...values].reverse() : values;

  const options = [];

  for (let i = 0; i < ordered.length; i += 2) {
    const depositFee = ordered[i] ?? null;
    const accumulationFee = ordered[i + 1] ?? null;

    if (depositFee === null && accumulationFee === null) continue;

    options.push({
      optionName: detectModelName(options.length, ordered),
      depositFee,
      accumulationFee,
      conditionType: "DEFAULT",
      conditionValue: null,
      isDefault: options.length === 0,
    });
  }

  return options;
}

function detectThresholdFromSheet(rows) {
  const text = rows.map(rowToText).join(" ");
  const matches = text.match(/(\d{2,3}(?:,\d{3})+|\d{5,})/g);

  if (!matches) return null;

  const values = matches
    .map((value) => Number(String(value).replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 100000);

  return values.length ? Math.min(...values) : null;
}

function shouldSkipRow(row) {
  const text = rowToText(row);

  if (!text) return true;
  if (/שם.*יצרן|יצרן|חברה.*מנהלת/.test(text) && /דמי.*ניהול|הפקדה|צבירה/.test(text)) return true;
  if (/הערה|כפוף|בקשה|חתימה|פגישה/.test(text) && !canonicalIssuerFromText(text)) return true;

  return false;
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
      if (shouldSkipRow(row)) return;

      const text = rowToText(row);
      const issuer = canonicalIssuerFromText(text);

      if (!issuer) return;

      const numbers = extractNumbersFromRow(row);
      const options = buildOptionsFromNumbers(numbers);

      options.forEach((option) => {
        agreements.push({
          sheetName,
          manager: issuer,
          originalManager: issuer,
          issuer,
          optionName: option.optionName,
          depositFee: option.depositFee,
          accumulationFee: option.accumulationFee,
          conditionType: option.conditionType,
          conditionValue: option.conditionValue,
          isDefault: option.isDefault,
          raw: {
            row,
            text,
          },
        });
      });

      // If a second option exists and the sheet mentions high accumulation threshold,
      // mark it as a tier option as well. The audit engine still checks all options,
      // but this enables the "מודל צבירות גבוהות" analysis.
      if (options.length >= 2 && sheetThreshold) {
        const second = options[1];

        agreements.push({
          sheetName,
          manager: issuer,
          originalManager: issuer,
          issuer,
          optionName: "מודל צבירות גבוהות",
          depositFee: second.depositFee,
          accumulationFee: second.accumulationFee,
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
