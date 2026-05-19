import { useState } from "react";

export default function UploadPanel() {
  const [fileName, setFileName] = useState("");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
  };

  return (
    <div className="card">
      <h2>העלאת קובץ אקסל</h2>

      <input type="file" accept=".xlsx,.xls" onChange={handleFile} />

      {fileName && (
        <p>הקובץ שנבחר: {fileName}</p>
      )}
    </div>
  );
}
