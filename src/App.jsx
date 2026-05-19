import { useState } from "react";
import UploadPanel from "./components/UploadPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";
import "./styles.css";

export default function App() {
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [files, setFiles] = useState({
    dataFile: null,
    agreementsFile: null,
  });

  return (
    <main className="app" dir="rtl">
      {!analysisStarted ? (
        <>
          <section className="hero">
            <h1>מערכת ניתוח דוח יועץ פנסיוני</h1>
            <p>העלה דוח נתונים ודוח הסכמים, ולאחר מכן הפעל ניתוח.</p>
          </section>

          <UploadPanel
            files={files}
            setFiles={setFiles}
            onStart={() => setAnalysisStarted(true)}
          />
        </>
      ) : (
        <Dashboard files={files} />
      )}
    </main>
  );
}
