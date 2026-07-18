import { useEffect, useRef, useState } from "react";
import { chat } from "../lib/api.js";

const OPENING =
  "Hello, this is your AllClear care companion. I have your preparation plan in front of me. How can I help you today?";

export default function VoiceAgent({ intake, onClose }) {
  const [entries, setEntries] = useState([{ role: "assistant", content: OPENING, t: new Date() }]);
  const [phase, setPhase] = useState("idle"); // idle | listening | thinking | speaking
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef(null);
  const entriesRef = useRef(null);
  const activeRef = useRef(false);
  const entriesSnapshot = useRef(entries);

  useEffect(() => {
    entriesSnapshot.current = entries;
  }, [entries]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (const r of e.results) {
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) handleUtterance(finalText.trim());
    };
    rec.onerror = () => setPhase("idle");
    rec.onend = () => {
      setInterim("");
      setPhase((p) => (p === "listening" ? "idle" : p));
    };
    recRef.current = rec;
    speak(OPENING, () => {});
    return () => {
      activeRef.current = false;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    entriesRef.current?.scrollTo(0, entriesRef.current.scrollHeight);
  }, [entries, interim]);

  function speak(text, onDone) {
    const synth = window.speechSynthesis;
    if (!synth) return onDone?.();
    setPhase("speaking");
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    u.pitch = 0.95;
    const voices = synth.getVoices();
    u.voice =
      voices.find((v) => /en(-|_)US/i.test(v.lang) && /female|aria|jenny|zira|samantha/i.test(v.name)) ||
      voices.find((v) => /en/i.test(v.lang)) ||
      null;
    u.onend = () => {
      setPhase("idle");
      onDone?.();
    };
    synth.cancel();
    synth.speak(u);
  }

  function startListening() {
    if (!recRef.current || phase === "listening") return;
    window.speechSynthesis?.cancel();
    activeRef.current = true;
    setPhase("listening");
    try {
      recRef.current.start();
    } catch {
      /* already started */
    }
  }

  function stopAll() {
    activeRef.current = false;
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    window.speechSynthesis?.cancel();
    setPhase("idle");
  }

  function handleClose() {
    stopAll();
    onClose?.();
  }

  async function handleUtterance(text) {
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    setInterim("");
    const userEntry = { role: "user", content: text, t: new Date() };
    setEntries((prev) => [...prev, userEntry]);
    setPhase("thinking");
    try {
      const history = [
        ...entriesSnapshot.current.map((e) => ({ role: e.role, content: e.content })),
        { role: "user", content: text },
      ];
      const { reply } = await chat(history, intake, { voice: true });
      setEntries((prev) => [...prev, { role: "assistant", content: reply, t: new Date() }]);
      speak(reply, () => {
        if (activeRef.current) startListening();
      });
    } catch (e) {
      const msg = `I am sorry, I could not process that. ${e.message}`;
      setEntries((prev) => [...prev, { role: "assistant", content: msg, t: new Date() }]);
      setPhase("idle");
    }
  }

  function downloadTranscript() {
    const lines = entries.map(
      (e) =>
        `[${e.t.toLocaleTimeString()}] ${e.role === "user" ? "Patient" : "AllClear Companion"}: ${e.content}`
    );
    const header = `AllClear voice consultation transcript\nDate: ${new Date().toLocaleString()}\n\n`;
    const blob = new Blob([header + lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AllClear_transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="voice-overlay" role="dialog" aria-label="Voice companion">
      <button className="voice-backdrop" aria-label="Close voice companion" onClick={handleClose} />
      <div className="voice-sheet">
        <header className="voice-sheet-head">
          <button className="voice-back" onClick={handleClose} title="Back to chat">
            ← Back
          </button>
          <div className="voice-sheet-titles">
            <h3>Voice companion</h3>
            <p>Talk it through, then return to your plan</p>
          </div>
          <button className="icon-btn" title="Download transcript" onClick={downloadTranscript}>
            ⬇️
          </button>
        </header>

        {!supported ? (
          <div className="voice-unsupported">
            <p>
              Voice input needs Chrome or Edge. You can keep using the text chat instead.
            </p>
            <button className="btn primary" onClick={handleClose}>
              Back to chat
            </button>
          </div>
        ) : (
          <>
            <div className="chat-scroll voice-scroll" ref={entriesRef}>
              {entries.map((e, i) => (
                <div key={i} className={`bubble ${e.role}`}>
                  {e.content}
                </div>
              ))}
              {interim && <div className="bubble user interim">{interim}…</div>}
              {phase === "thinking" && (
                <div className="bubble assistant typing">
                  Thinking<span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
                </div>
              )}
            </div>

            <div className="voice-controls">
              <p className="voice-status">
                {phase === "listening"
                  ? "Listening…"
                  : phase === "thinking"
                  ? "Thinking…"
                  : phase === "speaking"
                  ? "Speaking…"
                  : "Tap the microphone and speak"}
              </p>
              <div className="voice-buttons">
                <button
                  className={`mic-btn ${phase === "listening" ? "live" : ""}`}
                  onClick={phase === "listening" ? stopAll : startListening}
                >
                  {phase === "listening" ? "◼" : "🎙️"}
                </button>
              </div>
              <button className="btn subtle-link" onClick={downloadTranscript}>
                Save transcript
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
