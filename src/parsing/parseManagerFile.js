# src/parsing/parseManagerFile.js
# CORE HARDENING v19 — Integration Guide

המטרה:
לשלב parsingReport בתוך תוצאת parseManagerFile בלי לשבור את השימושים הקיימים.

────────────────────────────────────
1. להוסיף import
────────────────────────────────────

בראש הקובץ:

import { buildParsingConfidenceReport } from "./parsingConfidence";

אם הפרויקט משתמש בסיומת js מלאה ב-import:

import { buildParsingConfidenceReport } from "./parsingConfidence.js";

────────────────────────────────────
2. לזהות מה parseManagerFile מחזיר היום
────────────────────────────────────

יש שני מצבים נפוצים:

מצב א':
parseManagerFile מחזיר מערך rows:

return unifiedRows;

מצב ב':
parseManagerFile מחזיר אובייקט:

return {
  rows: unifiedRows,
  audit,
  ...
};

────────────────────────────────────
3. אם הקובץ מחזיר מערך בלבד
────────────────────────────────────

להחליף:

return unifiedRows;

ב:

const parsingReport = buildParsingConfidenceReport({
  rawRows,
  unifiedRows,
  detectedHeaders,
  requiredHeaders,
  missingRequiredHeaders,
  aliasMatchedHeaders,
  invalidRows,
  managerName,
  fileName: file?.name || "",
});

unifiedRows.parsingReport = parsingReport;

return unifiedRows;

הערה:
זה פתרון backward-compatible יחסית, כי עדיין מוחזר מערך.
אבל עדיף לטווח ארוך לעבור לאובייקט מסודר.

────────────────────────────────────
4. אם הקובץ כבר מחזיר אובייקט
────────────────────────────────────

להחליף:

return {
  rows: unifiedRows,
  audit,
};

ב:

const parsingReport = buildParsingConfidenceReport({
  rawRows,
  unifiedRows,
  detectedHeaders,
  requiredHeaders,
  missingRequiredHeaders,
  aliasMatchedHeaders,
  invalidRows,
  managerName,
  fileName: file?.name || "",
});

return {
  rows: unifiedRows,
  audit,
  parsingReport,
};

────────────────────────────────────
5. אם אין כרגע detectedHeaders
────────────────────────────────────

אפשר להתחיל זמנית כך:

const detectedHeaders = Object.keys(rawRows?.[0] || {});

ואז:

const parsingReport = buildParsingConfidenceReport({
  rawRows,
  unifiedRows,
  detectedHeaders,
  managerName,
  fileName: file?.name || "",
});

────────────────────────────────────
6. אם אין rawRows
────────────────────────────────────

אם יש רק unifiedRows:

const parsingReport = buildParsingConfidenceReport({
  rawRows: unifiedRows,
  unifiedRows,
  detectedHeaders,
  managerName,
  fileName: file?.name || "",
});

זה פחות מדויק אבל עדיין נותן UI ראשוני.

────────────────────────────────────
7. דוגמה מלאה מינימלית
────────────────────────────────────

import { buildParsingConfidenceReport } from "./parsingConfidence";

export async function parseManagerFile(file, options = {}) {
  const managerName = options.managerName || "";

  const rawRows = await readXlsxRows(file);
  const detectedHeaders = Object.keys(rawRows?.[0] || {});

  const unifiedRows = rawToUnifiedRows(rawRows, {
    managerName,
  });

  const parsingReport = buildParsingConfidenceReport({
    rawRows,
    unifiedRows,
    detectedHeaders,
    managerName,
    fileName: file?.name || "",
  });

  return {
    rows: unifiedRows,
    parsingReport,
  };
}

────────────────────────────────────
8. בדיקת Build
────────────────────────────────────

אחרי השילוב:

npm run build

אם יש שגיאת import:
לבדוק האם הפרויקט דורש:
"./parsingConfidence"
או:
"./parsingConfidence.js"

────────────────────────────────────
9. Stop Checkpoint
────────────────────────────────────

לא להמשיך ל-v20 לפני:
- upload עובד
- dashboard לא קורס
- report מופיע לכל קובץ
- קובץ בעייתי מציג warning
- build עובר

