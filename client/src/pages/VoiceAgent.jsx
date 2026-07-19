import { useEffect, useRef, useState } from "react";
import { chat } from "../lib/api.js";

const OPENING =
  "Hello, this is your AllClear care companion. I have your preparation plan in front of me. How can I help you today?";

function stripForSpeech(text) {
  return String(text || "")
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function VoiceAgent({ intake, onClose }) {
  const [entries, setEntries] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | listening | thinking | speaking
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const [inCall, setInCall] = useState(false);
  const scrollRef = useRef(null);
  const recRef = useRef(null);
  const phaseRef = useRef("idle");
  const inCallRef = useRef(false);
  const entriesRef = useRef([]);
  const startingListen = useRef(false);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    inCallRef.current = inCall;
  }, [inCall]);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [entries, interim, phase]);

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
    rec.maxAlternatives = 1;

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

    rec.onerror = (e) => {
      startingListen.current = false;
      // Keep the call alive; retry listen after a brief pause.
      if (!inCallRef.current) {
        setPhase("idle");
        return;
      }
      if (e.error === "aborted" || e.error === "no-speech") {
        setTimeout(() => {
          if (inCallRef.current && phaseRef.current !== "speaking" && phaseRef.current !== "thinking") {
            startListening();
          }
        }, 400);
        return;
      }
      setPhase("idle");
    };

    rec.onend = () => {
      startingListen.current = false;
      setInterim("");
      // If still in a call and we were listening (utterance not yet handed off), resume.
      if (
        inCallRef.current &&
        phaseRef.current === "listening" &&
        !startingListen.current
      ) {
        setTimeout(() => {
          if (inCallRef.current && phaseRef.current === "listening") startListening();
        }, 250);
      }
    };

    recRef.current = rec;

    // Warm up voices list (Chrome loads them async).
    window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", () => {
      window.speechSynthesis.getVoices();
    });

    return () => {
      inCallRef.current = false;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    return (
      voices.find((v) => /en(-|_)US/i.test(v.lang) && /female|aria|jenny|zira|samantha|google us english/i.test(v.name)) ||
      voices.find((v) => /en(-|_)US/i.test(v.lang)) ||
      voices.find((v) => /en/i.test(v.lang)) ||
      null
    );
  }

  function speak(text, onDone) {
    const synth = window.speechSynthesis;
    const clean = stripForSpeech(text);
    if (!synth || !clean) {
      setPhase("idle");
      onDone?.();
      return;
    }
    setPhase("speaking");
    phaseRef.current = "speaking";
    synth.cancel();

    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.5;
    u.pitch = 1;
    u.voice = pickVoice();
    u.onend = () => {
      setPhase("idle");
      phaseRef.current = "idle";
      onDone?.();
    };
    u.onerror = () => {
      setPhase("idle");
      phaseRef.current = "idle";
      onDone?.();
    };
    // Small delay helps some browsers actually route audio after cancel().
    setTimeout(() => synth.speak(u), 40);
  }

  function startListening() {
    if (!recRef.current || !inCallRef.current) return;
    if (phaseRef.current === "speaking" || phaseRef.current === "thinking") return;
    if (startingListen.current) return;

    window.speechSynthesis?.cancel();
    startingListen.current = true;
    setPhase("listening");
    phaseRef.current = "listening";
    try {
      recRef.current.start();
    } catch {
      // Already started — force restart.
      try {
        recRef.current.stop();
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        if (!inCallRef.current) return;
        try {
          recRef.current.start();
          setPhase("listening");
          phaseRef.current = "listening";
        } catch {
          startingListen.current = false;
        }
      }, 200);
    }
  }

  function endCall() {
    inCallRef.current = false;
    setInCall(false);
    startingListen.current = false;
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    window.speechSynthesis?.cancel();
    setPhase("idle");
    phaseRef.current = "idle";
    setInterim("");
  }

  function startCall() {
    if (!supported) return;
    inCallRef.current = true;
    setInCall(true);
    const opening = { role: "assistant", content: OPENING, t: new Date() };
    entriesRef.current = [opening];
    setEntries([opening]);
    speak(OPENING, () => {
      if (inCallRef.current) startListening();
    });
  }

  function handleClose() {
    endCall();
    onClose?.();
  }

  async function handleUtterance(text) {
    if (!text || phaseRef.current === "thinking" || phaseRef.current === "speaking") return;
    startingListen.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setInterim("");

    const userEntry = { role: "user", content: text, t: new Date() };
    const historyBase = [...entriesRef.current, userEntry];
    entriesRef.current = historyBase;
    setEntries(historyBase);
    setPhase("thinking");
    phaseRef.current = "thinking";

    try {
      const history = historyBase.map((e) => ({ role: e.role, content: e.content }));
      const { reply } = await chat(history, intake, { voice: true });
      const assistantEntry = { role: "assistant", content: reply, t: new Date() };
      const next = [...entriesRef.current, assistantEntry];
      entriesRef.current = next;
      setEntries(next);
      speak(reply, () => {
        if (inCallRef.current) startListening();
      });
    } catch (e) {
      const msg = `I am sorry, I could not process that. ${e.message}`;
      const next = [...entriesRef.current, { role: "assistant", content: msg, t: new Date() }];
      entriesRef.current = next;
      setEntries(next);
      speak(msg, () => {
        if (inCallRef.current) startListening();
      });
    }
  }

  function downloadTranscript() {
    if (!entries.length) return;
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

  const statusLabel = !inCall
    ? "Tap Start call to talk with your care companion"
    : phase === "listening"
    ? "Listening… speak naturally"
    : phase === "thinking"
    ? "Thinking…"
    : phase === "speaking"
    ? "Speaking…"
    : "On the call";

  return (
    <div className="voice-overlay" role="dialog" aria-label="Voice mode">
      <button className="voice-backdrop" aria-label="Close voice mode" onClick={handleClose} />
      <div className="voice-sheet">
        <header className="voice-sheet-head">
          <button className="voice-back" onClick={handleClose} title="Back">
            ← Back
          </button>
          <div className="voice-sheet-titles">
            <h3>Voice mode</h3>
            <p>{inCall ? "Live call with your care companion" : "Hands-free conversation"}</p>
          </div>
          <button
            className="icon-btn"
            title="Download transcript"
            onClick={downloadTranscript}
            disabled={!entries.length}
          >
            ⬇️
          </button>
        </header>

        {!supported ? (
          <div className="voice-unsupported">
            <p>Voice mode needs Chrome or Edge with microphone access.</p>
            <button className="btn primary" onClick={handleClose}>
              Back
            </button>
          </div>
        ) : (
          <>
            <div className={`voice-orb-wrap ${phase} ${inCall ? "live" : ""}`}>
              <div className="voice-orb" aria-hidden="true" />
              <p className="voice-status">{statusLabel}</p>
            </div>

            <div className="chat-scroll voice-scroll" ref={scrollRef}>
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
              {!inCall ? (
                <button className="mic-btn" onClick={startCall} title="Start call">
                  🎙️
                </button>
              ) : (
                <button className="mic-btn end" onClick={endCall} title="End call">
                  ⏹
                </button>
              )}
              <p className="voice-hint">
                {!inCall
                  ? "Start call — the agent speaks, then listens"
                  : "End call when you are done"}
              </p>
              {entries.length > 0 && (
                <button className="btn subtle-link" onClick={downloadTranscript}>
                  Save transcript
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
