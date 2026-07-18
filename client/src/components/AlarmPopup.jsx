export default function AlarmPopup({ alarm, onAnswer }) {
  const when = new Date(alarm.datetime);
  const isPast = when.getTime() < Date.now() - 60_000;
  return (
    <div className="overlay">
      <div className="alarm-card">
        <div className="alarm-bell">⏰</div>
        {isPast && (
          <p className="alarm-when">
            Reminder from {when.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}
        <h3>{alarm.question}</h3>
        <div className="alarm-actions">
          <button className="btn primary" onClick={() => onAnswer(alarm, true)}>
            Yes, done ✓
          </button>
          <button className="btn danger" onClick={() => onAnswer(alarm, false)}>
            No, I missed it
          </button>
        </div>
      </div>
    </div>
  );
}
