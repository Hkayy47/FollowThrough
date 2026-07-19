# AllClear — Agent architecture (demo script)

*~60–90 seconds. Speak to the diagram, not the code.*

---

## Spoken script

AllClear is not one chatbot. It is a **pipeline of specialist agents**, each with one job, all grounded in the same patient intake record.

**First, Intake.**  
When Maria uploads her After Visit Summary, an **Extract agent** reads the PDF and fills a structured schema — procedure date, Eliquis hold, diet phases, Clenpiq timing, pharmacy, care-team phones. If she has no paperwork, a **Manual Intake agent** asks the same questions in conversation and produces that same JSON. That record is the source of truth for everything downstream.

**Second, Planning.**  
A **Plan agent** turns the intake into her Road to Procedure — timed tasks from today to colonoscopy day, alarms, and suggestion chips. It only schedules prep-relevant steps, not random clinic med changes.

**Third, Companion chat — routed experts.**  
When she asks a question, the app does not dump everything into one mega-prompt. A lightweight router picks a specialist:

- **AVS explainer** or **AVS guide** for the summary itself  
- **Meds** for holds and doses  
- **Diet** for food rules and grocery reminders  
- **Prep** for Clenpiq and clear-stool coaching  

Each expert gets a short persona plus her full intake. Missed-step recovery and “ask about this task” inject situation context so the answer is about *her* plan, right now. Voice mode uses the same brain with spoken-style rules.

**Fourth, Vision.**  
A **Classify agent** looks at a toilet-bowl photo and judges adequate versus inadequate prep — apple-juice color, bowl bottom visible.

So the architecture is: **extract or interview → plan → route to the right expert → verify with vision**, all locked to one structured patient record. Fast prompts, clear ownership, and a clean handoff back to the care team when judgment is required.

---

## Glanceable map

```
AVS PDF ──▶ Extract agent ──┐
                            ├──▶ Intake JSON (schema = source of truth)
Manual chat ──▶ Manual agent ┘              │
                                            ▼
                                      Plan agent
                               (timeline · alarms · chips)
                                            │
              ┌─────────────────────────────┼─────────────────────┐
              ▼                             ▼                     ▼
     Road UI + today alarms          Chat / Voice router      Photo upload
                                            │                     │
                    ┌───────────┬───────────┼───────────┐         ▼
                    ▼           ▼           ▼           ▼   Classify agent
                 AVS /      Diet        Meds        Prep     (adequate?)
               AVS guide   expert      expert      expert
```

---

## One-liner (if you only have 10 seconds)

“We split AllClear into specialist agents — extract, plan, meds, diet, prep, vision — all reading one structured intake, so every answer is short, accurate, and about *this* patient’s procedure.”
