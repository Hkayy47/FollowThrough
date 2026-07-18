import { loadAlarms, saveAlarms } from "./storage.js";

// Alarm record: { id, datetime (ISO local), question, status: "pending" | "done" | "missed" }

export function initAlarms(planAlarms) {
  const alarms = (planAlarms || []).map((a, i) => ({
    id: `plan-${i}`,
    datetime: a.datetime,
    question: a.question,
    status: "pending",
  }));
  saveAlarms(alarms);
  return alarms;
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDateTimeStr(d = new Date()) {
  return `${localDateStr(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

const STOP = new Set([
  "today", "task", "have", "done", "this", "yet", "your", "did", "you", "the",
  "and", "for", "are", "with", "from", "prep", "at", "about", "complete",
  "reminder", "missed", "should", "what",
]);

function topicTokens(question) {
  return new Set(
    String(question || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
}

// Stable-ish key for Sets; overlap matching is what decides "same topic".
export function alarmTopicKey(question) {
  return [...topicTokens(question)].sort().slice(0, 6).join("|");
}

// "Did you pick up CLENPIQ at Walgreens" ≈ "Today's task: Pick up CLENPIQ bowel prep at Walgreens"
export function sameAlarmTopic(a, b) {
  const qa = typeof a === "string" ? a : a?.question;
  const qb = typeof b === "string" ? b : b?.question;
  const ta = topicTokens(qa);
  const tb = topicTokens(qb);
  if (!ta.size || !tb.size) return false;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  const minSize = Math.min(ta.size, tb.size);
  return overlap >= 2 && overlap / minSize >= 0.5;
}

function dedupeByTopic(list) {
  const out = [];
  for (const a of list) {
    if (out.some((kept) => sameAlarmTopic(kept, a))) continue;
    out.push(a);
  }
  return out;
}

function mentionsTask(question, title) {
  if (!question || !title) return false;
  const q = question.toLowerCase();
  const t = title.toLowerCase();
  if (q.includes(t.slice(0, 18))) return true;
  const words = t.split(/\s+/).filter((w) => w.length > 4);
  const hits = words.filter((w) => q.includes(w));
  return hits.length >= 2 || (words.length === 1 && hits.length === 1);
}

// Demo check-in: ring in 10s about today's first unfinished task, without
// creating a second popup when a plan alarm already covers that task.
export function ensureDemoAlarm(timeline, checklist = {}) {
  const alarms = loadAlarms().filter((a) => a.id !== "demo");
  const today = localDateStr();
  const todaysTask = (timeline || []).find(
    (e) => e.date === today && !checklist[`${e.date}::${e.title}`]
  );
  if (!todaysTask) {
    saveAlarms(alarms);
    return alarms;
  }

  const ringAt = localDateTimeStr(new Date(Date.now() + 10_000));
  const existing = alarms.find(
    (a) =>
      a.status === "pending" &&
      localDateStr(new Date(a.datetime)) === today &&
      mentionsTask(a.question, todaysTask.title)
  );

  if (existing) {
    // Reuse the plan alarm as the launch demo — no duplicate question.
    const next = alarms.map((a) =>
      a.id === existing.id ? { ...a, datetime: ringAt } : a
    );
    saveAlarms(next);
    return next;
  }

  const next = [
    {
      id: "demo",
      datetime: ringAt,
      question: `Today's task: ${todaysTask.title}. Have you done this yet?`,
      status: "pending",
    },
    ...alarms,
  ];
  saveAlarms(next);
  return next;
}

// Only surface alarms that belong to today. Deduped so one topic = one popup.
export function dueAlarms(alarms, now = Date.now()) {
  const today = localDateStr(new Date(now));
  const due = alarms.filter(
    (a) =>
      a.status === "pending" &&
      new Date(a.datetime).getTime() <= now &&
      localDateStr(new Date(a.datetime)) === today
  );
  return dedupeByTopic(due);
}

// A patient-added reminder rides the same alarm pipeline.
export function addCustomAlarm(id, datetime, question) {
  const alarms = loadAlarms().filter((a) => a.id !== id);
  alarms.push({ id, datetime, question, status: "pending" });
  saveAlarms(alarms);
  return alarms;
}

// Mark one alarm and any same-topic pending twins (demo + plan duplicates).
export function setAlarmStatus(id, status) {
  const alarms = loadAlarms();
  const target = alarms.find((a) => a.id === id);
  const next = alarms.map((a) => {
    if (a.id === id) return { ...a, status };
    if (target && a.status === "pending" && sameAlarmTopic(target, a)) {
      return { ...a, status };
    }
    return a;
  });
  saveAlarms(next);
  return next;
}

// Stable id for a timeline event, used to key its checklist and reminder state.
export function eventId(event) {
  return `${event.date}::${event.title}`;
}

export function setTaskReminder(event, enabled) {
  const id = `task-${eventId(event)}`;
  const alarms = loadAlarms().filter((a) => a.id !== id);
  if (enabled) {
    const clock = event.time && /^\d{1,2}:\d{2}/.test(event.time) ? event.time.slice(0, 5) : "09:00";
    alarms.push({
      id,
      datetime: `${event.date}T${clock}`,
      question: `Did you complete: ${event.title}?`,
      status: "pending",
    });
  }
  saveAlarms(alarms);
  return alarms;
}

export function hasReminder(alarms, event) {
  const id = `task-${eventId(event)}`;
  return alarms.some((a) => a.id === id && a.status === "pending");
}

export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function notify(question) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("AllClear", { body: question });
    } catch {
      /* ignore */
    }
  }
}

export function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const times = [0, 0.35, 0.7];
    times.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime + t);
      osc.frequency.setValueAtTime(1174, ctx.currentTime + t + 0.15);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.32);
    });
  } catch {
    /* audio not available */
  }
}
