import { useState } from "react";
import { loadChecklist, saveChecklist } from "../lib/storage.js";
import {
  loadAlarms,
  eventId,
  setTaskReminder,
  hasReminder,
  requestNotificationPermission,
} from "../lib/alarms.js";

export default function Timeline({ events, procedureDate }) {
  const [expanded, setExpanded] = useState(null); // eventId of the open task
  const [checklist, setChecklist] = useState(loadChecklist);
  const [alarms, setAlarms] = useState(loadAlarms);

  const sorted = [...(events || [])].sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = new Date().toISOString().slice(0, 10);
  const procDate = (procedureDate || sorted[sorted.length - 1]?.date || todayStr).slice(0, 10);

  const groups = [];
  for (const event of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === event.date) last.events.push(event);
    else groups.push({ date: event.date, events: [event] });
  }

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

  return (
    <div className="timeline">
      {groups.map((group, gi) => {
        const isGoal = gi === groups.length - 1;
        const isPast = group.date < todayStr;
        const isToday = group.date === todayStr;
        return (
          <div key={group.date} className={`tl-item ${isPast ? "past" : ""}`}>
            <div className="tl-rail">
              <span className={`tl-node major ${isGoal ? "goal" : ""} ${isToday ? "today" : ""}`}>
                {isGoal ? "🏁" : isPast ? "✓" : ""}
              </span>
              {gi < groups.length - 1 && <span className="tl-line" />}
            </div>
            <div className="tl-card">
              <span className="tl-date">
                {daysBefore(group.date, procDate)} days before
                {isToday && <em className="tl-today-chip">Today</em>}
              </span>
              <span className="tl-title major">{formatShort(group.date)}</span>

              <div className="tl-tasks">
                {group.events.map((event) => {
                  const id = eventId(event);
                  const done = !!checklist[id];
                  const open = expanded === id;
                  const reminderOn = hasReminder(alarms, event);
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
                        <span className={`tl-task-title ${event.size}`}>{event.title}</span>
                        {open && <span className="tl-details">{event.details}</span>}
                      </button>
                      <button
                        className={`tl-bell ${reminderOn ? "on" : ""}`}
                        title={reminderOn ? "Reminders on — tap to turn off" : "Turn on reminders"}
                        aria-label={reminderOn ? "Turn off reminder" : "Turn on reminder"}
                        onClick={() => toggleReminder(event)}
                      >
                        {reminderOn ? "🔔" : "🔕"}
                      </button>
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

function daysBefore(dateStr, procDateStr) {
  try {
    const [y1, m1, d1] = dateStr.split("-").map(Number);
    const [y2, m2, d2] = procDateStr.split("-").map(Number);
    const a = Date.UTC(y1, m1 - 1, d1);
    const b = Date.UTC(y2, m2 - 1, d2);
    return Math.max(0, Math.round((b - a) / 86400000));
  } catch {
    return 0;
  }
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
