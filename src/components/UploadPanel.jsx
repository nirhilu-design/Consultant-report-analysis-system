// Path: src/components/UploadPanel.jsx
import { useMemo, useState } from "react";

const FILE_SLOTS = [
  {
    key: "dataFile",
    title: "דוח נתונים",
    subtitle: "דוח יועץ / מנהלי הסדר",
    required: true,
    badge: "חובה",
    keywords: [
      "דוח יועץ",
      "יועץ",
      "נתונים",
      "קרן פנסיה",
      "פנסיה",
      "data",
      "pension",
    ],
  },
  {
    key: "agreementsFile",
    title: "דוח הסכמים",
    subtitle: "הסכמי דמי ניהול",
    required: true,
    badge: "חובה",
    keywords: [
      "הסכמים",
      "הסכם",
      "דמי ניהול",
      "agreements",
      "agreement",
    ],
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

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function normalizeFileName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[״"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function guessSlotKey(file, currentFiles) {
  const name = normalizeFileName(file?.name);

  if (!name) return null;

  const scored = FILE_SLOTS.map((slot) => {
    const score = slot.keywords.reduce((sum, keyword) => {
      return name.includes(normalizeFileName(keyword)) ? sum + 1 : sum;
    }, 0);

    return {
      key: slot.key,
      score,
      alreadyHasFile: Boolean(currentFiles?.[slot.key]),
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(a.alreadyHasFile) - Number(b.alreadyHasFile);
    });

  if (scored.length) return scored[0].key;

  const emptySlot = FILE_SLOTS.find((slot) => !currentFiles?.[slot.key]);

  return emptySlot?.key || "dataFile";
}

function FileStatusIcon({ file, required }) {
  if (file) {
    return <span className="uploadStatusIcon success">✓</span>;
  }

  if (required) {
    return <span className="uploadStatusIcon required">!</span>;
  }

  return <span className="uploadStatusIcon optional">+</span>;
}

function DropUpload({
  slot,
  file,
  isDragging,
  dragTarget,
  onFile,
  onRemove,
  onDragEnterSlot,
  onDragLeaveSlot,
  onDropSlot,
}) {
  const active = isDragging && dragTarget === slot.key;

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
      onDragEnter={(event) => onDragEnterSlot(event, slot.key)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragEnterSlot(event, slot.key);
      }}
      onDragLeave={(event) => onDragLeaveSlot(event, slot.key)}
      onDrop={(event) => onDropSlot(event, slot.key)}
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

      <div className="uploadDropHint">
        {file ? "קובץ נבחר" : "גרור לכאן או לחץ לבחירה"}
      </div>

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
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(null);
  const [error, setError] = useState("");

  const canStart = Boolean(files.dataFile && files.agreementsFile);

  const progress = useMemo(() => {
    const uploaded = FILE_SLOTS.filter((slot) => Boolean(files[slot.key])).length;
    return {
      uploaded,
      total: FILE_SLOTS.length,
      percent: Math.round((uploaded / FILE_SLOTS.length) * 100),
    };
  }, [files]);

  function setFileForSlot(slotKey, file) {
    setError("");

    if (file && !isExcelFile(file)) {
      setError("אפשר להעלות רק קובצי Excel מסוג xlsx או xls.");
      return;
    }

    setFiles((prev) => ({
      ...prev,
      [slotKey]: file,
    }));
  }

  function assignDroppedFiles(fileList, forcedSlotKey = null) {
    const droppedFiles = Array.from(fileList || []);
    const excelFiles = droppedFiles.filter(isExcelFile);

    setError("");

    if (!droppedFiles.length) return;

    if (!excelFiles.length) {
      setError("לא זוהה קובץ Excel. יש להעלות קובצי xlsx או xls בלבד.");
      return;
    }

    setFiles((prev) => {
      const next = { ...prev };

      if (forcedSlotKey && excelFiles.length === 1) {
        next[forcedSlotKey] = excelFiles[0];
        return next;
      }

      for (const file of excelFiles) {
        const slotKey = guessSlotKey(file, next);
        next[slotKey] = file;
      }

      return next;
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
    assignDroppedFiles(event.dataTransfer.files);
  }

  function handleSlotDragEnter(event, slotKey) {
    event.preventDefault();
    setIsDragging(true);
    setDragTarget(slotKey);
  }

  function handleSlotDragLeave(event, slotKey) {
    event.preventDefault();

    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget;

    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    if (dragTarget === slotKey) {
      setDragTarget(null);
    }
  }

  function handleSlotDrop(event, slotKey) {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);
    setDragTarget(null);

    assignDroppedFiles(event.dataTransfer.files, slotKey);
  }

  function clearAllFiles() {
    setFiles({
      dataFile: null,
      agreementsFile: null,
      personalDetailsFile: null,
    });

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
          <h2>העלאת קבצים לניתוח</h2>
          <p>
            העלה את דוח הנתונים ודוח ההסכמים. קובץ הפרטים האישיים מומלץ כדי
            לקבל ניתוח עשיר ומדויק יותר.
          </p>
        </div>

        <div className="uploadProgressCard">
          <strong>
            {progress.uploaded}/{progress.total}
          </strong>
          <span>קבצים נבחרו</span>
          <div className="uploadProgressBar">
            <div style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      </div>

      <div className="uploadGlobalDropZone">
        <div className="uploadGlobalIcon">⇪</div>
        <div>
          <strong>אפשר לגרור לכאן את כל הקבצים יחד</strong>
          <span>
            המערכת תנסה לשייך אוטומטית לפי שם הקובץ: נתונים, הסכמים, פרטים אישיים.
          </span>
        </div>
      </div>

      <div className="uploadGrid">
        {FILE_SLOTS.map((slot) => (
          <DropUpload
            key={slot.key}
            slot={slot}
            file={files[slot.key]}
            isDragging={isDragging}
            dragTarget={dragTarget}
            onFile={(file) => setFileForSlot(slot.key, file)}
            onRemove={() => setFileForSlot(slot.key, null)}
            onDragEnterSlot={handleSlotDragEnter}
            onDragLeaveSlot={handleSlotDragLeave}
            onDropSlot={handleSlotDrop}
          />
        ))}
      </div>

      {error && <div className="errorBox">{error}</div>}

      <div className="uploadActions">
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

      {!canStart && (
        <p className="hint">
          יש להעלות לפחות דוח נתונים ודוח הסכמים לפני התחלת הניתוח.
        </p>
      )}

      {canStart && !files.personalDetailsFile && (
        <p className="hint">
          קובץ פרטים אישיים לא חובה, אבל מומלץ כדי להציג שם, גיל, מצב משפחתי
          וחיבור טוב יותר לעובדים.
        </p>
      )}

      {canStart && files.personalDetailsFile && (
        <p className="successHint">
          כל הקבצים הדרושים נקלטו. אפשר להתחיל ניתוח.
        </p>
      )}
    </section>
  );
}
