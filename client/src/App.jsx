import { useState } from "react";
import Intake from "./pages/Intake.jsx";
import ManualMode from "./pages/ManualMode.jsx";
import RoadToProcedure from "./pages/RoadToProcedure.jsx";
import { extractAvs, buildPlan, fileToBase64 } from "./lib/api.js";
import {
  loadIntake,
  loadPlan,
  saveIntake,
  savePlan,
  resetAll,
} from "./lib/storage.js";
import { initAlarms } from "./lib/alarms.js";
// Guarantee day-before check-ins exist even if the model omitted them.
function ensureDayBeforeTasks(plan, intake) {
  const proc = (intake?.procedureInformation?.datetimeOfProcedure || "").slice(0, 10) ||
    [...plan.timeline].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;
  if (!proc) return plan;
  const [y, m, d] = proc.split("-").map(Number);
  const before = new Date(y, m - 1, d - 1);
  const dayBefore = `${before.getFullYear()}-${String(before.getMonth() + 1).padStart(2, "0")}-${String(before.getDate()).padStart(2, "0")}`;

  if (!plan.timeline.some((e) => /ride|pick.?up|drive/i.test(e.title))) {
    plan.timeline.push({
      date: dayBefore,
      time: "18:00",
      title: "Confirm your ride home",
      size: "minor",
      details:
        "Call or message the person picking you up and confirm the time and place. Sedation slows your reflexes and judgment for the rest of the day, so most centers will not start the procedure unless a licensed adult is arranged to take you home.",
    });
  }
  if (!plan.alarms.some((a) => /ride|pick.?up|drive/i.test(a.question))) {
    plan.alarms.push({
      datetime: `${dayBefore}T18:00`,
      question: "Have you confirmed who is picking you up after your procedure?",
    });
  }

  if (!plan.timeline.some((e) => /stool|clear yellow|prep.*clear|bowel.*clear/i.test(e.title))) {
    plan.timeline.push({
      date: dayBefore,
      time: "21:00",
      title: "Confirm your stools are clear",
      size: "minor",
      details:
        "By bedtime the night before, stool should look like clear or light yellow liquid with the bottom of the bowl visible. That means the colon is clean enough for the camera to see the lining. If it is still brown, cloudy, or has solid bits, call the GI office before you go to sleep.",
    });
  }
  if (!plan.alarms.some((a) => /stool|clear yellow|bowel.*clear/i.test(a.question))) {
    plan.alarms.push({
      datetime: `${dayBefore}T21:00`,
      question: "Are your stools clear yellow liquid with no solid bits?",
    });
  }
  return plan;
}

// Fill missing clock times from alarms, procedure datetime, or details text
// so every cutoff shows a readable stamp on the timeline.
function enrichPlanTimes(plan, intake) {
  const procIso = intake?.procedureInformation?.datetimeOfProcedure || "";
  const procTime = procIso.includes("T") ? procIso.slice(11, 16) : "";
  const alarms = plan.alarms || [];

  plan.timeline = (plan.timeline || []).map((event) => {
    if (event.time) return event;

    const title = (event.title || "").toLowerCase();
    const alarm = alarms.find((a) => {
      const q = (a.question || "").toLowerCase();
      const key = title.slice(0, 18);
      return (key && q.includes(key)) || (q.length > 12 && title.includes(q.slice(0, 18)));
    });
    if (alarm?.datetime?.includes("T")) {
      return { ...event, time: alarm.datetime.slice(11, 16) };
    }

    if (procTime && /procedure|colonoscopy|arrival|check.?in|arrive/i.test(event.title)) {
      return { ...event, time: procTime };
    }

    const fromDetails = parseClock(event.details);
    if (fromDetails) return { ...event, time: fromDetails };

    return event;
  });
  return plan;
}

function parseClock(text) {
  if (!text) return "";
  const m = String(text).match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2];
  const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h > 23) return "";
  return `${String(h).padStart(2, "0")}:${min}`;
}

export default function App() {
  const [intake, setIntake] = useState(loadIntake);
  const [plan, setPlan] = useState(loadPlan);
  const [view, setView] = useState(() => (loadPlan() ? "road" : "intake"));
  const [status, setStatus] = useState(null); // null | "extracting" | "planning"
  const [error, setError] = useState(null);

  async function finishIntake(newIntake) {
    setError(null);
    setStatus("planning");
    try {
      const { plan: rawPlan } = await buildPlan(newIntake);
      const newPlan = enrichPlanTimes(ensureDayBeforeTasks(rawPlan, newIntake), newIntake);
      saveIntake(newIntake);
      savePlan(newPlan);
      initAlarms(newPlan.alarms);
      setIntake(newIntake);
      setPlan(newPlan);
      setView("road");
    } catch (e) {
      setError(e.message);
    } finally {
      setStatus(null);
    }
  }

  async function handleUpload(file) {
    setError(null);
    setStatus("extracting");
    try {
      const pdfBase64 = await fileToBase64(file);
      const { intake: extracted } = await extractAvs(pdfBase64);
      await finishIntake(extracted);
    } catch (e) {
      setError(e.message);
      setStatus(null);
    }
  }

  function handleReset() {
    resetAll();
    setIntake(null);
    setPlan(null);
    setView("intake");
  }

  return (
    <div className="phone-shell">
      <div className="phone">
        {view === "intake" && (
          <Intake
            onUpload={handleUpload}
            onManual={() => setView("manual")}
            error={error}
          />
        )}
        {view === "manual" && (
          <ManualMode
            onBack={() => setView("intake")}
            onComplete={finishIntake}
            error={error}
          />
        )}
        {view === "road" && plan && (
          <RoadToProcedure intake={intake} plan={plan} onReset={handleReset} />
        )}
        {status && (
          <div className="overlay">
            <div className="overlay-card">
              <div className="spinner" />
              <p>
                {status === "extracting"
                  ? "Reading your After Visit Summary…"
                  : "Building your personalized Road to Procedure…"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
