// Build and download an .ics calendar file for a single timeline event.

function pad(n) {
  return String(n).padStart(2, "0");
}

function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function downloadEventIcs(event, alarmDatetime) {
  const [y, m, d] = event.date.split("-").map(Number);
  let dtStart;
  let dtEnd;
  if (alarmDatetime) {
    const t = new Date(alarmDatetime);
    dtStart = `DTSTART:${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}T${pad(t.getHours())}${pad(t.getMinutes())}00`;
    const end = new Date(t.getTime() + 30 * 60000);
    dtEnd = `DTEND:${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  } else {
    const next = new Date(y, m - 1, d + 1);
    dtStart = `DTSTART;VALUE=DATE:${y}${pad(m)}${pad(d)}`;
    dtEnd = `DTEND;VALUE=DATE:${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
  }
  const stamp = new Date();
  const dtstamp = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AllClear//Pre-Procedure Navigator//EN",
    "BEGIN:VEVENT",
    `UID:allclear-${event.date}-${event.title.replace(/\W+/g, "-").toLowerCase()}@allclear`,
    `DTSTAMP:${dtstamp}`,
    dtStart,
    dtEnd,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.details)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/\W+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
