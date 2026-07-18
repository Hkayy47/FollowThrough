import { useState } from "react";

export default function Timeline({ events }) {
  const [expanded, setExpanded] = useState(null);
  const sorted = [...(events || [])].sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="timeline">
      {sorted.map((event, i) => {
        const isGoal = i === sorted.length - 1;
        const isPast = event.date < todayStr;
        const isToday = event.date === todayStr;
        const open = expanded === i;
        return (
          <div key={i} className={`tl-item ${isPast ? "past" : ""}`}>
            <div className="tl-rail">
              <span
                className={`tl-node ${event.size} ${isGoal ? "goal" : ""} ${
                  isToday ? "today" : ""
                }`}
              >
                {isGoal ? "🏁" : isPast ? "✓" : ""}
              </span>
              {i < sorted.length - 1 && <span className="tl-line" />}
            </div>
            <button className={`tl-card ${open ? "open" : ""}`} onClick={() => setExpanded(open ? null : i)}>
              <span className="tl-date">
                {formatShort(event.date)}
                {isToday && <em className="tl-today-chip">Today</em>}
              </span>
              <span className={`tl-title ${event.size}`}>{event.title}</span>
              {open && <span className="tl-details">{event.details}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
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
