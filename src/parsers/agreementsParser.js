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
    25
  );

  for (
    let i = 0;
    i < maxRowsToScan;
    i += 1
  ) {
    const text = rowToText(rows[i]);

    const hasManager =
      /יצרן|חברה|גוף|מנהל|קרן/.test(
        text
      );

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
      obj.__headers = headers;
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

function getFirstNonEmptyByHeader(
  row,
  patterns
) {
  const entries = Object.entries(row).filter(
    ([header, value]) =>
      patterns.some((pattern) =>
        pattern.test(
          normalizeText(header)
        )
      ) &&
      normalizeText(value)
  );

  return entries.length
    ? entries[0][1]
    : "";
}

function cleanManagerName(value) {
  const text = normalizeText(value)
    .replace(/^קרן\s+/g, "")
    .replace(/^חברת\s+/g, "")
    .replace(/^חברה\s+מנהלת\s*/g, "")
    .replace(/בע"מ/g, "")
    .replace(/בעמ/g, "")
    .replace(/\s+-\s+.*$/g, "")
    .trim();

  return text;
}

function detectOriginalManager(row) {
  const directValue =
    getFirstNonEmptyByHeader(row, [
      /^יצרן$/,
      /שם.*יצרן/,
      /חברה.*מנהלת/,
      /^חברה$/,
      /שם.*חברה/,
      /גוף.*מנהל/,
      /שם.*גוף/,
      /שם.*קרן/,
      /קרן.*פנסיה/,
    ]);

  if (normalizeText(directValue)) {
    return cleanManagerName(directValue);
  }

  const text = normalizeText(row.__text);

  const knownMatch = [
    "הפניקס",
    "פניקס",
    "הראל",
    "כלל",
    "מקפת",
    "מגדל",
    "מבטחים",
    "מנורה",
    "מיטב",
    "אלטשולר",
    "מור",
    "אינפיניטי",
    "ילין",
    "אנליסט",
    "איילון",
    "הכשרה",
    "פסגות",
  ].find((name) => text.includes(name));

  return knownMatch || "לא מזוהה";
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
          const originalManager =
            detectOriginalManager(row);

          agreements.push({
            sheetName,

            // בכוונה נשמר שם יצרן מקורי.
            // הסיווג הסופי מתבצע ב-buildPensionSummary.
            manager: originalManager,

            originalManager,

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
