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
  sameAlarmTopic,
} from "../lib/alarms.js";
import { loadAlarms, loadChecklist, savePlan } from "../lib/storage.js";
import { ensureStoolClearTask } from "../lib/planTasks.js";

function enrichPlanTimes(plan, intake) {
  const procIso = intake?.procedureInformation?.datetimeOfProcedure || "";
  const procTime = procIso.includes("T") ? procIso.slice(11, 16) : "";
  const procDate = procIso.slice(0, 10);
  let changed = false;

  // Keep task cards visually consistent (no special major styling).
  let timeline = (plan.timeline || []).map((event) => {
    if (event.size === "major" && event.date !== procDate) {
      changed = true;
      return { ...event, size: "minor" };
    }
    return event;
  });
  let next = { ...plan, timeline };

  // Always place stool-clear after the second prep dose (relocates older day-before copies).
  const withStool = ensureStoolClearTask(next, intake);
  if (JSON.stringify(withStool.timeline) !== JSON.stringify(next.timeline)) {
    changed = true;
    next = withStool;
    const stool = next.timeline.find((e) => /stools are clear/i.test(e.title));
    if (stool) {
      addCustomAlarm(
        "plan-stool-clear",
        `${stool.date}T${stool.time || "06:00"}`,
        "Are your stools clear yellow liquid with no solid bits? Take a clear photo if you want a final check."
      );
    }
  }

  let alarms = [...(next.alarms || [])];
  timeline = next.timeline.map((event) => {
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
  return changed ? { ...next, timeline, alarms: next.alarms } : plan;
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
  const [taskChatEvent, setTaskChatEvent] = useState(null); // {event, ts}
  const [chatOpen, setChatOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const queuedIds = useRef(new Set());
  const popupQueueRef = useRef([]);

  // On launch: arm the demo alarm, surface anything already past due (missed
  // while the app was closed), then poll for alarms coming due while open.
  useEffect(() => {
    requestNotificationPermission();
    const initial = ensureDemoAlarm(plan?.timeline, loadChecklist());
    setAlarms(initial);

    const enqueue = (due, ring) => {
      const current = popupQueueRef.current;
      const add = due.filter((a) => {
        if (queuedIds.current.has(a.id)) return false;
        if (current.some((kept) => sameAlarmTopic(kept, a))) return false;
        return true;
      });
      if (!add.length) return;
      add.forEach((a) => queuedIds.current.add(a.id));
      const next = [...current, ...add];
      popupQueueRef.current = next;
      setPopupQueue(next);
      if (ring) {
        playChime();
        add.forEach((a) => notify(a.question));
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
    // Drop this alarm and any same-topic twin still waiting in the queue.
    const nextQueue = popupQueueRef.current.filter(
      (a) => a.id !== alarm.id && !sameAlarmTopic(a, alarm)
    );
    popupQueueRef.current = nextQueue;
    setPopupQueue(nextQueue);
    if (!didIt) {
      setChatOpen(true);
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
        <Timeline
          events={plan.timeline}
          procedureDate={procedureDate}
          planAlarms={plan.alarms}
          onAskAboutTask={(event) => setTaskChatEvent({ event, ts: Date.now() })}
        />
      </div>

      <ChatDrawer
        intake={intake}
        plan={plan}
        missedAlarmEvent={missedAlarmEvent}
        taskChatEvent={taskChatEvent}
        onOpenVoice={() => setVoiceOpen(true)}
        onOpenChange={setChatOpen}
      />

      {showInfo && (
        <HospitalInfo
          patientName={patientName}
          intake={intake}
          onClose={() => setShowInfo(false)}
        />
      )}

      {popupQueue.length > 0 && (
        <AlarmPopup
          alarm={popupQueue[0]}
          onAnswer={answerAlarm}
          queueLength={popupQueue.length}
          elevated={chatOpen}
        />
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
