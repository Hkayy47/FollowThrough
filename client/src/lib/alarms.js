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

// The launch check-in rings 10 seconds after the Road page loads and always
// asks about TODAY's first unfinished task. If nothing is scheduled for today,
// no alarm fires.
export function ensureDemoAlarm(timeline, checklist = {}) {
  const alarms = loadAlarms();
  const today = localDateStr();
  const todaysTask = (timeline || []).find(
    (e) => e.date === today && !checklist[`${e.date}::${e.title}`]
  );
  const withoutDemo = alarms.filter((a) => a.id !== "demo");
  if (!todaysTask) {
    saveAlarms(withoutDemo);
    return withoutDemo;
  }
  const ringAt = new Date(Date.now() + 10_000);
  const next = [
    {
      id: "demo",
      datetime: localDateTimeStr(ringAt),
      question: `Today's task: ${todaysTask.title}. Have you done this yet?`,
      status: "pending",
    },
    ...withoutDemo,
  ];
  saveAlarms(next);
  return next;
}

// Only surface alarms that belong to today. Yesterday's misses are visible on
// the timeline; notifications stay focused on what is due now.
export function dueAlarms(alarms, now = Date.now()) {
  const today = localDateStr(new Date(now));
  return alarms.filter(
    (a) =>
      a.status === "pending" &&
      new Date(a.datetime).getTime() <= now &&
      localDateStr(new Date(a.datetime)) === today
  );
}

// A patient-added reminder rides the same alarm pipeline.
export function addCustomAlarm(id, datetime, question) {
  const alarms = loadAlarms().filter((a) => a.id !== id);
  alarms.push({ id, datetime, question, status: "pending" });
  saveAlarms(alarms);
  return alarms;
}

export function setAlarmStatus(id, status) {
  const alarms = loadAlarms().map((a) => (a.id === id ? { ...a, status } : a));
  saveAlarms(alarms);
  return alarms;
}

// Stable id for a timeline event, used to key its checklist and reminder state.
export function eventId(event) {
  return `${event.date}::${event.title}`;
}

// Toggle a reminder alarm for a single timeline task. Reuses the same
// pending/missed alarm pipeline as the plan-generated alarms, so it shows up
// in RoadToProcedure's due/missed-alarm polling automatically.
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
