// Path: src/components/ProductHome.jsx
// v57 — Shared Product Home UI
// This is a visual component only. It does not own routing, parsing, upload state,
// or product analysis logic. Existing product screens inject it as their landing view.

import React from "react";

function clampPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function getToneClass(tone) {
  return `tone-${tone || "blue"}`;
}

export default function ProductHome({
  eyebrow = "Product Home",
  title,
  subtitle,
  icon = "▣",
  scopeLabel,
  kpiCards = [],
  analysisCards = [],
  managerBars = [],
  actionTitle = "Action Center",
  actionValue = "0",
  actionText = "משימות פתוחות לטיפול מתוך ניתוח המוצר.",
  actionTarget = "action",
  onNavigate,
}) {
  const topBars = managerBars.slice(0, 6);
  const maxBarValue = Math.max(1, ...topBars.map((bar) => Number(bar.value || 0)));

  return (
    <section className="v57-product-home" dir="rtl">
      <header className="v57-product-hero">
        <div className="v57-product-title-row">
          <div className="v57-product-icon">{icon}</div>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </div>

        {scopeLabel && (
          <div className="v57-scope-pill">
            <span>מנהל הסדר</span>
            <strong>{scopeLabel}</strong>
          </div>
        )}
      </header>

      <div className="v57-product-nav-row">
        {analysisCards.map((card) => (
          <button key={card.id} type="button" onClick={() => onNavigate?.(card.id)}>
            <span>{card.icon || "•"}</span>
            {card.navLabel || card.title}
          </button>
        ))}
      </div>

      <div className="v57-kpi-strip">
        {kpiCards.map((card) => (
          <button
            key={card.label}
            type="button"
            className={`v57-kpi-tile ${getToneClass(card.tone)}`}
            onClick={() => onNavigate?.(card.target)}
          >
            <span>{card.icon || "•"}</span>
            <small>{card.label}</small>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>

      <div className="v57-product-main-grid">
        <section className="v57-action-card">
          <div>
            <span className="v57-action-icon">!</span>
            <p>{actionTitle}</p>
            <h3>{actionValue}</h3>
            <small>{actionText}</small>
          </div>
          <button type="button" onClick={() => onNavigate?.(actionTarget)}>פתיחת משימות</button>
        </section>

        <section className="v57-manager-card">
          <div className="v57-section-heading">
            <h3>פיזור מוביל</h3>
            <span>{topBars.length} רשומות</span>
          </div>

          {topBars.length ? (
            <div className="v57-bars">
              {topBars.map((bar) => {
                const width = clampPercent((Number(bar.value || 0) / maxBarValue) * 100);
                return (
                  <div className="v57-bar-row" key={bar.label}>
                    <div>
                      <strong>{bar.label}</strong>
                      <small>{bar.description}</small>
                    </div>
                    <i><b style={{ width: `${width}%` }} /></i>
                    <em>{bar.displayValue}</em>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="hint">אין עדיין נתוני פיזור להצגה.</p>
          )}
        </section>
      </div>

      <div className="v57-analysis-grid">
        {analysisCards.map((card) => (
          <article key={card.id} className={`v57-analysis-card ${getToneClass(card.tone)}`}>
            <div className="v57-card-topline">
              <span>{card.icon || "•"}</span>
              <strong>{card.metric}</strong>
            </div>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
            <button type="button" onClick={() => onNavigate?.(card.id)}>כניסה לניתוח</button>
          </article>
        ))}
      </div>
    </section>
  );
}
