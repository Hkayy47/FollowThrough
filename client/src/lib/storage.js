const KEYS = {
  intake: "pon.intake",
  plan: "pon.plan",
  alarms: "pon.alarms",
  chat: "pon.chat",
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

export function resetAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
