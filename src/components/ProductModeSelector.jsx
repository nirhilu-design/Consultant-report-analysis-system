// Path: src/components/ProductModeSelector.jsx
// CORE HARDENING v26C
// Product Mode Selector
//
// Purpose:
// Let the user choose which product flow is being uploaded/analyzed.
// Current modes:
// - pension
// - hishtalmut

import React from "react";

export const PRODUCT_MODES = {
  PENSION: "pension",
  HISHTALMUT: "hishtalmut",
};

export const PRODUCT_MODE_OPTIONS = [
  {
    key: PRODUCT_MODES.PENSION,
    title: "פנסיה",
    subtitle: "דוח נתונים + דוח הסכמים פנסיוני",
  },
  {
    key: PRODUCT_MODES.HISHTALMUT,
    title: "קרן השתלמות",
    subtitle: "קלט מידע + קלט הסכמים לקרנות השתלמות",
  },
];

export function getProductModeLabel(productMode) {
  return PRODUCT_MODE_OPTIONS.find((option) => option.key === productMode)?.title || "פנסיה";
}

export default function ProductModeSelector({ value = PRODUCT_MODES.PENSION, onChange, disabled = false }) {
  return (
    <section className="productModeSelector" dir="rtl">
      <div className="productModeSelectorHeader">
        <strong>בחר מוצר לניתוח</strong>
        <span>הבחירה קובעת איזה Parser ירוץ על הקבצים שהועלו.</span>
      </div>

      <div className="productModeOptions">
        {PRODUCT_MODE_OPTIONS.map((option) => {
          const active = value === option.key;

          return (
            <button
              key={option.key}
              type="button"
              className={`productModeOption ${active ? "active" : ""}`}
              onClick={() => onChange?.(option.key)}
              disabled={disabled}
            >
              <strong>{option.title}</strong>
              <span>{option.subtitle}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
