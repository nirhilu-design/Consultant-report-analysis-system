// Path: src/components/UploadPanel.jsx
// CORE HARDENING v19A
// Purpose: keep the existing upload architecture, add safe hooks for ParsingQualityPanel,
// and avoid creating UploadArea.jsx / UploadCard.jsx duplicates.

import { useMemo, useState } from "react";
import ParsingQualityPanel from "./ParsingQualityPanel.jsx";
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

function FileStatusIcon({ file, required }) {
  if (file) return <span className="uploadStatusIcon success">✓</span>;
  if (required) return <span className="uploadStatusIcon required">!</span>;
  return <span className="uploadStatusIcon optional">+</span>;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeParsingReport(report, manager) {
  if (!report) return null;

  const score = Number(report.score ?? report.confidenceScore ?? 0);
  const rawStatus = report.level || report.status || "";

  let level = rawStatus;
  if (rawStatus === "high") level = "excellent";
  if (rawStatus === "medium") level = "partial";
  if (rawStatus === "low") level = "risky";

  if (!level) {
    if (score >= 90) level = "excellent";
    else if (score >= 75) level = "good";
    else if (score >= 55) level = "partial";
    else level = "risky";
  }

  const title =
    report.title ||
    (level === "excellent"
      ? "קליטה מצוינת"
      : level === "good"
        ? "קליטה תקינה"
        : level === "partial"
          ? "קליטה חלקית"
          : "קליטה דורשת בדיקה");

  const detectedHeaders = asArray(report.detectedHeaders);
  const requiredHeaders = asArray(report.requiredHeaders);
  const missingRequiredHeaders = asArray(report.missingRequiredHeaders || report.missingHeaders);
  const aliasMatchedHeaders = asArray(report.aliasMatchedHeaders);
  const checks = asArray(report.checks);

  const generatedWarnings = checks
    .filter((check) => check && !check.passed && !check.optional)
    .map((check) => `בדיקה לא עברה: ${check.label || check.key || "שלב לא מזוהה"}`);

  const warnings = [...asArray(report.warnings), ...generatedWarnings].filter(Boolean);

  return {
    ...report,
    score,
    level,
    title,
    managerName: report.managerName || manager?.name || "",
    fileName: report.fileName || manager?.dataFile?.name || "",
    rowCount:
      report.rowCount ??
      report.summary?.rowCount ??
      report.counts?.unifiedRows ??
      report.counts?.rawPensionRows ??
      0,
    detectedHeaders,
    requiredHeaders,
    missingRequiredHeaders,
    aliasMatchedHeaders,
    warnings,
    summary: {
      ...(report.summary || {}),
      detectedHeaderCount:
        report.summary?.detectedHeaderCount ??
        detectedHeaders.length ??
        0,
      requiredHeaderCount:
        report.summary?.requiredHeaderCount ??
        requiredHeaders.length ??
        0,
      aliasMatchedHeaderCount:
        report.summary?.aliasMatchedHeaderCount ??
        aliasMatchedHeaders.length ??
        0,
    },
  };
}

function getManagerParsingReport(manager, managerResults = []) {
  const directReport =
    manager?.parsingReport ||
    manager?.parsingConfidence ||
    manager?.qualityReport ||
    null;

  if (directReport) return normalizeParsingReport(directReport, manager);

  const result = asArray(managerResults).find((item) => {
    if (!item || !manager) return false;
    return (
      item.managerId === manager.id ||
      item.id === manager.id ||
      item.managerName === manager.name ||
      item.name === manager.name
    );
  });

  const resultReport =
    result?.parsingReport ||
    result?.parsingConfidence ||
    result?.qualityReport ||
    null;

  return normalizeParsingReport(resultReport, manager);
}

function DropUpload({
  slot,
  file,
  isDragging,
  dragTarget,
  targetKey,
  disabled,
  onFile,
  onRemove,
  onDragEnterSlot,
  onDragLeaveSlot,
  onDropSlot,
}) {
  const active = isDragging && dragTarget === targetKey;

  return (
    <label
      className={[
        "uploadBox",
        file ? "hasFile" : "",
        active ? "dragActive" : "",
        slot.required ? "requiredSlot" : "optionalSlot",
        disabled ? "disabledUploadBox" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragEnter={(event) => {
        if (!disabled) onDragEnterSlot(event, targetKey);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) onDragEnterSlot(event, targetKey);
      }}
      onDragLeave={(event) => {
        if (!disabled) onDragLeaveSlot(event, targetKey);
      }}
      onDrop={(event) => {
        if (!disabled) onDropSlot(event, targetKey);
      }}
    >
      <input
        type="file"
        accept=".xlsx,.xls"
        disabled={disabled}
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
            disabled={disabled}
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
        <p className="uploadHint">Excel בלבד · xlsx / xls</p>
      )}
    </label>
  );
}

