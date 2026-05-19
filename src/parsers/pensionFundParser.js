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

function sheetLooksLikePension(sheetName) {
  return /פנסיה|מקיפה|משלימה|קרן/.test(
    normalizeText(sheetName)
  );
}

function findHeaderIndex(rows) {
  const maxRowsToScan = Math.min(
    rows.length,
    35
  );

  let bestIndex = 0;
  let bestScore = -1;

  for (
    let i = 0;
    i < maxRowsToScan;
    i += 1
  ) {
    const text = rowToText(rows[i]);

    let score = 0;

    if (/שם.*עובד|עובד|ת\.?ז|זהות/.test(text)) score += 1;
    if (/יצרן|חברה|גוף|מנהל|שם.*קרן|שם.*קופה/.test(text)) score += 3;
    if (/מוצר|סוג.*מוצר|שם.*מוצר|תוכנית|תכנית|קרן|קופה/.test(text)) score += 2;
    if (/פנסיה|מקיפה|משלימה/.test(text)) score += 2;
    if (/דמי.*ניהול|ד\.?נ|צבירה|הפקדה|מצבירה|מהפקדה/.test(text)) score += 3;
    if (/מסלול|שארים|ויתור/.test(text)) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
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
    ([header, value]) =>
      patterns.some((pattern) =>
        pattern.test(
          normalizeText(header)
        )
      ) &&
      normalizeText(value)
  );

  return entry ? entry[1] : "";
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
  const directValue = getByHeader(row, [
    /^יצרן$/,
    /שם.*יצרן/,
    /יצרן.*פנסיה/,
    /חברה.*מנהלת/,
    /^חברה$/,
    /שם.*חברה/,
    /גוף.*מנהל/,
    /שם.*גוף/,
    /שם.*קרן/,
    /קרן.*פנסיה/,
    /קופה/,
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

function detectProductType(row, sheetName) {
  const text = normalizeText(
    `${sheetName} ${row.__text}`
  );

  if (/משלימה|כללית/.test(text)) {
    return "משלימה";
  }

  if (/מקיפה/.test(text)) {
    return "מקיפה";
  }

  return "קרן פנסיה";
}

function detectInsuranceWaiver(row) {
  const waiverValue = getByHeader(row, [
    /ויתור.*שארים/,
    /שארים/,
    /מסלול.*ביטוח/,
    /כיסוי.*שארים/,
  ]);

  const text = normalizeText(
    `${waiverValue} ${row.__text}`
  );

  if (
    /ויתור.*מלא|קיים.*ויתור.*מלא|ויתור.*שארים.*מלא/.test(
      text
    )
  ) {
    return "קיים ויתור מלא";
  }

  if (
    /בת זוג בלבד|בן זוג בלבד|ויתור.*בת זוג|ויתור.*בן זוג/.test(
      text
    )
  ) {
    return "ויתור על בת זוג בלבד";
  }

  if (
    /לא קיים.*ויתור|אין.*ויתור|ללא.*ויתור/.test(
      text
    )
  ) {
    return "לא קיים ויתור שארים";
  }

  return "חסר נתון";
}

function detectAccumulation(row) {
  return normalizeNumber(
    getByHeader(row, [
      /צבירה/,
      /יתרה/,
      /חיסכון/,
      /ערך.*פדיון/,
      /סה.*כ.*חיסכון/,
    ])
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
    ])
  );
}

function detectTrack(row) {
  return normalizeText(
    getByHeader(row, [
      /מסלול/,
      /אפיק/,
      /שם.*מסלול/,
    ])
  );
}

function hasRealData(row) {
  const text = normalizeText(row.__text);

  if (!text) return false;

  const nonEmptyCells = row.__raw.filter(
    (cell) => normalizeText(cell)
  ).length;

  return nonEmptyCells >= 3;
}

function rowLooksLikePension(row, sheetName) {
  if (sheetLooksLikePension(sheetName)) {
    return hasRealData(row);
  }

  const text = normalizeText(row.__text);

  return /פנסיה|מקיפה|משלימה|קרן פנסיה/.test(text);
}

export function parsePensionFund(
  workbook
) {
  if (!workbook) return [];

  const allRows = [];

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
        .filter((row) =>
          rowLooksLikePension(
            row,
            sheetName
          )
        )
        .forEach((row) => {
          const originalManager =
            detectOriginalManager(row);

          allRows.push({
            sheetName,

            manager: originalManager,

            originalManager,

            productType:
              detectProductType(
                row,
                sheetName
              ),

            insuranceWaiver:
              detectInsuranceWaiver(row),

            accumulation:
              detectAccumulation(row),

            depositFee:
              detectDepositFee(row),

            accumulationFee:
              detectAccumulationFee(row),

            track:
              detectTrack(row),

            raw: row,
          });
        });
    }
  );

  console.log(
    "parsePensionFund result:",
    {
      rows: allRows.length,
      sample: allRows.slice(0, 5),
    }
  );

  return allRows;
}
