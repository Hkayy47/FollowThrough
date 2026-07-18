const KEYS = {
  intake: "ac.intake",
  plan: "ac.plan",
  alarms: "ac.alarms",
  chat: "ac.chat",
  checklist: "ac.checklist",
  custom: "ac.custom",
};

const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const loadIntake = () => read(KEYS.intake);
export const saveIntake = (v) => write(KEYS.intake, v);
export const loadPlan = () => read(KEYS.plan);
export const savePlan = (v) => write(KEYS.plan, v);
export const loadAlarms = () => read(KEYS.alarms) || [];
export const saveAlarms = (v) => write(KEYS.alarms, v);
export const loadChat = () => read(KEYS.chat) || [];
export const saveChat = (v) => write(KEYS.chat, v);
export const loadChecklist = () => read(KEYS.checklist) || {};
export const saveChecklist = (v) => write(KEYS.checklist, v);
// Patient-added reminders shown on the timeline alongside plan events.
export const loadCustom = () => read(KEYS.custom) || [];
export const saveCustom = (v) => {
  write(KEYS.custom, v);
  window.dispatchEvent(new Event("ac-custom-updated"));
};

export function resetAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
