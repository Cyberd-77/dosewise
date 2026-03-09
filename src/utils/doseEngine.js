import { addHours, differenceInHours, formatDistanceToNow } from "date-fns";

/* =====================================================
   TIME NORMALIZATION (for migrations / defensive parsing)
   ===================================================== */

/**
 * If a timestamp is in "YYYY-MM-DDTHH:mm:ss" (no timezone),
 * interpret it as local time and convert to ISO Zulu.
 * If it already has a timezone (Z or ±HH:MM), return as-is.
 */
export function normalizeTimestampString(value) {
  if (typeof value !== "string") return value;

  // Already ISO with timezone ("Z" or ±HH:MM)
  const hasTz = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
  if (hasTz) return value;

  // Naive local timestamp "YYYY-MM-DDTHH:mm:ss" (optionally with .sss)
  const naive = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(value);
  if (!naive) return value;

  const d = new Date(value); // interpreted as local time in JS engines
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

/* =====================================================
   NORMALIZATION — keeps scheduled meds from showing PRN
   ===================================================== */
export function normalizeMedication(med) {
  // Defensive defaults
  const history = Array.isArray(med?.history) ? med.history : [];

  // PRN strictly means: no intervalHours
  const intervalHours = med?.intervalHours ?? null;

  // Normalize timestamp fields if present
  const lastTaken = normalizeTimestampString(med?.lastTaken ?? null);
  const nextDose = normalizeTimestampString(med?.nextDose ?? null);

  const base = {
    ...med,
    history: history.map((h) => ({
      ...h,
      time: normalizeTimestampString(h?.time),
    })),
    lastTaken,
    nextDose,
    // Keep persisted 'prn' consistent with rule (non-authoritative, but normalized)
    prn: !intervalHours,
  };

  // PRN meds: no derivation required
  if (!intervalHours) return base;

  // Scheduled med:
  // If nextDose already exists, trust it (stable behavior)
  if (base.nextDose) return base;

  // If there is no history, we cannot derive anything yet => NOT STARTED (NS)
  if (!base.history || base.history.length === 0) return base;

  // Find most recent TAKEN entry
  const lastTakenEntry = [...base.history].reverse().find((h) => h.type === "TAKEN");
  if (!lastTakenEntry?.time) return base;

  const lastTakenIso = normalizeTimestampString(lastTakenEntry.time);
  const lastTakenDate = new Date(lastTakenIso);
  if (Number.isNaN(lastTakenDate.getTime())) return base;

  return {
    ...base,
    lastTaken: lastTakenIso,
    nextDose: addHours(lastTakenDate, intervalHours).toISOString(),
  };
}

/* =====================================================
   CORE ACTIONS
   ===================================================== */
export function takeDose(med) {
  const nowIso = new Date().toISOString();
  const intervalHours = med?.intervalHours ?? null;

  return {
    ...med,
    lastTaken: nowIso,
    nextDose: intervalHours ? addHours(new Date(nowIso), intervalHours).toISOString() : null,
    history: [...(Array.isArray(med?.history) ? med.history : []), { type: "TAKEN", time: nowIso }],
    prn: !intervalHours,
  };
}

export function skipDose(med) {
  const nowIso = new Date().toISOString();
  return {
    ...med,
    history: [...(Array.isArray(med?.history) ? med.history : []), { type: "SKIPPED", time: nowIso }],
  };
}

export function snoozeDose(med, minutes) {
  const now = new Date();
  const snoozed = new Date(now.getTime() + minutes * 60000).toISOString();
  return {
    ...med,
    nextDose: snoozed,
    history: [
      ...(Array.isArray(med?.history) ? med.history : []),
      { type: "SNOOZED", time: now.toISOString(), minutes },
    ],
  };
}

/* =====================================================
   UNDO LAST ACTION
   ===================================================== */
export function undoLastAction(med) {
  const history = Array.isArray(med?.history) ? med.history : [];
  if (history.length === 0) return med;

  const nextHistory = history.slice(0, -1);

  // Recompute lastTaken from remaining history
  const lastTakenEntry = [...nextHistory].reverse().find((h) => h.type === "TAKEN");
  const lastTaken = lastTakenEntry?.time ? normalizeTimestampString(lastTakenEntry.time) : null;

  return normalizeMedication({
    ...med,
    history: nextHistory,
    lastTaken,
    nextDose: null, // will be restored by normalizeMedication if possible
  });
}

/* =====================================================
   SAFETY — ACETAMINOPHEN (more accurate)
   ===================================================== */
/**
 * Computes total acetaminophen consumed in last 24 hours from TAKEN history.
 * Backward compatible fallback: if no history, uses lastTaken as a single dose.
 */
export function acetaminophenTotal(meds) {
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;

  return (Array.isArray(meds) ? meds : []).reduce((sum, med) => {
    const mg = med?.acetaminophenMg ?? 0;
    if (!mg) return sum;

    const history = Array.isArray(med?.history) ? med.history : [];
    const takenEntries = history.filter((h) => h?.type === "TAKEN" && h?.time);

    // Prefer history-based counting
    if (takenEntries.length > 0) {
      const add = takenEntries.reduce((s, h) => {
        const t = new Date(normalizeTimestampString(h.time)).getTime();
        if (!Number.isFinite(t)) return s;
        return t >= cutoffMs ? s + mg : s;
      }, 0);
      return sum + add;
    }

    // Fallback: lastTaken counts as one dose
    if (!med?.lastTaken) return sum;
    const t = new Date(normalizeTimestampString(med.lastTaken)).getTime();
    if (!Number.isFinite(t)) return sum;
    return t >= cutoffMs ? sum + mg : sum;
  }, 0);
}

/* =====================================================
   UI HELPERS
   ===================================================== */

/**
 * Legacy: time-only status based on a nextDose timestamp.
 * Keep for internal use.
 */
export function doseStatus(nextDose) {
  if (!nextDose) return "PRN";

  const diffMs = new Date(nextDose) - new Date();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < -1) return "OVERDUE";
  if (diffHours <= 2) return "DUE_SOON";
  return "OK";
}

/**
 * New: deterministic status for a medication object.
 * - PRN iff intervalHours is absent
 * - NS (Not Started) iff scheduled but no nextDose yet
 * - Otherwise computed from nextDose
 */
export function doseStatusForMed(med) {
  const intervalHours = med?.intervalHours ?? null;
  if (!intervalHours) return "PRN";
  if (!med?.nextDose) return "NS";
  return doseStatus(med.nextDose);
}

/**
 * New: display label for timing.
 * - PRN => "As needed"
 * - NS => "NS"
 * - else => "in 2 hours" etc.
 */
export function timeLabelForMed(med) {
  const status = doseStatusForMed(med);
  if (status === "PRN") return "As needed";
  if (status === "NS") return "NS";
  return formatDistanceToNow(new Date(med.nextDose), { addSuffix: true });
}

// Keep existing export for any legacy call sites
export function timeUntil(nextDose) {
  if (!nextDose) return "As needed";
  return formatDistanceToNow(new Date(nextDose), { addSuffix: true });
}

// Add near UI helpers section

export function overdueLabel(nextDose) {
  if (!nextDose) return null;

  const diffMs = new Date() - new Date(nextDose);
  if (diffMs <= 0) return null;

  const minutes = Math.round(diffMs / 60000);
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs > 0) return `Overdue by ${hrs}h ${mins}m`;
  return `Overdue by ${mins}m`;
}

export function snoozedLabel(nextDose) {
  if (!nextDose) return null;
  return `Snoozed to ${new Date(nextDose).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}