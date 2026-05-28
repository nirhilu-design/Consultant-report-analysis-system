// src/components/DashboardSectionBoundary.jsx
// CORE HARDENING v23
// Small wrapper for dashboard widgets/sections.
//
// Usage:
// <DashboardSectionBoundary name="KPI">
//   <KpiSection ... />
// </DashboardSectionBoundary>

import React from "react";
import ErrorBoundary from "./ErrorBoundary.jsx";

export default function DashboardSectionBoundary({
  name = "Dashboard section",
  title,
  children,
  compact = false,
}) {
  return (
    <ErrorBoundary
      name={name}
      compact={compact}
      title={title || "רכיב בדשבורד לא נטען"}
      description="המערכת זיהתה בעיה נקודתית ברכיב הזה בלבד. שאר הדוח ממשיך לפעול."
      showDetails={false}
    >
      {children}
    </ErrorBoundary>
  );
}
