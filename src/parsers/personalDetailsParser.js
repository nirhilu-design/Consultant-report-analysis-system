import * as XLSX from "xlsx";

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeCell(value) {
  if (value === undefined || value === null) return "";

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

function getFirstSheet(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    return null;
  }

  const firstSheetName = workbook.SheetNames[0];

  return workbook.Sheets[firstSheetName] || null;
}

function sheetToObjects(sheet) {
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!rows.length) return [];

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => String(cell ?? "").trim())
  );

  if (headerRowIndex === -1) return [];

  const headers = rows[headerRowIndex].map(normalizeHeader);

  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row, rowIndex) => {
      const record = {
        rowIndex: headerRowIndex + rowIndex + 2,
      };

      headers.forEach((header, columnIndex) => {
        if (!header) return;

        record[header] = normalizeCell(row[columnIndex]);
      });

      return record;
    });
}

export function parsePersonalDetails(workbook) {
  if (!workbook) {
    return {
      source: "personalDetails",
      rows: [],
      count: 0,
      hasFile: false,
    };
  }

  const sheet = getFirstSheet(workbook);
  const rows = sheetToObjects(sheet);

  return {
    source: "personalDetails",
    rows,
    count: rows.length,
    hasFile: true,
  };
}
