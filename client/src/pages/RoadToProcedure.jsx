import { useEffect, useRef, useState } from "react";
import Timeline from "../components/Timeline.jsx";
import ChatDrawer from "../components/ChatDrawer.jsx";
import AlarmPopup from "../components/AlarmPopup.jsx";
import HospitalInfo from "../components/HospitalInfo.jsx";
import VoiceAgent from "./VoiceAgent.jsx";
import {
  ensureDemoAlarm,
  dueAlarms,
  setAlarmStatus,
  requestNotificationPermission,
  notify,
  playChime,
  addCustomAlarm,
} from "../lib/alarms.js";
import { loadAlarms, loadChecklist, savePlan } from "../lib/storage.js";

function enrichPlanTimes(plan, intake) {
  const procIso = intake?.procedureInformation?.datetimeOfProcedure || "";
  const procTime = procIso.includes("T") ? procIso.slice(11, 16) : "";
  const procDate = procIso.slice(0, 10);
  let alarms = [...(plan.alarms || [])];
  let changed = false;

  // Keep task cards visually consistent (no special major styling).
  let timeline = (plan.timeline || []).map((event) => {
    if (event.size === "major" && event.date !== procDate) {
      changed = true;
      return { ...event, size: "minor" };
    }
    return event;
  });

  // Day-before clear-stool check-in if the stored plan is missing it.
  if (procDate && !timeline.some((e) => /stool|clear yellow|prep.*clear|bowel.*clear/i.test(e.title))) {
    const [y, m, d] = procDate.split("-").map(Number);
    const before = new Date(y, m - 1, d - 1);
    const dayBefore = `${before.getFullYear()}-${String(before.getMonth() + 1).padStart(2, "0")}-${String(before.getDate()).padStart(2, "0")}`;
    timeline = [
      ...timeline,
      {
        date: dayBefore,
        time: "21:00",
        title: "Confirm your stools are clear",
        size: "minor",
        details:
          "By bedtime the night before, stool should look like clear or light yellow liquid with the bottom of the bowl visible. That means the colon is clean enough for the camera to see the lining. If it is still brown, cloudy, or has solid bits, call the GI office before you go to sleep.",
      },
    ];
    changed = true;
    if (!alarms.some((a) => /stool|clear yellow|bowel.*clear/i.test(a.question))) {
      const stoolAlarm = {
        datetime: `${dayBefore}T21:00`,
        question: "Are your stools clear yellow liquid with no solid bits?",
      };
      alarms = [...alarms, stoolAlarm];
      addCustomAlarm("plan-stool-clear", stoolAlarm.datetime, stoolAlarm.question);
    }
  }

  timeline = timeline.map((event) => {
    if (event.time) return event;
    const title = (event.title || "").toLowerCase();
    const alarm = alarms.find((a) => {
      const q = (a.question || "").toLowerCase();
      const key = title.slice(0, 18);
      return (key && q.includes(key)) || (q.length > 12 && title.includes(q.slice(0, 18)));
    });
    if (alarm?.datetime?.includes("T")) {
      changed = true;
      return { ...event, time: alarm.datetime.slice(11, 16) };
    }
    if (procTime && /procedure|colonoscopy|arrival|check.?in|arrive/i.test(event.title)) {
      changed = true;
      return { ...event, time: procTime };
    }
    const m = String(event.details || "").match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    if (m) {
      let h = Number(m[1]);
      const min = m[2];
      const ap = (m[3] || "").toLowerCase();
      if (ap === "pm" && h < 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      changed = true;
      return { ...event, time: `${String(h).padStart(2, "0")}:${min}` };
    }
    return event;
  });
  return changed ? { ...plan, timeline, alarms } : plan;
}

export default function RoadToProcedure({ intake, plan: planProp, onReset }) {
  const [plan] = useState(() => {
    const enriched = enrichPlanTimes(planProp, intake);
    if (enriched !== planProp) savePlan(enriched);
    return enriched;
  });
  const [alarms, setAlarms] = useState([]);
  const [popupQueue, setPopupQueue] = useState([]); // alarm objects awaiting an answer
  const [missedAlarmEvent, setMissedAlarmEvent] = useState(null); // {alarm, ts}
  const [showInfo, setShowInfo] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const queuedIds = useRef(new Set());

  // On launch: arm the demo alarm, surface anything already past due (missed
  // while the app was closed), then poll for alarms coming due while open.
  useEffect(() => {
    requestNotificationPermission();
    const initial = ensureDemoAlarm(plan?.timeline, loadChecklist());
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
        <Timeline events={plan.timeline} procedureDate={procedureDate} planAlarms={plan.alarms} />
      </div>

      <ChatDrawer
        intake={intake}
        plan={plan}
        missedAlarmEvent={missedAlarmEvent}
        onOpenVoice={() => setVoiceOpen(true)}
      />

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

      {voiceOpen && <VoiceAgent intake={intake} onClose={() => setVoiceOpen(false)} />}
    </div>
  );
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const hasTime = /T\d{2}:\d{2}/.test(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}),
    });
  } catch {
    return iso;
  }
}
