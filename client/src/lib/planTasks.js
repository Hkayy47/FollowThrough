const STOOL_TITLE = "Confirm your stools are clear";
export const STOOL_DETAILS =
  "Take a clear photo of your most recent stool in the toilet bowl and send it in chat for a final check. Ready looks like apple-juice colored liquid (light yellow and see-through) with the bottom of the bowl visible and no solid bits. That means the colon is clean enough for the camera to see the lining. If it is still brown, cloudy, or has solid pieces, keep drinking clear fluids as directed and call the GI office.";

function findSecondPrepDose(timeline) {
  const doses = (timeline || [])
    .filter((e) => !/stool|clear yellow/i.test(e.title || ""))
    .filter((e) => /clenpiq|bowel.?prep|prep dose/i.test(`${e.title} ${e.details || ""}`))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.time || "00:00").localeCompare(b.time || "00:00")
    );
  return (
    doses.find((e) => /second|2nd|final dose|dose\s*2/i.test(`${e.title} ${e.details || ""}`)) ||
    doses[1] ||
    doses[doses.length - 1] ||
    null
  );
}

function addMinutesToTime(hhmm, add) {
  const [h, m] = (hhmm || "06:00").split(":").map(Number);
  const total = Math.max(0, h * 60 + (m || 0) + add);
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function sortTimeline(timeline) {
  return [...timeline].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99")
  );
}

// Drop clinic BP / chronic-med change tasks that are not part of procedure prep
// (e.g. start amlodipine, increase lisinopril from the wellness visit AVS).
function isNonPrepMedTask(event) {
  const t = `${event.title || ""} ${event.details || ""}`.toLowerCase();
  if (
    /eliquis|apixaban|clenpiq|bowel|npo|anticoagul|blood thinner|warfarin|xarelto|plavix|hold|skip|restart|prep dose/i.test(
      t
    )
  ) {
    return false;
  }
  return /amlodipine|lisinopril|losartan|chlorthalidone|hydrochlorothiazide|cozaar|blood pressure/.test(
    t
  );
}

export function stripNonPrepMedTasks(plan) {
  if (!plan?.timeline) return plan;
  const timeline = plan.timeline.filter((e) => !isNonPrepMedTask(e));
  const alarms = (plan.alarms || []).filter((a) => {
    const q = (a.question || "").toLowerCase();
    if (/eliquis|apixaban|clenpiq|bowel|hold|prep|ride|stool/i.test(q)) return true;
    return !/amlodipine|lisinopril|losartan|chlorthalidone|hydrochlorothiazide|cozaar|blood pressure/.test(
      q
    );
  });
  if (timeline.length === plan.timeline.length && alarms.length === (plan.alarms || []).length) {
    return plan;
  }
  return { ...plan, timeline, alarms };
}

// Place (or relocate) the stool-clear check right after the second prep dose.
export function ensureStoolClearTask(plan, intake) {
  plan = stripNonPrepMedTasks(plan);
  if (!plan?.timeline) return plan;
  const procIso = intake?.procedureInformation?.datetimeOfProcedure || "";
  const procDate =
    procIso.slice(0, 10) ||
    [...plan.timeline].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;
  if (!procDate) return plan;

  const withoutStool = plan.timeline.filter(
    (e) => !/confirm your stools are clear|stools are clear/i.test(e.title || "")
  );
  const second = findSecondPrepDose(withoutStool);

  let date;
  let time;
  if (second) {
    date = second.date;
    time = addMinutesToTime(second.time || "02:00", 90);
  } else {
    date = procDate;
    const arrival = procIso.includes("T") ? procIso.slice(11, 16) : "07:00";
    // Second dose is typically ~5 hours before arrival; check ~90 min after that.
    time = addMinutesToTime(arrival, -5 * 60 + 90);
  }

  const stoolEvent = {
    date,
    time,
    title: STOOL_TITLE,
    size: "minor",
    details: STOOL_DETAILS,
  };

  const alarms = (plan.alarms || []).filter(
    (a) => !/stool|clear yellow|bowel.*clear/i.test(a.question || "")
  );
  alarms.push({
    datetime: `${date}T${time}`,
    question: "Are your stools clear yellow liquid with no solid bits? Take a clear photo if you want a final check.",
  });

  return {
    ...plan,
    timeline: sortTimeline([...withoutStool, stoolEvent]),
    alarms,
  };
}
