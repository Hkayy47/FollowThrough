import { useEffect, useRef, useState } from "react";
import { chat, classifyPrep, fileToBase64 } from "../lib/api.js";
import { loadChat, saveChat, loadCustom, saveCustom } from "../lib/storage.js";
import { addCustomAlarm, requestNotificationPermission } from "../lib/alarms.js";
import { shareAnswerPdf } from "../lib/pdf.js";

// Render **bold** markers from the model as real bold text.
function Rich({ text }) {
  const parts = String(text).split(/\*\*(.+?)\*\*/gs);
  return parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
}

export default function ChatDrawer({ intake, plan, missedAlarmEvent, onOpenVoice }) {
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
      content: `I missed this: "${alarm.question}". What should I do now?`,
    };
    sendToAgent(
      userMsg,
      `The patient just reported MISSING a scheduled prep step. The reminder was: "${alarm.question}" (scheduled for ${alarm.datetime}). Explain calmly what this means, what to focus on right now to still achieve adequate prep and a safe procedure, and when they should call the GI office instead.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missedAlarmEvent]);

  // Route each question to the matching expert agent for a faster, sharper answer.
  function agentFor(text) {
    const t = text.toLowerCase();
    if (/how.*read|guide.*avs|parse|understand.*summary/.test(t)) return "avs-guide";
    if (/avs|visit summary|explain my/.test(t)) return "avs-explainer";
    if (/eat|diet|food|drink|liquid|meal/.test(t)) return "diet";
    if (/medic|eliquis|apixaban|blood thinner|pill|dose(?!.*prep)/.test(t)) return "meds";
    if (/prep|clenpiq|bowel|stool|clear yellow/.test(t)) return "prep";
    return undefined;
  }

  async function sendToAgent(userMsg, context) {
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    try {
      const history = [...messagesForApi(), { role: "user", content: userMsg.content }];
      const topic = agentFor(userMsg.content);
      const { reply } = await chat(history, intake, { context, agent: topic });
      setMessages((prev) => [...prev, { role: "assistant", content: reply, topic }]);
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

  function makePdf(message) {
    const patientName = [
      intake?.demographics?.name?.firstName,
      intake?.demographics?.name?.lastName,
    ]
      .filter(Boolean)
      .join(" ");
    shareAnswerPdf({
      patientName,
      procedure: intake?.procedureInformation?.procedure,
      content: message.content,
    });
  }

  // Build grocery-run reminders from the patient's diet phases: shop the day
  // before each phase starts (never in the past), 5 PM check-in.
  function addGroceryReminders() {
    const proc = (intake?.procedureInformation?.datetimeOfProcedure || "").slice(0, 10);
    const phases = intake?.visitIntake?.dietInstructions || [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const existing = loadCustom();
    const added = [];
    for (const ph of phases) {
      if (!proc || ph.daysPriorToProcedure == null || !ph.dietType) continue;
      const [y, m, d] = proc.split("-").map(Number);
      const start = new Date(y, m - 1, d - ph.daysPriorToProcedure);
      const shop = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
      const shopStr = `${shop.getFullYear()}-${String(shop.getMonth() + 1).padStart(2, "0")}-${String(shop.getDate()).padStart(2, "0")}`;
      const title = `Grocery run for: ${ph.dietType.slice(0, 40)}`;
      if (shopStr < todayStr) continue;
      if (existing.some((c) => c.title === title) || added.some((c) => c.title === title)) continue;
      added.push({
        date: shopStr,
        time: "17:00",
        title,
        size: "minor",
        details:
          "Stock up today so tomorrow's diet phase starts smoothly. Having the right foods ready makes it much easier to stay on plan, and staying on plan is what keeps the colon clear enough for the exam.",
        custom: true,
      });
      addCustomAlarm(`custom-grocery-${shopStr}`, `${shopStr}T17:00`, `Grocery run done for tomorrow's diet change?`);
    }
    if (added.length) {
      saveCustom([...existing, ...added]);
      requestNotificationPermission();
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: added.length
          ? `Done. I added ${added.length} grocery reminder${added.length === 1 ? "" : "s"} to your timeline: ${added
              .map((a) => `**${a.date}**`)
              .join(" and ")}, each at 5:00 PM the day before a diet change.`
          : "Your grocery reminders are already on the timeline, or the shopping days have passed. You can add your own with the + Reminder button at the top of your plan.",
      },
    ]);
  }

  return (
    <div className={`chat-drawer ${open ? "open" : ""}`}>
      <button className="drawer-handle" onClick={() => setOpen(!open)}>
        {open ? <span className="handle-bar" /> : null}
        {open ? "Hide chat" : "✨ How can I help?"}
      </button>

      {open && (
        <div className="chat-scroll drawer-scroll" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble-wrap ${m.role}`}>
              <div className={`bubble ${m.role} ${m.verdict || ""}`}>
                {m.image && <img className="bubble-img" src={m.image} alt="prep" />}
                <Rich text={m.content} />
              </div>
              {m.role === "assistant" && !m.verdict && !busy && i > 0 && (
                <div className="answer-actions">
                  <button className="answer-chip" onClick={() => makePdf(m)}>
                    📄 PDF to send someone?
                  </button>
                  {m.topic === "diet" && (
                    <button className="answer-chip" onClick={addGroceryReminders}>
                      🛒 Add grocery reminders?
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="bubble assistant typing">
              Thinking<span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
            </div>
          )}
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
        <button
          className="icon-btn call-btn"
          title="Talk to your care companion by voice"
          onClick={() => onOpenVoice?.()}
        >
          🎙️
        </button>
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
