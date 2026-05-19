function DropUpload({ title, file, onFile }) {
  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) onFile(droppedFile);
  };

  return (
    <label
      className="uploadBox"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <span>{title}</span>
      <small>גרור קובץ לכאן או לחץ לבחירה</small>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />

      {file && <p className="fileName">נבחר: {file.name}</p>}
    </label>
  );
}

export default function UploadPanel({ files, setFiles, onStart }) {
  const canStart = files.dataFile && files.agreementsFile;

  return (
    <section className="card">
      <h2>העלאת קבצים</h2>

      <DropUpload
        title="דוח נתונים - מנהלי הסדר"
        file={files.dataFile}
        onFile={(file) => setFiles((prev) => ({ ...prev, dataFile: file }))}
      />

      <DropUpload
        title="דוח הסכמים"
        file={files.agreementsFile}
        onFile={(file) =>
          setFiles((prev) => ({ ...prev, agreementsFile: file }))
        }
      />

      <button className="primaryButton" disabled={!canStart} onClick={onStart}>
        התחל ניתוח
      </button>

      {!canStart && (
        <p className="hint">יש להעלות דוח נתונים ודוח הסכמים לפני התחלת ניתוח.</p>
      )}
    </section>
  );
}
