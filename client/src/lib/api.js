async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const extractAvs = (pdfBase64) => post("/api/extract", { pdfBase64 });
export const buildPlan = (intake) => post("/api/plan", { intake });
export const chat = (messages, intake, opts = {}) =>
  post("/api/chat", { messages, intake, ...opts }); // opts: { context, agent, voice }
export const classifyPrep = (imageBase64, mediaType) =>
  post("/api/classify", { imageBase64, mediaType });
export const manualIntake = (messages, intakeSoFar, specialty, procedure) =>
  post("/api/manual-intake", { messages, intakeSoFar, specialty, procedure });

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
