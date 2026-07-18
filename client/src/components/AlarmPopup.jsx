// Compact bottom sheet for alarm check-ins. The attention-getting part is the
// browser notification and chime; this sheet just collects the yes/no answer
// without blocking the rest of the app.
export default function AlarmPopup({ alarm, onAnswer }) {
  const when = new Date(alarm.datetime);
  const isPast = when.getTime() < Date.now() - 60_000;
  return (
    <div className="alarm-sheet">
      <div className="alarm-sheet-row">
        <span className="alarm-bell">⏰</span>
        <div className="alarm-sheet-text">
          {isPast && (
            <p className="alarm-when">
              From{" "}
              {when.toLocaleString(undefined, {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
          <h3>{alarm.question}</h3>
        </div>
      </div>
      <div className="alarm-actions">
        <button className="btn primary" onClick={() => onAnswer(alarm, true)}>
          Yes, done
        </button>
        <button className="btn danger" onClick={() => onAnswer(alarm, false)}>
          No, I missed it
        </button>
      </div>
    </div>
  );
}
