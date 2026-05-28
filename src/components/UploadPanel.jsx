// Path: src/components/UploadPanel.jsx
// CORE HARDENING v24
// Full file replacement — Advanced Upload Validation / Pre-Backend Readiness
//
// Notes:
// - No backend dependency.
// - No localStorage/session persistence.
// - Keeps current architecture: managers + FILE_SLOTS.
// - Does not change Dashboard or analytics.
// - Adds upload validation summary per manager.

import { useMemo, useState } from "react";
import {
  buildUploadProgress,
  canStartAnalysis,
  createManager,
  hasRequiredFiles,
  normalizeFilesState,
  normalizeManagers,
} from "../upload/uploadSessionModel.js";
import {
  FILE_SLOTS,
  formatFileSize,
  guessSlotKey,
  isExcelFile,
} from "../upload/uploadFileSlots.js";
import UploadStatusSummary from "./UploadStatusSummary.jsx";
import ProductModeSelector, { PRODUCT_MODES, getProductModeLabel } from "./ProductModeSelector.jsx";

function FileStatusIcon({ file, required }) {
  if (file) return <span className="uploadStatusIcon success">✓</span>;
  if (required) return <span className="uploadStatusIcon required">!</span>;
  return <span className="uploadStatusIcon optional">+</span>;
}

function getFileExtension(fileName = "") {
  const parts = String(fileName).toLowerCase().split(".");
  return parts.length > 1 ? `.${parts.pop()}` : "";
}

function validateFileObject(file) {
  if (!file) {
    return {
      valid: false,
      status: "missing",
      errors: ["לא נבחר קובץ."],
    };
  }

  const errors = [];

  if (!isExcelFile(file)) {
    errors.push("סוג הקובץ אינו נתמך. יש להעלות xlsx, xls או xlsm בלבד.");
  }

  if (Number(file.size || 0) <= 0) {
    errors.push("הקובץ ריק או לא תקין.");
  }

  return {
    valid: errors.length === 0,
    status: errors.length ? "invalid" : "ready",
    errors,
    extension: getFileExtension(file.name),
    fileName: file.name,
    fileSize: file.size,
  };
}

function validateManagerFiles(manager) {
  const slotResults = FILE_SLOTS.map((slot) => {
    const file = manager?.[slot.key] || null;
    const fileValidation = validateFileObject(file);

    const valid = slot.required
      ? fileValidation.valid
      : !file || fileValidation.valid;

    const errors = [];

    if (slot.required && !file) {
      errors.push(`חסר ${slot.title}.`);
    }

    if (file && fileValidation.errors.length) {
      errors.push(...fileValidation.errors);
    }

    return {
      key: slot.key,
      title: slot.title,
      required: Boolean(slot.required),
      hasFile: Boolean(file),
      valid,
      status: valid ? (file ? "ready" : "optional") : file ? "invalid" : "missing",
      errors,
      fileName: file?.name || "",
      fileSize: file?.size || 0,
    };
  });

  const requiredSlots = slotResults.filter((slot) => slot.required);
  const requiredReady = requiredSlots.filter((slot) => slot.valid && slot.hasFile).length;
  const invalidSlots = slotResults.filter((slot) => !slot.valid);
  const uploadedSlots = slotResults.filter((slot) => slot.hasFile);

  let status = "EMPTY";
  let label = "טרם הועלו קבצים";
  let tone = "neutral";

  if (invalidSlots.length === 0 && requiredReady === requiredSlots.length) {
    status = "READY";
    label = "מוכן לניתוח";
    tone = "ready";
  } else if (uploadedSlots.length > 0) {
    status = "PARTIAL";
    label = "חסרים קבצי חובה";
    tone = "partial";
  } else {
    status = "EMPTY";
    label = "ממתין לקבצים";
    tone = "neutral";
  }

  if (invalidSlots.some((slot) => slot.hasFile)) {
    status = "INVALID";
    label = "יש קובץ לא תקין";
    tone = "invalid";
  }

  return {
    valid: status === "READY",
    status,
    label,
    tone,
    slotResults,
    requiredReady,
    requiredTotal: requiredSlots.length,
    uploadedCount: uploadedSlots.length,
    invalidCount: invalidSlots.length,
  };
}

