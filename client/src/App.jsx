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
      const { plan: newPlan } = await buildPlan(newIntake);
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
