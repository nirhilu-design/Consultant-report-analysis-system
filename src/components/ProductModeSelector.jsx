// Path: src/components/ProductModeSelector.jsx
// CORE HARDENING v27
// Multi Product Mode Selector

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

export default function ProductModeSelector({
  value = PRODUCT_MODES.PENSION,
  onChange,
  disabled = false,
  overview = [],
}) {
  function getOverview(optionKey) {
    return overview.find((item) => item.productMode === optionKey) || null;
  }

  return (
    <section className="productModeSelector" dir="rtl">
      <div className="productModeSelectorHeader">
        <strong>בחר מוצר לטעינה / ניתוח</strong>
        <span>מעבר בין מוצרים לא מוחק קבצים שכבר הועלו למוצר אחר.</span>
      </div>

      <div className="productModeOptions">
        {PRODUCT_MODE_OPTIONS.map((option) => {
          const active = value === option.key;
          const item = getOverview(option.key);

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

              {item?.hasFiles && (
                <em className={item.ready ? "productModeMiniStatus ready" : "productModeMiniStatus partial"}>
                  {item.readyManagers}/{item.activeManagers} מנהלים מוכנים
                </em>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
