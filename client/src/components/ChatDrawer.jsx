import { useEffect, useRef, useState } from "react";
import { chat, classifyPrep, fileToBase64 } from "../lib/api.js";
import { loadChat, saveChat } from "../lib/storage.js";

export default function ChatDrawer({ intake, plan, missedAlarmEvent }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = loadChat();
    if (saved.length) return saved;
    return plan?.greeting
      ? [{ role: "assistant", content: plan.greeting }]
      : [];
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const lastMissedTs = useRef(null);

  useEffect(() => saveChat(messages), [messages]);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, busy, open]);

  // A missed alarm opens the chat and asks the agent for recovery guidance.
  useEffect(() => {
    if (!missedAlarmEvent || missedAlarmEvent.ts === lastMissedTs.current) return;
    lastMissedTs.current = missedAlarmEvent.ts;
    const { alarm } = missedAlarmEvent;
    setOpen(true);
    const userMsg = {
      role: "user",
      content: `I missed this: "${alarm.question}" — what should I do now?`,
    };
    sendToAgent(
      userMsg,
      `The patient just reported MISSING a scheduled prep step. The reminder was: "${alarm.question}" (scheduled for ${alarm.datetime}). Explain calmly what this means, what to focus on right now to still achieve adequate prep and a safe procedure, and when they should call the GI office instead.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missedAlarmEvent]);

  async function sendToAgent(userMsg, context) {
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    try {
      const history = [...messagesForApi(), { role: "user", content: userMsg.content }];
      const { reply } = await chat(history, intake, context);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, something went wrong: ${e.message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // API history: text-only roles/content (photos become a text note).
  function messagesForApi() {
    return messages.map((m) => ({
      role: m.role,
      content: m.image ? m.content || "[patient sent a bowel prep photo]" : m.content,
    }));
  }

  function send(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || busy) return;
    setInput("");
    setOpen(true);
    sendToAgent({ role: "user", content: trimmed });
  }

  async function handleImage(file) {
    if (!file || busy) return;
    setOpen(true);
    setBusy(true);
    const dataUrl = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
    });
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Here's my prep progress photo.", image: dataUrl },
    ]);
    try {
      const base64 = await fileToBase64(file);
      const result = await classifyPrep(base64, file.type || "image/jpeg");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.message,
          verdict: result.adequate ? "adequate" : "inadequate",
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I couldn't analyze that photo: ${e.message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const giContact =
    intake?.careContacts?.find((c) =>
      /gi|endo|procedure|gastro/i.test(`${c.role || ""} ${c.name || ""}`)
    ) || intake?.careContacts?.find((c) => c?.phone);

  return (
    <div className={`chat-drawer ${open ? "open" : ""}`}>
      <button className="drawer-handle" onClick={() => setOpen(!open)}>
        <span className="handle-bar" />
        {open ? "Hide chat" : "💬 Chat with your care companion"}
      </button>

      {open && (
        <div className="chat-scroll drawer-scroll" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role} ${m.verdict || ""}`}>
              {m.image && <img className="bubble-img" src={m.image} alt="prep" />}
              {m.content}
            </div>
          ))}
          {busy && <div className="bubble assistant typing">•••</div>}
        </div>
      )}

      <div className="suggestion-row">
        {(plan?.suggestions || []).map((s, i) => (
          <button key={i} className="suggestion-chip" onClick={() => send(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>

      <div className="chat-input-row">
        <button
          className="icon-btn"
          title="Send a bowel prep photo"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          🖼️
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          onFocus={() => setOpen(true)}
          placeholder="Ask me anything about your prep…"
          disabled={busy}
        />
        <a
          className="icon-btn call-btn"
          title={`Call ${giContact?.name || "your care team"}`}
          href={giContact?.phone ? `tel:${giContact.phone}` : undefined}
          onClick={(e) => !giContact?.phone && e.preventDefault()}
        >
          📞
        </a>
        <button className="send-btn" onClick={() => send()} disabled={busy}>➤</button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImage(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
