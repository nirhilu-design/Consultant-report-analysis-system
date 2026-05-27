// Path: src/components/UploadPanel.jsx
import { useMemo, useState } from "react";
import {
  buildUploadProgress,
  canStartAnalysis,
  createManager,
  hasRequiredFiles,
  normalizeFilesState,
  normalizeManagers,
} from "../upload/uploadSessionModel.js";

const FILE_SLOTS = [
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

function isExcelFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "xlsx" || ext === "xls";
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function normalizeFileName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function guessSlotKey(file, currentManager) {
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

function FileStatusIcon({ file, required }) {
  if (file) return <span className="uploadStatusIcon success">✓</span>;
  if (required) return <span className="uploadStatusIcon required">!</span>;
  return <span className="uploadStatusIcon optional">+</span>;
}

function DropUpload({
  slot,
  file,
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

  return (
    <label
      className={[
        "uploadBox",
        file ? "hasFile" : "",
        active ? "dragActive" : "",
        slot.required ? "requiredSlot" : "optionalSlot",
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
        <p className="uploadHint">Excel בלבד · xlsx / xls</p>
      )}
    </label>
  );
}

export default function UploadPanel({ files, setFiles, onStart, isAnalyzing = false }) {
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

  function setFileForSlot(managerId, slotKey, file) {
    setError("");

    if (file && !isExcelFile(file)) {
      setError("אפשר להעלות רק קובצי Excel מסוג xlsx או xls.");
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

    setError("");

    if (!droppedFiles.length) return;

    if (!excelFiles.length) {
      setError("לא זוהה קובץ Excel. יש להעלות קובצי xlsx או xls בלבד.");
      return;
    }

    updateManagers((currentManagers) => {
      const nextManagers = currentManagers.map((manager) => ({ ...manager }));
      const managerIndex = Math.max(
        0,
        nextManagers.findIndex((manager) => manager.id === forcedManagerId)
      );

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
