// Path: src/upload/uploadSessionModel.js
// CORE HARDENING v27
// Multi Product Upload Session Model

export const DEFAULT_MANAGER_ID = "manager_1";

export const PRODUCT_MODES = {
  PENSION: "pension",
  HISHTALMUT: "hishtalmut",
  EXECUTIVE_INSURANCE: "executiveInsurance",
};

export const DEFAULT_PRODUCT_MODE = PRODUCT_MODES.PENSION;

export const FILE_SLOT_KEYS = ["dataFile", "agreementsFile", "personalDetailsFile"];
export const REQUIRED_FILE_SLOT_KEYS = ["dataFile", "agreementsFile"];

export function normalizeProductMode(productMode) {
  if (productMode === PRODUCT_MODES.HISHTALMUT) return PRODUCT_MODES.HISHTALMUT;
  if (productMode === PRODUCT_MODES.EXECUTIVE_INSURANCE) return PRODUCT_MODES.EXECUTIVE_INSURANCE;
  return PRODUCT_MODES.PENSION;
}

export function createEmptyProductFiles() {
  return {
    dataFile: null,
    agreementsFile: null,
    personalDetailsFile: null,
  };
}

export function createProductsState(existingProducts = {}) {
  return {
    [PRODUCT_MODES.PENSION]: {
      ...createEmptyProductFiles(),
      ...(existingProducts?.[PRODUCT_MODES.PENSION] || {}),
    },
    [PRODUCT_MODES.HISHTALMUT]: {
      ...createEmptyProductFiles(),
      ...(existingProducts?.[PRODUCT_MODES.HISHTALMUT] || {}),
    },
    [PRODUCT_MODES.EXECUTIVE_INSURANCE]: {
      ...createEmptyProductFiles(),
      ...(existingProducts?.[PRODUCT_MODES.EXECUTIVE_INSURANCE] || {}),
    },
  };
}

