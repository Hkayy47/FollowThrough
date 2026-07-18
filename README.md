# FollowThrough — Pre-Op Navigator

**Anthropic x Abridge AI Health Hackathon**

A patient-facing app (web demo of a mobile experience) that coordinates care from the point of referral to procedure day, making sure patients arrive appropriately optimized for their outpatient procedure. This POC/MVP is tailored end-to-end to **colonoscopy**.

## What the demo does

1. **Patient Intake** — Open the app ("Pre-Op Navigator") and choose one of three inputs:
   - 📷 **Camera** — placeholder in the demo (shows a "not available" toast)
   - 📄 **Upload** — drop in a PDF After Visit Summary (use `AVS_Delgado_Maria_07182026.pdf`). Claude reads the document and extracts it into the `patient_intake_schema.json` data contract: procedure date/time/location, medication holds (e.g. Eliquis stop/restart days), diet phases, bowel prep product and timing, pharmacy, and every care-team phone number.
   - ✍️ **Manual mode** — for patients who misplaced their paperwork: pick a specialty (GI live; Cardiology/Surgery/Ortho/Ophtho shown as coming soon) → pick a procedure (Colonoscopy live) → a conversational agent asks the schema-relevant questions (procedure date, blood thinners, diabetes meds, prep instructions, ride home…) and fills the same intake JSON.

2. **Road to Procedure** — From the intake JSON, Claude generates:
   - A **timeline** from today to procedure day: dotted vertical line, minor events as small nodes, major safety events (anticoagulation holds, prep doses, procedure day) as large nodes. Every event expands into a pre-generated plain-language explanation.
   - A **greeting** (10–20 words on what the agent understood) and **prompt-suggestion bubbles** ("Explain my AVS to me", diet, meds, pharmacy, bowel prep, "Do you have someone to care for you?").
   - **Alarms** for every actionable step, stored in the app.
   - Top-right **care-team panel**: patient name, procedure location, and tap-to-call numbers (PCP, GI office, pharmacy, emergency contact).

3. **Chat companion** — the drawer at the bottom answers questions using the patient's actual record. Next to the input: an **image button** (send a toilet-bowl photo; Claude classifies prep as *adequate* — clear/apple-juice-colored, bowl bottom visible — or *inadequate*, and tells the patient to stop or keep going) and a **call button** (dials the GI office).

4. **Alarms & missed-step recovery**
   - A demo alarm rings **10 seconds after the timeline loads**: "Did you take the medication yet?" with a chime, an animated popup, and (if permitted) a browser notification.
   - Close and reopen the app after alarms have passed: the app asks about each missed alarm, one popup at a time, with the specific question. Answering **"No, I missed it"** opens the chat, where the agent explains what the miss means and what to focus on now to still reach adequate prep.
   - Everything (intake, timeline, alarms, chat) persists in `localStorage`, so the demo survives reloads.

## Running the demo

Requirements: Node 20+, an Anthropic API key.

```bash
# 1. Install
npm run install:all

# 2. Configure
cp .env.example .env        # then paste your ANTHROPIC_API_KEY into .env

# 3. Run (starts API server on :3001 and web app on :5173)
npm run dev
```

Open http://localhost:5173, click **Upload**, and select `AVS_Delgado_Maria_07182026.pdf`. Sample bowel-prep photos for the classifier are in `bowelprep_ex_images/`.

To restart the demo from scratch, tap the ↺ button in the app header (clears local storage).

## Repository layout

```
server/                     Express + Anthropic SDK (claude-opus-4-8)
  index.js                  /api/extract /api/plan /api/chat /api/classify /api/manual-intake
  schemas.js                structured-output schemas derived from patient_intake_schema.json
  prompts.js                system prompts per endpoint
client/                     Vite + React, styled as a phone
patient_intake_schema.json  the intake data contract (source of truth)
AVS_Delgado_Maria_07182026.pdf   demo After Visit Summary
bowelprep_ex_images/        sample photos for prep-adequacy classification
```

The API key lives only on the server; the browser talks to `/api/*`.

## The full vision (not yet implemented)

This demo proves the loop for one procedure. The product vision is a universal pre-procedure optimization layer:

- **Every specialty in manual mode.** The specialty grid already hints at it: cardiology (cath / TAVR workups, anticoagulation bridging), general surgery (pre-op optimization: smoking cessation, glycemic control, NPO rules), orthopedics (joint-replacement "prehab", skin prep, dental clearance), ophthalmology (cataract drops schedules), urology, and more — each with procedure-specific intake questions, timelines, and check-ins.
- **RAG over real protocols instead of prompt-embedded guidance.** A retrieval layer over institution-specific prep protocols, payer rules, and society guidelines (ASGE, ASA, ACC/AHA perioperative guidance), versioned per hospital, so the agent's answers cite the patient's *own* institution's instructions rather than general knowledge.
- **Camera intake with document understanding** — photograph a crumpled paper AVS and get the same structured extraction (the third intake button, live).
- **EHR / FHIR integration** — ingest the AVS automatically at discharge (e.g. via SMART on FHIR / CDS Hooks), push adherence data back to the chart, and alert the endoscopy suite when a patient is trending toward inadequate prep (a leading cause of cancelled procedures).
- **Real notifications and native apps** — actual push notifications, SMS fallback for low-tech patients, iOS/Android builds; the current web alarms are a stand-in.
- **Nurse-facing escalation dashboard** — when a patient reports a missed anticoagulation hold or can't finish prep, route it to a triage queue instead of only advising "call the office".
- **Better prep-photo analysis** — a validated adequacy model (e.g. Boston Bowel Prep-aligned), trend tracking across photos, and time-to-clear prediction.
- **Social & logistics support** — confirm the ride home, caregiver coordination, transportation assistance referrals.
- **Multilingual support and accessibility** — the populations with the worst prep-failure rates benefit the most.
- **Adherence analytics** — measure cancellation and inadequate-prep rates against baseline to prove ROI to health systems.

## Safety note

This is a hackathon demo, not a medical device. All clinical guidance shown is derived from the demo document and general prep guidance, and the agent is instructed to route judgment calls ("should I change my blood-thinner timing?") to the patient's care team.
