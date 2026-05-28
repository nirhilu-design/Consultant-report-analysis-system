// src/upload/uploadValidationEngine.js
// CORE HARDENING v24

export const SUPPORTED_FILE_TYPES = [
  ".xlsx",
  ".xls",
  ".csv",
];

export function isSupportedFile(fileName = "") {
  const lower = String(fileName).toLowerCase();
  return SUPPORTED_FILE_TYPES.some((ext) => lower.endsWith(ext));
}

export function validateUploadSlot(slot = {}) {
  const errors = [];

  if (!slot.file) {
    errors.push("לא נבחר קובץ.");
    return {
      valid: false,
      errors,
      status: "missing",
    };
  }

  if (!isSupportedFile(slot.file.name)) {
    errors.push("סוג הקובץ אינו נתמך.");
  }

  return {
    valid: errors.length === 0,
    errors,
    status: errors.length ? "invalid" : "ready",
  };
}

export function validateManagerUpload(manager = {}) {
  const slots = Array.isArray(manager.slots) ? manager.slots : [];

  const slotResults = slots.map(validateUploadSlot);

  const invalidCount = slotResults.filter((s) => !s.valid).length;

  return {
    valid: invalidCount === 0,
    status:
      invalidCount === 0
        ? "READY"
        : invalidCount === slotResults.length
        ? "INVALID"
        : "PARTIAL",
    slotResults,
  };
}
