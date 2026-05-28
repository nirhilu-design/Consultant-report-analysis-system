// src/components/UploadStatusSummary.jsx
import React from "react";

export default function UploadStatusSummary({ validation }) {
  if (!validation) return null;

  return (
    <section className="uploadStatusSummary" dir="rtl">
      <strong>מצב העלאה: {validation.status}</strong>

      {validation.slotResults?.length > 0 && (
        <ul>
          {validation.slotResults.map((slot, index) => (
            <li key={index}>
              {slot.valid ? "✓ תקין" : "✕ לא תקין"}
              {slot.errors?.length > 0 && ` — ${slot.errors.join(", ")}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
