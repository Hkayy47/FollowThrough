import { useRef, useState } from "react";

export default function Intake({ onUpload, onManual, error }) {
  const fileRef = useRef(null);
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  return (
    <div className="page intake-page">
      <header className="intake-hero">
        <div className="logo-mark">🧭</div>
        <h1>Pre-Op Navigator</h1>
        <p className="tagline">
          Your guide from referral to procedure day — one step at a time.
        </p>
      </header>

      <p className="intake-question">How would you like to get started?</p>

      <div className="intake-options">
        <button
          className="option-card"
          onClick={() => showToast("Camera capture isn't available in this demo — try Upload instead.")}
        >
          <span className="option-icon">📷</span>
          <span className="option-title">Take a photo</span>
          <span className="option-sub">Snap your After Visit Summary</span>
        </button>

        <button className="option-card" onClick={() => fileRef.current?.click()}>
          <span className="option-icon">📄</span>
          <span className="option-title">Upload</span>
          <span className="option-sub">PDF of your AVS or instructions</span>
        </button>

        <button className="option-card" onClick={onManual}>
          <span className="option-icon">✍️</span>
          <span className="option-title">Manual mode</span>
          <span className="option-sub">No paperwork? Answer a few questions</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />

      {error && <div className="error-banner">⚠️ {error}</div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