export function createManager(index = 1) {
  return {
    id: `manager_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `מנהל הסדר ${index}`,
    products: createProductsState(),
    warnings: [],
  };
}

export function createDefaultManager() {
  return {
    id: DEFAULT_MANAGER_ID,
    name: "מנהל הסדר 1",
    products: createProductsState(),
    warnings: [],
  };
}

export function createUploadSessionId() {
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createInitialFilesState() {
  return {
    uploadSessionId: createUploadSessionId(),
    uploadSessionVersion: "CORE_HARDENING_v27",
    activeProductMode: DEFAULT_PRODUCT_MODE,
    productMode: DEFAULT_PRODUCT_MODE,
    managers: [createDefaultManager()],
  };
}

export function getProductFiles(manager, productMode = DEFAULT_PRODUCT_MODE) {
  const mode = normalizeProductMode(productMode);

  if (manager?.products?.[mode]) {
    return {
      ...createEmptyProductFiles(),
      ...manager.products[mode],
    };
  }

  // Backward compatibility: old top-level slots are treated as pension files.
  if (mode === PRODUCT_MODES.PENSION) {
    return {
      dataFile: manager?.dataFile || null,
      agreementsFile: manager?.agreementsFile || null,
      personalDetailsFile: manager?.personalDetailsFile || null,
    };
  }

  return createEmptyProductFiles();
}

export function setProductFile(manager, productMode, slotKey, file) {
  const mode = normalizeProductMode(productMode);
  const products = createProductsState(manager?.products);
  const productFiles = {
    ...createEmptyProductFiles(),
    ...products[mode],
    [slotKey]: file || null,
  };

  const nextManager = {
    ...manager,
    products: {
      ...products,
      [mode]: productFiles,
    },
  };

  // Compatibility mirror: keep pension files on top-level for older callers.
  const pensionFiles = mode === PRODUCT_MODES.PENSION
    ? productFiles
    : getProductFiles(nextManager, PRODUCT_MODES.PENSION);

  return {
    ...nextManager,
    dataFile: pensionFiles.dataFile,
    agreementsFile: pensionFiles.agreementsFile,
    personalDetailsFile: pensionFiles.personalDetailsFile,
  };
}

export function clearProductFiles(manager, productMode) {
  const mode = normalizeProductMode(productMode);
  const products = createProductsState(manager?.products);

  const nextManager = {
    ...manager,
    products: {
      ...products,
      [mode]: createEmptyProductFiles(),
    },
  };

  const pensionFiles = getProductFiles(nextManager, PRODUCT_MODES.PENSION);

  return {
    ...nextManager,
    dataFile: pensionFiles.dataFile,
    agreementsFile: pensionFiles.agreementsFile,
    personalDetailsFile: pensionFiles.personalDetailsFile,
  };
}

export function clearAllProductsFiles(manager) {
  return {
    ...manager,
    products: createProductsState(),
    dataFile: null,
    agreementsFile: null,
    personalDetailsFile: null,
  };
}

export function hasAnyFile(manager, productMode = null) {
  if (productMode) {
    const productFiles = getProductFiles(manager, productMode);
    return FILE_SLOT_KEYS.some((slotKey) => Boolean(productFiles[slotKey]));
  }

  return Object.values(PRODUCT_MODES).some((mode) => hasAnyFile(manager, mode));
}

export function hasRequiredFiles(manager, productMode = DEFAULT_PRODUCT_MODE) {
  const productFiles = getProductFiles(manager, productMode);
  return REQUIRED_FILE_SLOT_KEYS.every((slotKey) => Boolean(productFiles[slotKey]));
}

export function getManagerStatus(manager, productMode = DEFAULT_PRODUCT_MODE) {
  if (hasRequiredFiles(manager, productMode)) return "ready";
  if (hasAnyFile(manager, productMode)) return "incomplete";
  return "draft";
}

export function normalizeManager(manager, index = 0) {
  const products = createProductsState(manager?.products);

  if (manager?.dataFile && !products[PRODUCT_MODES.PENSION].dataFile) {
    products[PRODUCT_MODES.PENSION].dataFile = manager.dataFile;
  }

  if (manager?.agreementsFile && !products[PRODUCT_MODES.PENSION].agreementsFile) {
    products[PRODUCT_MODES.PENSION].agreementsFile = manager.agreementsFile;
  }

  if (manager?.personalDetailsFile && !products[PRODUCT_MODES.PENSION].personalDetailsFile) {
    products[PRODUCT_MODES.PENSION].personalDetailsFile = manager.personalDetailsFile;
  }

  const normalized = {
    id: manager?.id || `manager_${index + 1}`,
    name: manager?.name || `מנהל הסדר ${index + 1}`,
    products,
    warnings: Array.isArray(manager?.warnings) ? manager.warnings : [],
  };

  const pensionFiles = getProductFiles(normalized, PRODUCT_MODES.PENSION);

  return {
    ...normalized,
    dataFile: pensionFiles.dataFile,
    agreementsFile: pensionFiles.agreementsFile,
    personalDetailsFile: pensionFiles.personalDetailsFile,
    status: hasAnyFile(normalized) ? "active" : "draft",
  };
}

export function normalizeManagers(filesState) {
  if (Array.isArray(filesState?.managers) && filesState.managers.length) {
    return filesState.managers.map(normalizeManager);
  }

  return [
    normalizeManager({
      ...createDefaultManager(),
      dataFile: filesState?.dataFile || null,
      agreementsFile: filesState?.agreementsFile || null,
      personalDetailsFile: filesState?.personalDetailsFile || null,
    }),
  ];
}

export function normalizeFilesState(filesState) {
  const activeProductMode = normalizeProductMode(filesState?.activeProductMode || filesState?.productMode);

  return {
    uploadSessionId: filesState?.uploadSessionId || createUploadSessionId(),
    uploadSessionVersion: filesState?.uploadSessionVersion || "CORE_HARDENING_v27",
    activeProductMode,
    productMode: activeProductMode,
    managers: normalizeManagers(filesState),
  };
}

export function setProductModeOnFilesState(filesState, productMode) {
  const normalized = normalizeFilesState(filesState);
  const activeProductMode = normalizeProductMode(productMode);

  return {
    ...normalized,
    activeProductMode,
    productMode: activeProductMode,
  };
}

export function hydrateManagerForProduct(manager, productMode) {
  const productFiles = getProductFiles(manager, productMode);

  return {
    ...manager,
    productMode: normalizeProductMode(productMode),
    dataFile: productFiles.dataFile,
    agreementsFile: productFiles.agreementsFile,
    personalDetailsFile: productFiles.personalDetailsFile,
    status: getManagerStatus(manager, productMode),
  };
}

export function getActiveManagers(filesState, productMode = null) {
  const normalized = normalizeFilesState(filesState);
  const mode = normalizeProductMode(productMode || normalized.activeProductMode);
  const managers = normalizeManagers(normalized);
  const activeManagers = managers.filter((manager) => hasAnyFile(manager, mode));
  const selectedManagers = activeManagers.length ? activeManagers : managers;

  return selectedManagers.map((manager) => hydrateManagerForProduct(manager, mode));
}

export function getManagersReadyForAnalysis(filesState, productMode = null) {
  const normalized = normalizeFilesState(filesState);
  const mode = normalizeProductMode(productMode || normalized.activeProductMode);

  return getActiveManagers(normalized, mode).filter((manager) => hasRequiredFiles(manager, mode));
}

export function getInvalidManagersForAnalysis(filesState, productMode = null) {
  const normalized = normalizeFilesState(filesState);
  const mode = normalizeProductMode(productMode || normalized.activeProductMode);

  return getActiveManagers(normalized, mode).filter((manager) => !hasRequiredFiles(manager, mode));
}

export function canStartAnalysis(filesState, productMode = null) {
  const normalized = normalizeFilesState(filesState);
  const mode = normalizeProductMode(productMode || normalized.activeProductMode);
  const activeManagers = getActiveManagers(normalized, mode);

  return activeManagers.length > 0 && activeManagers.every((manager) => hasRequiredFiles(manager, mode));
}

export function buildUploadProgress(filesState, fileSlots = FILE_SLOT_KEYS, productMode = null) {
  const normalized = normalizeFilesState(filesState);
  const mode = normalizeProductMode(productMode || normalized.activeProductMode);
  const managers = normalizeManagers(normalized);

  const activeManagers = managers.filter((manager) => hasAnyFile(manager, mode));
  const managersForProgress = activeManagers.length ? activeManagers : managers;

  const requiredSlots = fileSlots.filter((slot) => {
    const key = slot.key || slot;
    return slot.required || REQUIRED_FILE_SLOT_KEYS.includes(key);
  });

  const uploaded = managersForProgress.reduce((sum, manager) => {
    const productFiles = getProductFiles(manager, mode);
    return sum + fileSlots.filter((slot) => Boolean(productFiles[slot.key || slot])).length;
  }, 0);

  const total = managersForProgress.length * fileSlots.length;

  const requiredUploaded = managersForProgress.reduce((sum, manager) => {
    const productFiles = getProductFiles(manager, mode);
    return sum + requiredSlots.filter((slot) => Boolean(productFiles[slot.key || slot])).length;
  }, 0);

  const requiredTotal = managersForProgress.length * requiredSlots.length;

  return {
    productMode: mode,
    uploaded,
    total,
    requiredUploaded,
    requiredTotal,
    percent: total ? Math.round((uploaded / total) * 100) : 0,
    activeManagers: activeManagers.length,
    totalManagers: managers.length,
    readyManagers: managers.filter((manager) => hasRequiredFiles(manager, mode)).length,
    incompleteManagers: managers.filter((manager) => hasAnyFile(manager, mode) && !hasRequiredFiles(manager, mode)).length,
    draftManagers: managers.filter((manager) => !hasAnyFile(manager, mode)).length,
  };
}

export function getProductUploadOverview(filesState) {
  const normalized = normalizeFilesState(filesState);
  const managers = normalizeManagers(normalized);

  return Object.values(PRODUCT_MODES).map((mode) => {
    const activeManagers = managers.filter((manager) => hasAnyFile(manager, mode));
    const readyManagers = activeManagers.filter((manager) => hasRequiredFiles(manager, mode));

    return {
      productMode: mode,
      activeManagers: activeManagers.length,
      readyManagers: readyManagers.length,
      hasFiles: activeManagers.length > 0,
      ready: activeManagers.length > 0 && activeManagers.length === readyManagers.length,
    };
  });
}

export function snapshotUploadSession(filesState) {
  const normalized = normalizeFilesState(filesState);
  const managers = normalizeManagers(normalized);
  const mode = normalized.activeProductMode;

  return {
    id: normalized.uploadSessionId,
    version: normalized.uploadSessionVersion,
    activeProductMode: mode,
    productMode: mode,
    productOverview: getProductUploadOverview(normalized),
    managerCount: managers.length,
    activeManagerCount: managers.filter((manager) => hasAnyFile(manager, mode)).length,
    readyManagerCount: managers.filter((manager) => hasRequiredFiles(manager, mode)).length,
    incompleteManagerCount: managers.filter((manager) => hasAnyFile(manager, mode) && !hasRequiredFiles(manager, mode)).length,
    draftManagerCount: managers.filter((manager) => !hasAnyFile(manager, mode)).length,
    managers: managers.map((manager) => {
      const products = {};

      Object.values(PRODUCT_MODES).forEach((productMode) => {
        const productFiles = getProductFiles(manager, productMode);

        products[productMode] = {
          status: getManagerStatus(manager, productMode),
          hasDataFile: Boolean(productFiles.dataFile),
          hasAgreementsFile: Boolean(productFiles.agreementsFile),
          hasPersonalDetailsFile: Boolean(productFiles.personalDetailsFile),
          files: {
            dataFile: productFiles.dataFile?.name || "",
            agreementsFile: productFiles.agreementsFile?.name || "",
            personalDetailsFile: productFiles.personalDetailsFile?.name || "",
          },
        };
      });

      return {
        id: manager.id,
        name: manager.name,
        status: getManagerStatus(manager, mode),
        products,
      };
    }),
  };
}
