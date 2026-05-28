// Path: src/upload/uploadSessionModel.js
// CORE HARDENING v26C
// Upload Session Model with Product Mode support

export const DEFAULT_MANAGER_ID = "manager_1";

export const PRODUCT_MODES = {
  PENSION: "pension",
  HISHTALMUT: "hishtalmut",
};

export const DEFAULT_PRODUCT_MODE = PRODUCT_MODES.PENSION;

export const FILE_SLOT_KEYS = ["dataFile", "agreementsFile", "personalDetailsFile"];

export const REQUIRED_FILE_SLOT_KEYS = ["dataFile", "agreementsFile"];

export function normalizeProductMode(productMode) {
  if (productMode === PRODUCT_MODES.HISHTALMUT) return PRODUCT_MODES.HISHTALMUT;
  return PRODUCT_MODES.PENSION;
}

export function createManager(index = 1) {
  return {
    id: `manager_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `מנהל הסדר ${index}`,
    dataFile: null,
    agreementsFile: null,
    personalDetailsFile: null,
    status: "draft",
    warnings: [],
  };
}

export function createDefaultManager() {
  return {
    id: DEFAULT_MANAGER_ID,
    name: "מנהל הסדר 1",
    dataFile: null,
    agreementsFile: null,
    personalDetailsFile: null,
    status: "draft",
    warnings: [],
  };
}

export function createUploadSessionId() {
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createInitialFilesState() {
  return {
    uploadSessionId: createUploadSessionId(),
    uploadSessionVersion: "CORE_HARDENING_v26C",
    productMode: DEFAULT_PRODUCT_MODE,
    managers: [createDefaultManager()],
  };
}

export function hasAnyFile(manager) {
  return FILE_SLOT_KEYS.some((slotKey) => Boolean(manager?.[slotKey]));
}

export function hasRequiredFiles(manager) {
  return REQUIRED_FILE_SLOT_KEYS.every((slotKey) => Boolean(manager?.[slotKey]));
}

export function getManagerStatus(manager) {
  if (hasRequiredFiles(manager)) return "ready";
  if (hasAnyFile(manager)) return "incomplete";
  return "draft";
}

export function normalizeManager(manager, index = 0) {
  const normalized = {
    id: manager?.id || `manager_${index + 1}`,
    name: manager?.name || `מנהל הסדר ${index + 1}`,
    dataFile: manager?.dataFile || null,
    agreementsFile: manager?.agreementsFile || null,
    personalDetailsFile: manager?.personalDetailsFile || null,
    warnings: Array.isArray(manager?.warnings) ? manager.warnings : [],
  };

  return {
    ...normalized,
    status: getManagerStatus(normalized),
  };
}

export function normalizeManagers(filesState) {
  if (Array.isArray(filesState?.managers) && filesState.managers.length) {
    return filesState.managers.map(normalizeManager);
  }

  return [
    normalizeManager(
      {
        ...createDefaultManager(),
        dataFile: filesState?.dataFile || null,
        agreementsFile: filesState?.agreementsFile || null,
        personalDetailsFile: filesState?.personalDetailsFile || null,
      },
      0
    ),
  ];
}

export function normalizeFilesState(filesState) {
  return {
    uploadSessionId: filesState?.uploadSessionId || createUploadSessionId(),
    uploadSessionVersion: filesState?.uploadSessionVersion || "CORE_HARDENING_v26C",
    productMode: normalizeProductMode(filesState?.productMode),
    managers: normalizeManagers(filesState),
  };
}

export function setProductModeOnFilesState(filesState, productMode) {
  const normalized = normalizeFilesState(filesState);

  return {
    ...normalized,
    productMode: normalizeProductMode(productMode),
  };
}

export function getActiveManagers(filesState) {
  const managers = normalizeManagers(filesState);
  const activeManagers = managers.filter(hasAnyFile);
  return activeManagers.length ? activeManagers : managers;
}

export function getManagersReadyForAnalysis(filesState) {
  return getActiveManagers(filesState).filter(hasRequiredFiles);
}

export function getInvalidManagersForAnalysis(filesState) {
  return getActiveManagers(filesState).filter((manager) => !hasRequiredFiles(manager));
}

export function canStartAnalysis(filesState) {
  const activeManagers = getActiveManagers(filesState);
  return activeManagers.length > 0 && activeManagers.every(hasRequiredFiles);
}

export function buildUploadProgress(filesState, fileSlots = FILE_SLOT_KEYS) {
  const managers = normalizeManagers(filesState);
  const activeManagers = managers.filter(hasAnyFile);
  const managersForProgress = activeManagers.length ? activeManagers : managers;
  const requiredSlots = fileSlots.filter((slot) => slot.required || REQUIRED_FILE_SLOT_KEYS.includes(slot.key || slot));

  const uploaded = managersForProgress.reduce((sum, manager) => {
    return sum + fileSlots.filter((slot) => Boolean(manager[slot.key || slot])).length;
  }, 0);

  const total = managersForProgress.length * fileSlots.length;

  const requiredUploaded = managersForProgress.reduce((sum, manager) => {
    return sum + requiredSlots.filter((slot) => Boolean(manager[slot.key || slot])).length;
  }, 0);

  const requiredTotal = managersForProgress.length * requiredSlots.length;

  return {
    uploaded,
    total,
    requiredUploaded,
    requiredTotal,
    percent: total ? Math.round((uploaded / total) * 100) : 0,
    activeManagers: activeManagers.length,
    totalManagers: managers.length,
    readyManagers: managers.filter(hasRequiredFiles).length,
    incompleteManagers: managers.filter((manager) => hasAnyFile(manager) && !hasRequiredFiles(manager)).length,
    draftManagers: managers.filter((manager) => !hasAnyFile(manager)).length,
  };
}

export function snapshotUploadSession(filesState) {
  const normalized = normalizeFilesState(filesState);
  const activeManagers = getActiveManagers(normalized);

  return {
    id: normalized.uploadSessionId,
    version: normalized.uploadSessionVersion,
    productMode: normalized.productMode,
    managerCount: normalized.managers.length,
    activeManagerCount: activeManagers.length,
    readyManagerCount: normalized.managers.filter(hasRequiredFiles).length,
    incompleteManagerCount: normalized.managers.filter((manager) => hasAnyFile(manager) && !hasRequiredFiles(manager)).length,
    draftManagerCount: normalized.managers.filter((manager) => !hasAnyFile(manager)).length,
    managers: normalized.managers.map((manager) => ({
      id: manager.id,
      name: manager.name,
      status: getManagerStatus(manager),
      hasDataFile: Boolean(manager.dataFile),
      hasAgreementsFile: Boolean(manager.agreementsFile),
      hasPersonalDetailsFile: Boolean(manager.personalDetailsFile),
      files: {
        dataFile: manager.dataFile?.name || "",
        agreementsFile: manager.agreementsFile?.name || "",
        personalDetailsFile: manager.personalDetailsFile?.name || "",
      },
    })),
  };
}
