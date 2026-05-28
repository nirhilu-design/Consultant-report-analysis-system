// Path: src/components/UploadStatusSummary.jsx
// CORE HARDENING v24
// Full file — Advanced Upload Validation Summary
//
// Purpose:
// Display manager-level upload readiness:
// READY / PARTIAL / INVALID / EMPTY
//
// This component is presentation-only.
// It does not mutate upload state and does not depend on backend/security.

import React from "react";

function getStatusLabel(status, fallbackLabel) {
  if (fallbackLabel) return fallbackLabel;

  switch (status) {
    case "READY":
      return "מוכן לניתוח";
    case "PARTIAL":
      return "חסרים קבצי חובה";
    case "INVALID":
      return "יש קובץ לא תקין";
    case "EMPTY":
    default:
      return "ממתין לקבצים";
  }
}

function getToneClass(tone, status) {
  if (tone) return tone;

  switch (status) {
    case "READY":
      return "ready";
    case "PARTIAL":
      return "partial";
    case "INVALID":
      return "invalid";
    case "EMPTY":
    default:
      return "neutral";
  }
}

function getSlotStatusText(slot) {
  if (!slot) return "";

  if (slot.valid && slot.hasFile) return "תקין";
  if (slot.valid && !slot.hasFile && !slot.required) return "אופציונלי";
  if (!slot.hasFile && slot.required) return "חסר";
  if (!slot.valid) return "לא תקין";

  return "נבדק";
}

function getSlotClass(slot) {
  if (!slot) return "neutral";
  if (slot.valid && slot.hasFile) return "ready";
  if (slot.valid && !slot.hasFile && !slot.required) return "optional";
  if (!slot.hasFile && slot.required) return "missing";
  if (!slot.valid) return "invalid";
  return "neutral";
}

export default function UploadStatusSummary({ validation }) {
  if (!validation) return null;

  const statusLabel = getStatusLabel(validation.status, validation.label);
  const toneClass = getToneClass(validation.tone, validation.status);
  const slotResults = Array.isArray(validation.slotResults) ? validation.slotResults : [];

  return (
    <section className="uploadStatusSummary" dir="rtl">
      <div className="uploadStatusSummaryHeader">
        <div>
          <strong>{statusLabel}</strong>
          <small>
            {validation.requiredReady || 0}/{validation.requiredTotal || 0} קבצי חובה מוכנים
            {validation.uploadedCount ? ` · ${validation.uploadedCount} קבצים הועלו` : ""}
          </small>
        </div>

        <span className={`uploadStatusPill ${toneClass}`}>
          {validation.status || "EMPTY"}
        </span>
      </div>

      {slotResults.length > 0 && (
        <ul>
          {slotResults.map((slot) => {
            const slotClass = getSlotClass(slot);
            const errors = Array.isArray(slot.errors) ? slot.errors : [];

            return (
              <li key={slot.key || slot.title} className={slotClass}>
                <span>
                  {slot.title || slot.key}: {getSlotStatusText(slot)}
                </span>

                {slot.fileName && <em> · {slot.fileName}</em>}

                {errors.length > 0 && (
                  <div className="uploadStatusErrors">
                    {errors.map((message, index) => (
                      <small key={`${slot.key || slot.title}-error-${index}`}>
                        {message}
                      </small>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
