// Compact sheet for alarm check-ins. Stays above the chat so the patient can
// answer the next due task while recovery guidance opens for a miss.
export default function AlarmPopup({ alarm, onAnswer, queueLength = 1, elevated }) {
  const when = new Date(alarm.datetime);
  const isPast = when.getTime() < Date.now() - 60_000;
  return (
    <div className={`alarm-sheet ${elevated ? "elevated" : ""}`}>
      <div className="alarm-sheet-row">
        <span className="alarm-bell">⏰</span>
        <div className="alarm-sheet-text">
          {queueLength > 1 && (
            <p className="alarm-queue">
              {queueLength} tasks due today · answering 1 of {queueLength}
            </p>
          )}
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
