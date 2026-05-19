import UploadPanel from "./components/UploadPanel.jsx";
import "./styles.css";

export default function App() {
  return (
    <main className="app" dir="rtl">
      <section className="hero">
        <h1>מערכת ניתוח דוח יועץ פנסיוני</h1>
        <p>העלאת דוח נתונים ודוח הסכמים לצורך ניתוח ראשוני.</p>
      </section>

      <UploadPanel />
    </main>
  );
}
