// src/components/ErrorBoundary.jsx
// CORE HARDENING v23
// Generic React Error Boundary
//
// Purpose:
// Prevent a local rendering/runtime error from crashing the entire app.
// This component is intentionally generic and can wrap Dashboard, UploadPanel,
// or specific dashboard widgets.

import React from "react";

function formatErrorMessage(error) {
  if (!error) return "שגיאה לא ידועה";
  if (typeof error === "string") return error;
  return error.message || "שגיאה לא ידועה";
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    if (typeof this.props.onError === "function") {
      this.props.onError({
        error,
        errorInfo,
        boundaryName: this.props.name || "ErrorBoundary",
      });
    }

    // Keep console logging for developer visibility.
    // Do not throw again.
    console.error("[ErrorBoundary]", this.props.name || "Unnamed boundary", {
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });

    if (typeof this.props.onReset === "function") {
      this.props.onReset();
    }
  };

  renderFallback() {
    const {
      title = "אירעה שגיאה בתצוגה",
      description = "הרכיב לא נטען בצורה תקינה. שאר המערכת ממשיכה לעבוד.",
      showDetails = false,
      compact = false,
    } = this.props;

    const { error, errorInfo, errorId } = this.state;

    if (typeof this.props.fallback === "function") {
      return this.props.fallback({
        error,
        errorInfo,
        errorId,
        reset: this.handleReset,
      });
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <section
        className={`errorBoundaryBox ${compact ? "errorBoundaryBoxCompact" : ""}`}
        dir="rtl"
        role="alert"
      >
        <div className="errorBoundaryHeader">
          <div>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>

          <button type="button" onClick={this.handleReset}>
            נסה שוב
          </button>
        </div>

        {errorId && <small className="errorBoundaryId">מזהה שגיאה: {errorId}</small>}

        {showDetails && (
          <details className="errorBoundaryDetails">
            <summary>פרטי שגיאה טכניים</summary>
            <pre>{formatErrorMessage(error)}</pre>
            {errorInfo?.componentStack && <pre>{errorInfo.componentStack}</pre>}
          </details>
        )}
      </section>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}
