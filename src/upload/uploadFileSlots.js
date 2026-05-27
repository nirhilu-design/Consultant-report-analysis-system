// Path: src/upload/uploadFileSlots.js

export const FILE_SLOTS = [
  {
    key: "dataFile",
    title: "דוח נתונים",
    subtitle: "דוח יועץ / מנהלי הסדר",
    required: true,
    badge: "חובה",
    keywords: ["דוח יועץ", "יועץ", "נתונים", "קרן פנסיה", "פנסיה", "data", "pension"],
  },
  {
    key: "agreementsFile",
    title: "דוח הסכמים",
    subtitle: "הסכמי דמי ניהול",
    required: true,
    badge: "חובה",
    keywords: ["הסכמים", "הסכם", "דמי ניהול", "agreements", "agreement"],
  },
  {
    key: "personalDetailsFile",
    title: "פרטים אישיים",
    subtitle: "קובץ עובדים / פרטי לקוחות",
    required: false,
    badge: "מומלץ",
    keywords: [
      "פרטים אישיים",
      "פרטים אישים",
      "אישי",
      "אישים",
      "עובדים",
      "לקוחות",
      "personal",
      "details",
      "employees",
      "clients",
    ],
  },
];

export function isExcelFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "xlsx" || ext === "xls";
}

export function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function normalizeFileName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function guessSlotKey(file, currentManager) {
  const name = normalizeFileName(file?.name);
  if (!name) return null;

  const scored = FILE_SLOTS.map((slot) => {
    const score = slot.keywords.reduce((sum, keyword) => {
      return name.includes(normalizeFileName(keyword)) ? sum + 1 : sum;
    }, 0);

    return {
      key: slot.key,
      score,
      alreadyHasFile: Boolean(currentManager?.[slot.key]),
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(a.alreadyHasFile) - Number(b.alreadyHasFile);
    });

  if (scored.length) return scored[0].key;

  const emptySlot = FILE_SLOTS.find((slot) => !currentManager?.[slot.key]);
  return emptySlot?.key || "dataFile";
}