function DropUpload({
  slot,
  file,
  validation,
  isDragging,
  dragTarget,
  targetKey,
  onFile,
  onRemove,
  onDragEnterSlot,
  onDragLeaveSlot,
  onDropSlot,
}) {
  const active = isDragging && dragTarget === targetKey;
  const hasErrors = Boolean(validation?.errors?.length);

  return (
    <label
      className={[
        "uploadBox",
        file ? "hasFile" : "",
        active ? "dragActive" : "",
        slot.required ? "requiredSlot" : "optionalSlot",
        hasErrors ? "uploadBoxInvalid" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragEnter={(event) => onDragEnterSlot(event, targetKey)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragEnterSlot(event, targetKey);
      }}
      onDragLeave={(event) => onDragLeaveSlot(event, targetKey)}
      onDrop={(event) => onDropSlot(event, targetKey)}
    >
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(event) => {
          onFile(event.target.files?.[0] || null);
          event.currentTarget.value = "";
        }}
      />

      <div className="uploadBoxTop">
        <FileStatusIcon file={file} required={slot.required} />

        <div className="uploadBoxText">
          <div className="uploadTitleRow">
            <strong>{slot.title}</strong>
            <span className={slot.required ? "slotBadge required" : "slotBadge optional"}>
              {slot.badge}
            </span>
          </div>
          <span>{slot.subtitle}</span>
        </div>
      </div>

      <div className="uploadDropHint">{file ? "קובץ נבחר" : "גרור לכאן או לחץ לבחירה"}</div>

      {file ? (
        <div className="selectedFileCard">
          <div>
            <strong>{file.name}</strong>
            <span>{formatFileSize(file.size)}</span>
          </div>

          <button
            type="button"
            className="removeFileButton"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }}
          >
            הסר
          </button>
        </div>
      ) : (
        <p className="uploadHint">Excel בלבד · xlsx / xls / xlsm</p>
      )}

      {hasErrors && (
        <div className="uploadSlotErrors">
          {validation.errors.map((message, index) => (
            <span key={`${slot.key}-error-${index}`}>{message}</span>
          ))}
        </div>
      )}
    </label>
  );
}

