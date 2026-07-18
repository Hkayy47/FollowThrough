import { useEffect, useRef, useState } from "react";
import { manualIntake } from "../lib/api.js";

const SPECIALTIES = [
  { name: "GI", icon: "🫁", enabled: true },
  { name: "Cardiology", icon: "❤️", enabled: false },
  { name: "General Surgery", icon: "🩺", enabled: false },
  { name: "Orthopedics", icon: "🦴", enabled: false },
  { name: "Ophthalmology", icon: "👁️", enabled: false },
  { name: "Urology", icon: "🧪", enabled: false },
];

const PROCEDURES = [
  { name: "Colonoscopy", icon: "🔍", enabled: true },
  { name: "EGD (Upper Endoscopy)", icon: "🔬", enabled: false },
  { name: "Flexible Sigmoidoscopy", icon: "🧭", enabled: false },
  { name: "ERCP", icon: "⚕️", enabled: false },
];

export default function ManualMode({ onBack, onComplete, error }) {
  const [specialty, setSpecialty] = useState(null);
  const [procedure, setProcedure] = useState(null);
  const [messages, setMessages] = useState([]);
  const [intakeSoFar, setIntakeSoFar] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);
  const scrollRef = useRef(null);

  // Kick off the conversation once a procedure is chosen.
  useEffect(() => {
    if (!procedure || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      setBusy(true);
      try {
        const result = await manualIntake([], null, specialty, procedure);
        setMessages([{ role: "assistant", content: result.reply }]);
        setIntakeSoFar(result.updatedIntake);
      } catch (e) {
        setMessages([{ role: "assistant", content: `Something went wrong: ${e.message}` }]);
      } finally {
        setBusy(false);
      }
    })();
  }, [procedure, specialty]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const result = await manualIntake(next, intakeSoFar, specialty, procedure);
      setMessages([...next, { role: "assistant", content: result.reply }]);
      setIntakeSoFar(result.updatedIntake);
      if (result.complete) {
        setTimeout(() => onComplete(result.updatedIntake), 1200);
      }
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Something went wrong: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  const grid = (title, items, onPick) => (
    <div className="page manual-page">
      <header className="page-header">
        <button className="back-btn" onClick={onBack}>‹</button>
        <h2>{title}</h2>
      </header>
      <div className="select-grid">
        {items.map((item) => (
          <button
            key={item.name}
            className={`select-card ${item.enabled ? "" : "disabled"}`}
            onClick={() => (item.enabled ? onPick(item.name) : null)}
          >
            <span className="select-icon">{item.icon}</span>
            <span>{item.name}</span>
            {!item.enabled && <span className="coming-soon">Coming soon</span>}
          </button>
        ))}
      </div>
    </div>
  );

  if (!specialty) return grid("Which specialty referred you?", SPECIALTIES, setSpecialty);
  if (!procedure) return grid("Which procedure are you having?", PROCEDURES, setProcedure);

  return (
    <div className="page manual-page">
      <header className="page-header">
        <button className="back-btn" onClick={onBack}>‹</button>
        <h2>Tell us about your {procedure.toLowerCase()}</h2>
      </header>
      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
        ))}
        {busy && <div className="bubble assistant typing">•••</div>}
      </div>
      {error && <div className="error-banner">⚠️ {error}</div>}
      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type your answer…"
          disabled={busy}
        />
        <button className="send-btn" onClick={send} disabled={busy}>➤</button>
      </div>
    </div>
  );
}
