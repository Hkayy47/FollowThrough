import { useEffect, useState } from "react";
import {
  loadAlarms,
  loadChecklist,
  saveChecklist,
  loadCustom,
  saveCustom,
} from "../lib/storage.js";
import {
  eventId,
  setTaskReminder,
  hasReminder,
  requestNotificationPermission,
  addCustomAlarm,
} from "../lib/alarms.js";
import { downloadEventIcs } from "../lib/ics.js";
import { STOOL_DETAILS } from "../lib/planTasks.js";

export default function Timeline({ events, procedureDate, planAlarms, onAskAboutTask }) {
  const [expanded, setExpanded] = useState(null);
  const [checklist, setChecklist] = useState(loadChecklist);
  const [alarms, setAlarms] = useState(loadAlarms);
  const [custom, setCustom] = useState(loadCustom);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "" });

  // Grocery reminders (or any custom reminder) can be added from the chat too.
  useEffect(() => {
    const refresh = () => {
      setCustom(loadCustom());
      setAlarms(loadAlarms());
    };
    window.addEventListener("ac-custom-updated", refresh);
    return () => window.removeEventListener("ac-custom-updated", refresh);
  }, []);

  const merged = [...(events || []), ...custom];
  const sorted = merged.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99")
  );
  const todayStr = localDateStr(new Date());
  const procDate = (procedureDate || sorted[sorted.length - 1]?.date || todayStr).slice(0, 10);

  const upcoming = sorted.filter((e) => e.date >= todayStr);
  const earlier = sorted.filter((e) => e.date < todayStr);

  const groups = [];
  for (const event of upcoming) {
    const last = groups[groups.length - 1];
    if (last && last.date === event.date) last.events.push(event);
    else groups.push({ date: event.date, events: [event] });
  }

  const firstDate = sorted[0]?.date || todayStr;
  const totalDays = Math.max(1, diffDays(firstDate, procDate));
  const dayIndex = Math.min(totalDays, Math.max(0, diffDays(firstDate, todayStr)));
  const doneCount = sorted.filter((e) => checklist[eventId(e)]).length;
  const pct = Math.round((dayIndex / totalDays) * 100);

  function toggleDone(id) {
    const next = { ...checklist, [id]: !checklist[id] };
    setChecklist(next);
    saveChecklist(next);
  }

  function toggleReminder(event) {
    const turningOn = !hasReminder(alarms, event);
    if (turningOn) requestNotificationPermission();
    setAlarms(setTaskReminder(event, turningOn));
  }

  function eventTime(event) {
    if (event.time && /^\d{1,2}:\d{2}/.test(event.time)) return event.time.slice(0, 5);
    const title = (event.title || "").toLowerCase();
    const alarm = (planAlarms || []).find((a) => {
      const q = (a.question || "").toLowerCase();
      const key = title.slice(0, 18);
      return (key && q.includes(key)) || (q.length > 12 && title.includes(q.slice(0, 18)));
    });
    if (alarm?.datetime?.includes("T")) return alarm.datetime.slice(11, 16);
    const fromDetails = String(event.details || "").match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    if (fromDetails) {
      let h = Number(fromDetails[1]);
      const min = fromDetails[2];
      const ap = (fromDetails[3] || "").toLowerCase();
      if (ap === "pm" && h < 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${min}`;
    }
    return "";
  }

  function addToCalendar(event) {
    const t = eventTime(event);
    downloadEventIcs(event, t ? `${event.date}T${t}` : undefined);
  }

  function submitReminder() {
    if (!form.title.trim() || !form.date) return;
    const item = {
      date: form.date,
      time: form.time || "",
      title: form.title.trim(),
      size: "minor",
      details: "A reminder you added to your plan.",
      custom: true,
    };
    const next = [...custom, item];
    saveCustom(next);
    setCustom(next);
    const id = `custom-${Date.now()}`;
    setAlarms(
      addCustomAlarm(id, `${form.date}T${form.time || "09:00"}`, `Reminder: ${item.title}. Done yet?`)
    );
    requestNotificationPermission();
    setForm({ title: "", date: "", time: "" });
    setAdding(false);
  }

  function removeCustom(event) {
    const next = custom.filter((c) => !(c.date === event.date && c.title === event.title));
    saveCustom(next);
    setCustom(next);
  }

  return (
    <div className="timeline">
      <div className="progress-card">
        <div className="progress-top">
          <span className="progress-title">
            {formatLong(todayStr)}
            {todayStr === procDate ? " · Procedure day" : ""}
          </span>
          <span className="progress-count">
            Day {dayIndex + 1}/{totalDays + 1}
          </span>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <div className="progress-foot">
          <span className="progress-sub">
            {daysBetween(todayStr, procDate) === 0
              ? "Today is the day. Follow your morning steps."
              : `${daysBetween(todayStr, procDate)} day${daysBetween(todayStr, procDate) === 1 ? "" : "s"} to go · ${doneCount} of ${sorted.length} tasks done`}
          </span>
          <button className="add-reminder-btn" onClick={() => setAdding(!adding)}>
            {adding ? "Close" : "+ Reminder"}
          </button>
        </div>
        {adding && (
          <div className="reminder-form">
            <p className="reminder-hint">
              Add a check-in anywhere between today and procedure day. It appears on your timeline.
            </p>
            <input
              placeholder="What should we remind you about?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <div className="reminder-form-row">
              <input
                type="date"
                min={todayStr}
                max={procDate}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
              <button className="btn primary" onClick={submitReminder}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {earlier.length > 0 && (
        <div className="earlier-note">✓ {earlier.length} earlier task{earlier.length === 1 ? "" : "s"} behind you</div>
      )}

      {groups.map((group, gi) => {
        const isGoal = group.date === procDate;
        const isToday = group.date === todayStr;
        return (
          <div key={group.date} className="tl-item">
            <div className="tl-rail">
              <span className={`tl-node major ${isGoal ? "goal" : ""} ${isToday ? "today" : ""}`}>
                {isGoal ? "🏁" : ""}
              </span>
              {gi < groups.length - 1 && <span className="tl-line" />}
            </div>
            <div className="tl-card">
              <span className="tl-date">
                {isToday
                  ? "Today"
                  : daysBetween(group.date, procDate) === 0
                  ? "Procedure day"
                  : `${daysBetween(group.date, procDate)} day${daysBetween(group.date, procDate) === 1 ? "" : "s"} before`}
                {isToday && <em className="tl-today-chip">Now</em>}
              </span>
              <span className="tl-title major">
                {formatShort(group.date)}
                {group.events.some((e) => eventTime(e)) && (
                  <em className="tl-day-times">
                    {" · "}
                    {[...new Set(group.events.map(eventTime).filter(Boolean))]
                      .map(fmtTime)
                      .join(", ")}
                  </em>
                )}
              </span>

              <div className="tl-tasks">
                {group.events.map((event) => {
                  const id = eventId(event);
                  const done = !!checklist[id];
                  const open = expanded === id;
                  const reminderOn = hasReminder(alarms, event);
                  const t = eventTime(event);
                  return (
                    <div key={id} className={`tl-task ${event.size} ${done ? "done" : ""}`}>
                      <button
                        className="tl-check"
                        aria-label={done ? "Mark not done" : "Mark done"}
                        onClick={() => toggleDone(id)}
                      >
                        {done ? "✓" : ""}
                      </button>
                      <button
                        className={`tl-task-body ${open ? "open" : ""}`}
                        onClick={() => setExpanded(open ? null : id)}
                      >
                        <span className={`tl-task-title ${event.size}`}>
                          {event.custom ? "🔔 " : ""}
                          {event.title}
                          <em className={`tl-time ${t ? "" : "muted"}`}>
                            {t ? fmtTime(t) : "All day"}
                          </em>
                        </span>
                        {open && (
                          <span className="tl-details">
                            {/stools are clear/i.test(event.title) ? STOOL_DETAILS : event.details}
                          </span>
                        )}
                        {open && (
                          <span
                            className="tl-ask"
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAskAboutTask?.(event);
                            }}
                          >
                            {/stools are clear/i.test(event.title)
                              ? "💬 Ask / send stool photo"
                              : "💬 Ask about this task"}
                          </span>
                        )}
                        {open && event.custom && (
                          <span
                            className="tl-remove"
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCustom(event);
                            }}
                          >
                            Remove this reminder
                          </span>
                        )}
                      </button>
                      <div className="tl-task-actions">
                        <button
                          className={`tl-bell ${reminderOn ? "on" : ""}`}
                          title={reminderOn ? "Reminder on. Tap to turn off." : "Remind me"}
                          onClick={() => toggleReminder(event)}
                        >
                          {reminderOn ? "🔔" : "🔕"}
                        </button>
                        <button className="tl-cal" title="Add to calendar" onClick={() => addToCalendar(event)}>
                          📅
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diffDays(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function daysBetween(a, b) {
  return Math.max(0, diffDays(a, b));
}

function fmtTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const d = new Date();
  d.setHours(h, m || 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatShort(dateStr) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatLong(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