export default function UploadPanel({
  files,
  setFiles,
  onStart,
  isAnalyzing = false,
  managerResults = [],
}) {
  const normalizedFiles = normalizeFilesState(files);
  const managers = normalizeManagers(normalizedFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(null);
  const [error, setError] = useState("");

  const progress = useMemo(() => {
    return buildUploadProgress(normalizedFiles, FILE_SLOTS);
  }, [normalizedFiles]);

  const canStart = canStartAnalysis(normalizedFiles);

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

  function clearManagerParsingState(manager) {
    return {
      ...manager,
      parsingReport: null,
      parsingConfidence: null,
      qualityReport: null,
      parsingError: null,
    };
  }

  function setFileForSlot(managerId, slotKey, file) {
    setError("");

    if (file && !isExcelFile(file)) {
      setError("אפשר להעלות רק קובצי Excel מסוג xlsx או xls.");
      return;
    }

    updateManagers((currentManagers) =>
      currentManagers.map((manager) =>
        manager.id === managerId
          ? clearManagerParsingState({ ...manager, [slotKey]: file })
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
        return currentManagers.map((manager) =>
          clearManagerParsingState({
            ...manager,
            dataFile: null,
            agreementsFile: null,
            personalDetailsFile: null,
          })
        );
      }

      return currentManagers.filter((manager) => manager.id !== managerId);
    });
    setError("");
  }

  function clearManager(managerId) {
    updateManagers((currentManagers) =>
      currentManagers.map((manager) =>
        manager.id === managerId
          ? clearManagerParsingState({
              ...manager,
              dataFile: null,
              agreementsFile: null,
              personalDetailsFile: null,
            })
          : manager
      )
    );
    setError("");
  }

  function assignDroppedFiles(fileList, forcedManagerId = null, forcedSlotKey = null) {
    const droppedFiles = Array.from(fileList || []);
    const excelFiles = droppedFiles.filter(isExcelFile);

    setError("");

    if (!droppedFiles.length) return;

    if (!excelFiles.length) {
      setError("לא זוהה קובץ Excel. יש להעלות קובצי xlsx או xls בלבד.");
      return;
    }

    updateManagers((currentManagers) => {
      const nextManagers = currentManagers.map((manager) => ({ ...manager }));
      const foundIndex = nextManagers.findIndex((manager) => manager.id === forcedManagerId);
      const managerIndex = foundIndex >= 0 ? foundIndex : 0;

      if (forcedSlotKey && excelFiles.length === 1) {
        nextManagers[managerIndex] = clearManagerParsingState({
          ...nextManagers[managerIndex],
          [forcedSlotKey]: excelFiles[0],
        });
        return nextManagers;
      }

      for (const file of excelFiles) {
        const targetManager = nextManagers[managerIndex] || nextManagers[0];
        const slotKey = guessSlotKey(file, targetManager);
        targetManager[slotKey] = file;
        Object.assign(targetManager, clearManagerParsingState(targetManager));
      }

      return nextManagers;
    });

    if (droppedFiles.length !== excelFiles.length) {
      setError("חלק מהקבצים לא נקלטו כי אינם קובצי Excel.");
    }
  }

  function handlePageDragOver(event) {
    event.preventDefault();
    if (!isAnalyzing) setIsDragging(true);
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

    if (isAnalyzing) return;
    assignDroppedFiles(event.dataTransfer.files, managers[0]?.id);
  }

  function handleSlotDragEnter(event, targetKey) {
    event.preventDefault();
    if (isAnalyzing) return;
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

    if (isAnalyzing) return;

    const [managerId, slotKey] = targetKey.split("::");
    assignDroppedFiles(event.dataTransfer.files, managerId, slotKey);
  }

  function clearAllFiles() {
    updateManagers((currentManagers) =>
      currentManagers.map((manager) =>
        clearManagerParsingState({
          ...manager,
          dataFile: null,
          agreementsFile: null,
          personalDetailsFile: null,
        })
      )
    );
    setError("");
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

      <div className="uploadGlobalDropZone">
        <div className="uploadGlobalIcon">⇪</div>
        <div>
          <strong>אפשר לגרור קבצים לתוך מנהל ההסדר הרלוונטי</strong>
          <span>
            מנהל ריק לא חוסם התחלת ניתוח. רק מנהל שהתחלת להזין בו קבצים חייב לכלול דוח נתונים ודוח הסכמים.
          </span>
        </div>
      </div>

      <div className="managerUploadList">
        {managers.map((manager, managerIndex) => {
          const managerComplete = hasRequiredFiles(manager);
          const parsingReport = getManagerParsingReport(manager, managerResults);

          return (
            <div className="managerUploadCard" key={manager.id}>
              <div className="managerUploadHeader">
                <div>
                  <span className={managerComplete ? "managerStatus ready" : "managerStatus missing"}>
                    {managerComplete ? "מוכן לניתוח" : "חסרים קבצי חובה"}
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

              <div className="uploadGrid managerUploadGrid">
                {FILE_SLOTS.map((slot) => {
                  const targetKey = `${manager.id}::${slot.key}`;

                  return (
                    <DropUpload
                      key={slot.key}
                      slot={slot}
                      file={manager[slot.key]}
                      isDragging={isDragging}
                      dragTarget={dragTarget}
                      targetKey={targetKey}
                      disabled={isAnalyzing}
                      onFile={(file) => setFileForSlot(manager.id, slot.key, file)}
                      onRemove={() => setFileForSlot(manager.id, slot.key, null)}
                      onDragEnterSlot={handleSlotDragEnter}
                      onDragLeaveSlot={handleSlotDragLeave}
                      onDropSlot={handleSlotDrop}
                    />
                  );
                })}
              </div>

              {parsingReport && (
                <ParsingQualityPanel report={parsingReport} />
              )}
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
            onClick={onStart}
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
          לכל מנהל הסדר פעיל יש להעלות לפחות דוח נתונים ודוח הסכמים לפני התחלת הניתוח. מנהלים ריקים נשארים כטיוטה ולא חוסמים את ההרצה.
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
