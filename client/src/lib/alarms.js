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

// The demo alarm rings 10 seconds after the app (Road page) launches.
// If a pending demo alarm from a previous session already passed, keep it so it
// surfaces through the missed-alarm flow instead of re-arming.
export function ensureDemoAlarm() {
  const alarms = loadAlarms();
  const demo = alarms.find((a) => a.id === "demo");
  if (demo && demo.status === "pending") {
    saveAlarms(alarms);
    return alarms;
  }
  const next = [
    {
      id: "demo",
      datetime: new Date(Date.now() + 10_000).toISOString(),
      question: "Did you take the medication yet?",
      status: "pending",
    },
    ...alarms.filter((a) => a.id !== "demo"),
  ];
  saveAlarms(next);
  return next;
}

export function dueAlarms(alarms, now = Date.now()) {
  return alarms.filter(
    (a) => a.status === "pending" && new Date(a.datetime).getTime() <= now
  );
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
    alarms.push({
      id,
      datetime: `${event.date}T09:00`,
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
