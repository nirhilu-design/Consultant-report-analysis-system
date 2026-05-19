import * as XLSX from "xlsx";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "")
    .trim();
}

function normalizeNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function rowToText(row) {
  return row.map(normalizeText).join(" ");
}

function findHeaderIndex(rows) {
  const maxRowsToScan = Math.min(
    rows.length,
    20
  );

  for (
    let i = 0;
    i < maxRowsToScan;
    i += 1
  ) {
    const text = rowToText(rows[i]);

    const hasManager =
      /יצרן|חברה|גוף|מנהל/.test(text);

    const hasFee =
      /דמי.*ניהול|צבירה|הפקדה|ד\.?נ/.test(
        text
      );

    const hasProduct =
      /מוצר|פנסיה|גמל|השתלמות/.test(
        text
      );

    if (
      hasManager &&
      (hasFee || hasProduct)
    ) {
      return i;
    }
  }

  return 0;
}

function makeObjects(rows, headerIndex) {
  const headers = rows[headerIndex].map(
    (header, index) => {
      const cleanHeader =
        normalizeText(header);

      return cleanHeader || `עמודה_${index}`;
    }
  );

  return rows
    .slice(headerIndex + 1)
    .map((row) => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = row[index];
      });

      obj.__raw = row;

      obj.__text = rowToText(row);

      return obj;
    });
}

function getByHeader(row, patterns) {
  const entry = Object.entries(row).find(
    ([header]) =>
      patterns.some((pattern) =>
        pattern.test(
          normalizeText(header)
        )
      )
  );

  return entry ? entry[1] : "";
}

function detectManager(row) {
  const text = normalizeText(
    `${getByHeader(row, [
      /יצרן/,
      /חברה/,
      /גוף.*מנהל/,
      /קרן/,
    ])} ${row.__text}`
  );

  if (/הפניקס|פניקס/.test(text))
    return "הפניקס";

  if (/הראל/.test(text))
    return "הראל";

  if (/כלל/.test(text))
    return "כלל";

  if (/מקפת|מגדל/.test(text))
    return "מקפת";

  if (/מבטחים|מנורה/.test(text))
    return "מבטחים";

  if (/מיטב/.test(text))
    return "מיטב";

  if (/אלטשולר/.test(text))
    return "אלטשולר";

  if (/מור/.test(text))
    return "מור";

  return "אחרים";
}

function isPensionAgreement(row) {
  const text = normalizeText(
    row.__text
  );

  return /פנסיה|מקיפה|משלימה|קרן/.test(
    text
  );
}

function detectDepositFee(row) {
  return normalizeNumber(
    getByHeader(row, [
      /דמי.*ניהול.*הפקדה/,
      /ד\.?נ.*הפקדה/,
      /מהפקדה/,
      /הפקדות/,
    ])
  );
}

function detectAccumulationFee(row) {
  return normalizeNumber(
    getByHeader(row, [
      /דמי.*ניהול.*צבירה/,
      /ד\.?נ.*צבירה/,
      /מצבירה/,
      /צבירה/,
    ])
  );
}

export function parseAgreements(
  workbook
) {
  if (!workbook) return [];

  const agreements = [];

  workbook.SheetNames.forEach(
    (sheetName) => {
      const sheet =
        workbook.Sheets[sheetName];

      const rows =
        XLSX.utils.sheet_to_json(
          sheet,
          {
            header: 1,
            defval: "",
          }
        );

      if (!rows.length) return;

      const headerIndex =
        findHeaderIndex(rows);

      const objects = makeObjects(
        rows,
        headerIndex
      );

      objects
        .filter(isPensionAgreement)
        .forEach((row) => {
          agreements.push({
            sheetName,

            manager:
              detectManager(row),

            depositFee:
              detectDepositFee(row),

            accumulationFee:
              detectAccumulationFee(
                row
              ),

            raw: row,
          });
        });
    }
  );

  return agreements;
}
