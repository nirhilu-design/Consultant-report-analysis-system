# src/upload/uploadSessionModel.js
# CORE HARDENING v19 — Integration Guide

המטרה:
להרחיב את upload slot כך שיכיל metadata של parsing בלי לשבור את המבנה הקיים.

────────────────────────────────────
מבנה slot מומלץ
────────────────────────────────────

{
  id: "slot-1",
  title: "קובץ פנסיה",
  file: null,
  rows: [],
  parsingReport: null,
  parsingError: null,
  isParsing: false
}

────────────────────────────────────
אם יש פונקציה createUploadSlot
────────────────────────────────────

לעדכן אותה כך:

export function createUploadSlot(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    title: overrides.title || "קובץ",
    file: null,
    rows: [],
    parsingReport: null,
    parsingError: null,
    isParsing: false,
    ...overrides,
  };
}

────────────────────────────────────
אם אין crypto.randomUUID בתמיכה
────────────────────────────────────

אפשר להשתמש ב:

function createId(prefix = "slot") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

ואז:

id: overrides.id || createId("slot"),

────────────────────────────────────
פונקציות עזר מומלצות
────────────────────────────────────

export function attachFileToSlot(slot, file) {
  return {
    ...slot,
    file,
    rows: [],
    parsingReport: null,
    parsingError: null,
    isParsing: true,
  };
}

export function attachParsingResultToSlot(slot, result) {
  const rows = Array.isArray(result) ? result : result?.rows || [];
  const parsingReport = Array.isArray(result)
    ? result.parsingReport || null
    : result?.parsingReport || null;

  return {
    ...slot,
    rows,
    parsingReport,
    parsingError: null,
    isParsing: false,
  };
}

export function attachParsingErrorToSlot(slot, error) {
  return {
    ...slot,
    parsingError: error?.message || "שגיאה בקליטת הקובץ",
    isParsing: false,
  };
}

export function clearUploadSlot(slot) {
  return {
    ...slot,
    file: null,
    rows: [],
    parsingReport: null,
    parsingError: null,
    isParsing: false,
  };
}

────────────────────────────────────
עקרון חשוב
────────────────────────────────────

לא לשנות את שמות השדות הקיימים אם Dashboard או App.jsx מסתמכים עליהם.

אם יש היום:
uploadedFile
במקום:
file

אז לא למחוק uploadedFile.
אפשר להוסיף file בנוסף או לשמור את השם הקיים.

לדוגמה:

return {
  ...slot,
  uploadedFile: file,
  file,
  rows: [],
  parsingReport: null,
  isParsing: true,
};

────────────────────────────────────
Stop Checkpoint
────────────────────────────────────

אחרי שינוי uploadSessionModel:

1. npm run build
2. העלאת קובץ אחד
3. הוספת מנהל הסדר שני
4. הסרת קובץ
5. בדיקה שה-Dashboard עדיין מקבל rows