export default function UploadPanel({ files, setFiles, onStart, isAnalyzing = false }) {
  const normalizedFiles = normalizeFilesState(files);
  const productMode = normalizedFiles.productMode || PRODUCT_MODES.PENSION;
  const managers = normalizeManagers(normalizedFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(null);
  const [error, setError] = useState("");

  const progress = useMemo(() => {
    return buildUploadProgress(normalizedFiles, FILE_SLOTS);
  }, [normalizedFiles]);

  const managerValidations = useMemo(() => {
    return managers.map((manager) => ({
      managerId: manager.id,
      validation: validateManagerFiles(manager),
    }));
  }, [managers]);

  const hasInvalidUploadedFiles = managerValidations.some(({ validation }) => {
    return validation.status === "INVALID";
  });

  const canStart = canStartAnalysis(normalizedFiles) && !hasInvalidUploadedFiles;

  function getManagerValidation(managerId) {
    return managerValidations.find((item) => item.managerId === managerId)?.validation;
  }


  function setProductMode(productModeValue) {
    setFiles((prev) => ({
      ...normalizeFilesState(prev),
      productMode: productModeValue,
    }));
    setError("");
  }

  function updateManagers(updater) {
    setFiles((prev) => {
      const currentState = normalizeFilesState(prev);
      const currentManagers = normalizeManagers(currentState);
      const nextManagers = updater(currentManagers).map((manager, index) => ({
        ...manager,
        name: manager.name || `מנהל הסדר ${index + 1}`,
      }));

      return {
        ...currentState,
        managers: nextManagers,
      };
    });
  }

  function setManagerName(managerId, name) {
    updateManagers((currentManagers) =>
      currentManagers.map((manager) =>
        manager.id === managerId
          ? { ...manager, name }
          : manager
      )
    );
  }

  function setFileForSlot(managerId, slotKey, file) {
    setError("");

    if (file && !isExcelFile(file)) {
      setError("אפשר להעלות רק קובצי Excel מסוג xlsx או xls.");
      return;
    }

    if (file && Number(file.size || 0) <= 0) {
      setError("הקובץ שנבחר ריק או לא תקין.");
      return;
    }

    updateManagers((currentManagers) =>
      currentManagers.map((manager) =>
        manager.id === managerId
          ? { ...manager, [slotKey]: file }
          : manager
      )
    );
  }

  function addManager() {
    updateManagers((currentManagers) => [
      ...currentManagers,
      createManager(currentManagers.length + 1),
    ]);
    setError("");
  }

  function removeManager(managerId) {
    updateManagers((currentManagers) => {
      if (currentManagers.length <= 1) {
        return currentManagers.map((manager) => ({
          ...manager,
          dataFile: null,
          agreementsFile: null,
          personalDetailsFile: null,
        }));
      }

      return currentManagers.filter((manager) => manager.id !== managerId);
    });
    setError("");
  }

  function clearManager(managerId) {
    updateManagers((currentManagers) =>
      currentManagers.map((manager) =>
        manager.id === managerId
          ? {
              ...manager,
              dataFile: null,
              agreementsFile: null,
              personalDetailsFile: null,
            }
          : manager
      )
    );
    setError("");
  }

  function assignDroppedFiles(fileList, forcedManagerId = null, forcedSlotKey = null) {
    const droppedFiles = Array.from(fileList || []);
    const excelFiles = droppedFiles.filter(isExcelFile);
    const emptyFiles = droppedFiles.filter((file) => Number(file.size || 0) <= 0);

    setError("");

    if (!droppedFiles.length) return;

    if (emptyFiles.length) {
      setError("חלק מהקבצים לא נקלטו כי הם ריקים או לא תקינים.");
      return;
    }

    if (!excelFiles.length) {
      setError("לא זוהה קובץ Excel. יש להעלות קובצי xlsx, xls או xlsm בלבד.");
      return;
    }

    updateManagers((currentManagers) => {
      const nextManagers = currentManagers.map((manager) => ({ ...manager }));
      const foundManagerIndex = nextManagers.findIndex((manager) => manager.id === forcedManagerId);
      const managerIndex = foundManagerIndex >= 0 ? foundManagerIndex : 0;

      if (forcedSlotKey && excelFiles.length === 1) {
        nextManagers[managerIndex][forcedSlotKey] = excelFiles[0];
        return nextManagers;
      }

      for (const file of excelFiles) {
        const targetManager = nextManagers[managerIndex] || nextManagers[0];
        const slotKey = guessSlotKey(file, targetManager);
        targetManager[slotKey] = file;
      }

      return nextManagers;
    });

    if (droppedFiles.length !== excelFiles.length) {
      setError("חלק מהקבצים לא נקלטו כי אינם קובצי Excel.");
    }
  }

  function handlePageDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handlePageDragLeave(event) {
    if (event.currentTarget === event.target) {
      setIsDragging(false);
      setDragTarget(null);
    }
  }

  function handlePageDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    setDragTarget(null);
    assignDroppedFiles(event.dataTransfer.files, managers[0]?.id);
  }

  function handleSlotDragEnter(event, targetKey) {
    event.preventDefault();
    setIsDragging(true);
    setDragTarget(targetKey);
  }

  function handleSlotDragLeave(event, targetKey) {
    event.preventDefault();
    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget;

    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) return;
    if (dragTarget === targetKey) setDragTarget(null);
  }

  function handleSlotDrop(event, targetKey) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    setDragTarget(null);

    const [managerId, slotKey] = targetKey.split("::");
    assignDroppedFiles(event.dataTransfer.files, managerId, slotKey);
  }

  function clearAllFiles() {
    updateManagers((currentManagers) =>
      currentManagers.map((manager) => ({
        ...manager,
        dataFile: null,
        agreementsFile: null,
        personalDetailsFile: null,
      }))
    );
    setError("");
  }

  function handleStartAnalysis() {
    setError("");

    if (hasInvalidUploadedFiles) {
      setError("יש קובץ לא תקין. יש להסיר אותו או להעלות קובץ Excel תקין לפני התחלת הניתוח.");
      return;
    }

    if (!canStartAnalysis(normalizedFiles)) {
      setError("חסרים קבצי חובה. לכל מנהל הסדר פעיל נדרש קלט מידע וקלט הסכמים.");
      return;
    }

    onStart();
  }

  return (
    <section
      className={`card uploadPanel ${isDragging ? "uploadPanelDragging" : ""}`}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      <div className="uploadHeader">
        <div>
          <p className="eyebrow">Upload Center</p>
          <h2>העלאת קבצים לפי מנהלי הסדר</h2>
          <p>
            לכל מנהל הסדר יש דוח נתונים ודוח הסכמים משלו. אפשר להוסיף מנהלי
            הסדר, להסיר מנהל, או לנקות קבצים של מנהל ספציפי.
          </p>
        </div>

        <div className="uploadProgressCard">
          <strong>
            {progress.requiredUploaded}/{progress.requiredTotal}
          </strong>
          <span>קבצי חובה נבחרו</span>
          <div className="uploadProgressBar">
            <div style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      </div>

      <ProductModeSelector
        value={productMode}
        onChange={setProductMode}
        disabled={isAnalyzing}
      />

      <div className="uploadGlobalDropZone">
        <div className="uploadGlobalIcon">⇪</div>
        <div>
          <strong>אפשר לגרור קבצים לתוך מנהל ההסדר הרלוונטי</strong>
          <span>
            מצב נוכחי: {getProductModeLabel(productMode)}. מנהל ריק לא חוסם התחלת ניתוח. רק מנהל שהתחלת להזין בו קבצים חייב לכלול קלט מידע ודוח הסכמים.
          </span>
        </div>
      </div>

      <div className="managerUploadList">
        {managers.map((manager, managerIndex) => {
          const managerValidation = getManagerValidation(manager.id);
          const managerComplete = hasRequiredFiles(manager) && managerValidation?.status !== "INVALID";

          return (
            <div className="managerUploadCard" key={manager.id}>
              <div className="managerUploadHeader">
                <div>
                  <span className={managerComplete ? "managerStatus ready" : "managerStatus missing"}>
                    {managerComplete ? "מוכן לניתוח" : managerValidation?.label || "חסרים קבצי חובה"}
                  </span>
                  <input
                    className="managerNameInput"
                    value={manager.name}
                    onChange={(event) => setManagerName(manager.id, event.target.value)}
                    placeholder={`מנהל הסדר ${managerIndex + 1}`}
                    disabled={isAnalyzing}
                  />
                </div>

                <div className="managerUploadActions">
                  <button
                    type="button"
                    className="secondaryButton smallButton"
                    onClick={() => clearManager(manager.id)}
                    disabled={isAnalyzing}
                  >
                    נקה מנהל
                  </button>

                  <button
                    type="button"
                    className="dangerButton smallButton"
                    onClick={() => removeManager(manager.id)}
                    disabled={isAnalyzing}
                  >
                    הסר
                  </button>
                </div>
              </div>

              <UploadStatusSummary validation={managerValidation} />

              <div className="uploadGrid managerUploadGrid">
                {FILE_SLOTS.map((slot) => {
                  const targetKey = `${manager.id}::${slot.key}`;
                  const slotValidation = managerValidation?.slotResults?.find(
                    (item) => item.key === slot.key
                  );

                  return (
                    <DropUpload
                      key={slot.key}
                      slot={slot}
                      file={manager[slot.key]}
                      validation={slotValidation}
                      isDragging={isDragging}
                      dragTarget={dragTarget}
                      targetKey={targetKey}
                      onFile={(file) => setFileForSlot(manager.id, slot.key, file)}
                      onRemove={() => setFileForSlot(manager.id, slot.key, null)}
                      onDragEnterSlot={handleSlotDragEnter}
                      onDragLeaveSlot={handleSlotDragLeave}
                      onDropSlot={handleSlotDrop}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="errorBox">{error}</div>}

      <div className="uploadActions uploadActionsSplit">
        <button
          className="secondaryButton"
          onClick={addManager}
          type="button"
          disabled={isAnalyzing}
        >
          + הוסף מנהל הסדר
        </button>

        <div className="uploadActionsLeft">
          <button
            className="primaryButton"
            disabled={!canStart || isAnalyzing}
            onClick={handleStartAnalysis}
            type="button"
          >
            {isAnalyzing ? "מנתח..." : "התחל ניתוח"}
          </button>

          <button
            className="secondaryButton"
            onClick={clearAllFiles}
            type="button"
            disabled={!progress.uploaded || isAnalyzing}
          >
            נקה קבצים
          </button>
        </div>
      </div>

      {!canStart && (
        <p className="hint">
          לכל מנהל הסדר פעיל יש להעלות לפחות קלט מידע וקלט הסכמים לפני התחלת הניתוח. מנהלים ריקים נשארים כטיוטה ולא חוסמים את ההרצה.
        </p>
      )}

      {canStart && (
        <p className="successHint">
          כל מנהלי ההסדר מוכנים. אפשר להתחיל ניתוח משותף או להוסיף מנהל נוסף.
        </p>
      )}
    </section>
  );
}
