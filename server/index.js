import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

// Load the repo-root .env regardless of the working directory npm runs us from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config(); // also honor a local server/.env if present
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import {
  intakeSchema,
  planSchema,
  classifySchema,
  manualIntakeSchema,
} from "./schemas.js";
import {
  EXTRACT_SYSTEM,
  planSystem,
  chatSystem,
  CLASSIFY_SYSTEM,
  manualIntakeSystem,
} from "./prompts.js";

const MODEL = "claude-opus-4-8";
const client = new Anthropic();
const app = express();
app.use(cors());
app.use(express.json({ limit: "40mb" }));

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function firstText(response) {
  const block = response.content.find((b) => b.type === "text");
  return block ? block.text : "";
}

async function structured({ system, content, schema, max_tokens = 16000, effort = "medium" }) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens,
    system,
    messages: [{ role: "user", content }],
    output_config: { effort, format: { type: "json_schema", schema } },
  });
  return JSON.parse(firstText(response));
}

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Server error" });
  }
};

// 1. AVS PDF -> intake JSON
app.post(
  "/api/extract",
  wrap(async (req, res) => {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: "pdfBase64 required" });
    const intake = await structured({
      system: EXTRACT_SYSTEM,
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          type: "text",
          text: "Extract this After Visit Summary into the intake schema.",
        },
      ],
      schema: intakeSchema,
    });
    res.json({ intake });
  })
);

// 2. intake JSON -> timeline / greeting / suggestions / alarms
app.post(
  "/api/plan",
  wrap(async (req, res) => {
    const { intake } = req.body;
    if (!intake) return res.status(400).json({ error: "intake required" });
    const plan = await structured({
      system: planSystem(today()),
      content: [
        {
          type: "text",
          text: `Patient intake JSON:\n${JSON.stringify(intake, null, 2)}`,
        },
      ],
      schema: planSchema,
    });
    res.json({ plan });
  })
);

// 3. free-form chat
app.post(
  "/api/chat",
  wrap(async (req, res) => {
    const { messages, intake, context, agent, voice } = req.body;
    if (!messages?.length)
      return res.status(400).json({ error: "messages required" });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: voice ? 1000 : 2500,
      system: chatSystem(intake ?? {}, context, agent, voice),
      messages,
      output_config: { effort: "low" },
    });
    res.json({ reply: firstText(response) });
  })
);

// 4. bowel-prep photo -> adequate / inadequate
app.post(
  "/api/classify",
  wrap(async (req, res) => {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64)
      return res.status(400).json({ error: "imageBase64 required" });
    const result = await structured({
      system: CLASSIFY_SYSTEM,
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType || "image/jpeg",
            data: imageBase64,
          },
        },
        { type: "text", text: "Assess this bowel prep photo." },
      ],
      schema: classifySchema,
      max_tokens: 2000,
      effort: "low",
    });
    const message = result.adequate
      ? `Great news — your prep looks adequate! ${result.reason} You can stop; you're prepped and ready.`
      : `Not quite there yet. ${result.reason} Keep going with your bowel prep and drink extra clear fluids.`;
    res.json({ ...result, message });
  })
);

// 5. manual-mode conversational intake
app.post(
  "/api/manual-intake",
  wrap(async (req, res) => {
    const { messages, intakeSoFar, specialty, procedure } = req.body;
    const convo = messages?.length
      ? messages
      : [{ role: "user", content: "Hi, I'm ready to get started." }];
    const result = await structured({
      system: manualIntakeSystem(
        today(),
        specialty || "GI",
        procedure || "Colonoscopy"
      ),
      content: [
        {
          type: "text",
          text: `Intake collected so far:\n${JSON.stringify(
            intakeSoFar ?? null
          )}\n\nConversation so far (last message is the patient's latest):\n${convo
            .map((m) => `${m.role === "user" ? "PATIENT" : "YOU"}: ${m.content}`)
            .join("\n")}`,
        },
      ],
      schema: manualIntakeSchema,
      effort: "low",
    });
    res.json(result);
  })
);

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY) })
);

const port = process.env.PORT || 3001;
app.listen(port, () =>
  console.log(`AllClear server listening on :${port}`)
);
