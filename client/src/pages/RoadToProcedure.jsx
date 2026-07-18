import { useEffect, useRef, useState } from "react";
import Timeline from "../components/Timeline.jsx";
import ChatDrawer from "../components/ChatDrawer.jsx";
import AlarmPopup from "../components/AlarmPopup.jsx";
import HospitalInfo from "../components/HospitalInfo.jsx";
import {
  ensureDemoAlarm,
  dueAlarms,
  setAlarmStatus,
  requestNotificationPermission,
  notify,
  playChime,
} from "../lib/alarms.js";
import { loadAlarms } from "../lib/storage.js";

export default function RoadToProcedure({ intake, plan, onReset }) {
  const [alarms, setAlarms] = useState([]);
  const [popupQueue, setPopupQueue] = useState([]); // alarm objects awaiting an answer
  const [missedAlarmEvent, setMissedAlarmEvent] = useState(null); // {alarm, ts}
  const [showInfo, setShowInfo] = useState(false);
  const queuedIds = useRef(new Set());

  // On launch: arm the demo alarm, surface anything already past due (missed
  // while the app was closed), then poll for alarms coming due while open.
  useEffect(() => {
    requestNotificationPermission();
    const initial = ensureDemoAlarm();
    setAlarms(initial);

    const enqueue = (due, ring) => {
      const fresh = due.filter((a) => !queuedIds.current.has(a.id));
      if (!fresh.length) return;
      fresh.forEach((a) => queuedIds.current.add(a.id));
      setPopupQueue((q) => [...q, ...fresh]);
      if (ring) {
        playChime();
        fresh.forEach((a) => notify(a.question));
      }
    };

    // Already-due alarms = missed while closed (no chime, straight to popup).
    enqueue(dueAlarms(initial), false);

    const timer = setInterval(() => {
      enqueue(dueAlarms(loadAlarms()), true);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  function answerAlarm(alarm, didIt) {
    const updated = setAlarmStatus(alarm.id, didIt ? "done" : "missed");
    setAlarms(updated);
    setPopupQueue((q) => q.filter((a) => a.id !== alarm.id));
    if (!didIt) {
      setMissedAlarmEvent({ alarm, ts: Date.now() });
    }
  }

  const procedureDate = intake?.procedureInformation?.datetimeOfProcedure;
  const patientName = [
    intake?.demographics?.name?.firstName,
    intake?.demographics?.name?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="page road-page">
      <header className="road-header">
        <div>
          <h2>Road to Procedure</h2>
          <p className="road-sub">
            {intake?.procedureInformation?.procedure || "Your procedure"}
            {procedureDate ? ` · ${formatDate(procedureDate)}` : ""}
          </p>
        </div>
        <div className="header-actions">
          <button className="icon-btn" title="Care team & contacts" onClick={() => setShowInfo(true)}>
            🏥
          </button>
          <button className="icon-btn subtle" title="Start over" onClick={onReset}>
            ↺
          </button>
        </div>
      </header>

      <div className="road-scroll">
        <Timeline events={plan.timeline} />
      </div>

      <ChatDrawer intake={intake} plan={plan} missedAlarmEvent={missedAlarmEvent} />

      {showInfo && (
        <HospitalInfo
          patientName={patientName}
          intake={intake}
          onClose={() => setShowInfo(false)}
        />
      )}

      {popupQueue.length > 0 && (
        <AlarmPopup alarm={popupQueue[0]} onAnswer={answerAlarm} />
      )}
    </div>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
