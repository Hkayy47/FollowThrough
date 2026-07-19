# AllClear (FollowThrough)

**Anthropic × Abridge AI Health Hackathon**

Patients miss prep steps. Procedures get cancelled. AllClear turns a messy After Visit Summary into a day-by-day Road to Procedure — with timed check-ins, a physician-voiced companion, and a last-mile stool-photo check — so patients show up ready.

---

## Project description

**AllClear** is a patient-facing care companion for the gap between referral and outpatient procedure day. This MVP is built end-to-end for **colonoscopy**, where inadequate bowel prep is one of the leading causes of aborted or repeated exams.

The app:

1. **Ingests** the patient’s After Visit Summary (PDF upload) or builds the same structured record through a short manual chat when paperwork is missing.
2. **Plans** a personalized timeline from today through procedure day — diet phases, anticoagulation holds, Clenpiq doses, NPO cutoffs, ride confirmation, and a clear-stool check — with readable clock times on every cutoff.
3. **Coaches** through a chat and voice companion grounded in the patient’s own intake data (not generic advice), with specialist agents for AVS explanation, meds, diet, and prep.
4. **Checks in** with today-only notifications. Missing a step opens recovery guidance in chat while other due tasks stay answerable.
5. **Verifies prep visually** — patients photograph the toilet bowl; the model judges whether stool looks adequate (apple-juice colored, bowl bottom visible) or not.

The clinical contract is `patient_intake_schema.json`. Claude extracts into that schema, plans from it, and answers only from it plus standard prep guidance — routing judgment calls back to the care team.

---

## Demo walkthrough

### 1. Intake
Open AllClear and choose:

| Path | What happens |
|------|----------------|
| **Upload** | Drop `AVS_Delgado_Maria_07182026.pdf`. Claude extracts procedure date/time/location, Eliquis hold, diet phases, Clenpiq timing, pharmacy, and care-team phones into the intake schema. |
| **Manual mode** | Pick GI → Colonoscopy. A conversational agent fills the same schema (name, date, blood thinners, prep instructions, ride home…). |
| **Camera** | Placeholder in this demo. |

### 2. Road to Procedure
From the intake JSON, Claude builds:

- A **timeline** grouped by date (“7 days before” → “Procedure day”), with checklist tasks, expandable plain-language instructions, reminder bells, and calendar export.
- **Ask about this task** on every expanded step — opens chat with that step’s context.
- **Confirm your stools are clear** after the second prep dose, with instructions to photograph the most recent stool (target: apple-juice color).
- Progress toward procedure day, custom reminders between today and the procedure, and a **care-team** panel (tap-to-call).

Clinic-only med changes (e.g. blood-pressure dose tweaks) stay out of the prep timeline; they belong in AVS chat, not the road.

### 3. Companion chat & voice
- Bottom drawer answers using the patient’s record; diet replies suggest grocery ingredients and can add grocery reminders to the plan.
- **Image** button: bowel-prep photo → adequate / inadequate classification.
- **Voice** companion: mini popup over the Road (not a new tab), with transcript save.

### 4. Alarms & recovery
- Today’s due tasks surface as popups (chime + optional browser notification).
- Duplicate questions for the same topic are collapsed.
- **No, I missed it** opens chat for recovery while the next due task stays visible.
- State persists in `localStorage`; ↺ resets the demo.

---

## Quick start

**Requirements:** Node 20+, Anthropic API key.

```bash
# 1. Install
npm run install:all

# 2. Configure
cp .env.example .env        # paste ANTHROPIC_API_KEY

# 3. Run (API :3001, web :5173)
npm run dev
```

Open http://localhost:5173 → **Upload** → `AVS_Delgado_Maria_07182026.pdf`.  
Sample prep photos: `bowelprep_ex_images/`.

---

## Repository layout

```
server/                         Express + Anthropic SDK (claude-opus-4-8)
  index.js                      /api/extract /api/plan /api/chat /api/classify /api/manual-intake
  schemas.js                    structured-output schemas from the intake contract
  prompts.js                    extract, plan, chat experts, classify, manual intake
client/                         Vite + React phone-shell UI
  src/pages/                    Intake, ManualMode, RoadToProcedure, VoiceAgent
  src/components/               Timeline, ChatDrawer, AlarmPopup, HospitalInfo
  src/lib/                      alarms, storage, plan task helpers, API client
patient_intake_schema.json      intake data contract (source of truth)
AVS_Delgado_Maria_07182026.pdf  demo After Visit Summary
bowelprep_ex_images/            sample photos for prep classification
```

The API key stays on the server; the browser only calls `/api/*`.

---

## Why it matters

Inadequate prep and missed peri-procedure instructions waste endoscopy slots, delay cancer screening, and put patients through the prep twice. AllClear closes the loop between “here are your papers” and “you’re cleared for the suite” with a single patient-facing companion that remembers the plan, nagging only about **today**, and catching the last mile with a photo.

---

## Roadmap (beyond this hackathon)

- Specialty expansion in manual mode (cardiology, surgery, ortho, ophtho…)
- RAG over hospital-specific protocols and society guidelines
- Live camera document intake
- EHR / FHIR ingest and escalation to nursing triage
- Native push / SMS and validated prep-photo scoring (e.g. Boston Bowel Prep–aligned)
- Multilingual support and adherence analytics for health systems

---

## Safety

Hackathon demo, not a medical device. Guidance is derived from the demo AVS and standard prep practice. The agent is instructed to send anticoagulation timing changes and urgent symptoms to the patient’s care team — not to invent clinical overrides.
