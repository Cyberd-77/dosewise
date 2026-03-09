import { useState } from "react";
import {
  takeDose,
  skipDose,
  snoozeDose,
  undoLastAction,
  doseStatusForMed,
  timeLabelForMed,
} from "../utils/doseEngine";

/**
 * Quietly Premium display helpers (UI-only, deterministic)
 * These do NOT affect dose timing/safety logic—only what the user sees.
 */
function formatClockTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";

  // Example: "Mar 8, 2026 • 9:14 PM"
  const datePart = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${datePart} • ${timePart}`;
}

function overdueByLabel(nextDose) {
  if (!nextDose) return null;
  const due = new Date(nextDose);
  if (Number.isNaN(due.getTime())) return null;

  const diffMs = Date.now() - due.getTime();
  if (diffMs <= 0) return null;

  const totalMinutes = Math.round(diffMs / 60000);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hrs > 0) return `Overdue by ${hrs}h ${mins}m`;
  return `Overdue by ${mins}m`;
}

function snoozedToLabel(med) {
  const history = Array.isArray(med?.history) ? med.history : [];
  if (history.length === 0) return null;

  const last = history[history.length - 1];
  if (!last || last.type !== "SNOOZED") return null;

  const t = formatClockTime(med?.nextDose);
  if (!t) return null;

  return `Snoozed to ${t}`;
}

export default function MedicationCard({ med, meds, setMeds, apapTotal, showUndoToast }) {
  const [expanded, setExpanded] = useState(false);

  const status = doseStatusForMed(med);
  const isOverdue = status === "OVERDUE";

  const acetaminophenMg = med?.acetaminophenMg ?? 0;
  const wouldExceed = acetaminophenMg > 0 && apapTotal + acetaminophenMg > 4000;

  const history = Array.isArray(med?.history) ? med.history : [];
  const recentHistory = history.slice(-5).reverse();

  // Quietly Premium time label precedence:
  // 1) Overdue by X
  // 2) Snoozed to HH:MM (only if last action was SNOOZED)
  // 3) Default label (NS / As needed / in X)
  const overdueText = overdueByLabel(med?.nextDose);
  const snoozeText = snoozedToLabel(med);
  const timeText = overdueText || snoozeText || timeLabelForMed(med);

  function applyUpdate(updateFn) {
    setMeds(meds.map((m) => (m.id === med.id ? updateFn(m) : m)));
  }

  function runAction(label, fn) {
    applyUpdate(fn);

    // IMPORTANT: Toast Undo is handled globally by App.jsx using medId + undoLastAction.
    if (showUndoToast) {
      showUndoToast({ message: `${med.name}: ${label}`, medId: med.id });
    }
  }

  return (
    <div className={`card ${status}`}>
      <h3>💊 {med.name}</h3>
      <small>{med.dosage}</small>

      <div className="next-dose">⏱ {timeText}</div>

      {expanded && (
        <>
          <div style={{ marginTop: "0.5rem" }}>{med.instructions}</div>

          {acetaminophenMg > 0 && (
            <div style={{ marginTop: "0.25rem" }}>
              <small>Acetaminophen per dose: {acetaminophenMg} mg</small>
            </div>
          )}
        </>
      )}

      {/* TAKE DOSE */}
      <button onClick={() => runAction("Dose recorded", takeDose)} disabled={wouldExceed}>
        Take Dose
      </button>

      {wouldExceed && (
        <div className="warning">
          ⚠ Taking this would exceed 4000 mg acetaminophen in the last 24 hours
        </div>
      )}

      {/* EXPANDED ACTIONS */}
      {expanded && (
        <>
          {/* SKIP DOSE */}
          <button
            onClick={() => runAction("Dose skipped", skipDose)}
            style={{ background: "var(--border)", color: "var(--text)" }}
          >
            Skip Dose
          </button>

          {/* SNOOZE BUTTONS (expanded + overdue only) */}
          {isOverdue && (
            <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
              {[15, 30, 60].map((min) => (
                <button
                  key={min}
                  onClick={() => runAction(`Snoozed ${min}m`, (m) => snoozeDose(m, min))}
                  style={{ background: "var(--border)", color: "var(--text)" }}
                >
                  Snooze {min}m
                </button>
              ))}
            </div>
          )}

          {/* UNDO LAST ACTION */}
          {history.length > 0 && (
            <button
              onClick={() => runAction("Undid last action", undoLastAction)}
              style={{ background: "#ffe4e6", color: "#7f1d1d" }}
            >
              Undo
            </button>
          )}

          {/* HISTORY LIST */}
          {recentHistory.length > 0 && (
            <>
              <h4 style={{ marginTop: "0.75rem", marginBottom: "0.25rem" }}>History</h4>
              <ul style={{ textAlign: "left", margin: 0, paddingLeft: "1.25rem" }}>
                {recentHistory.map((entry, i) => (
                  <li key={`${entry.type}-${entry.time}-${i}`}>
                    {entry.type === "TAKEN" && "✅ Taken"}
                    {entry.type === "SKIPPED" && "⏭ Skipped"}
                    {entry.type === "SNOOZED" && `⏰ Snoozed (${entry.minutes}m)`} —{" "}
                    {formatDateTime(entry.time)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <button className="expand" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide details ▲" : "Show details ▼"}
      </button>
    </div>
  );
}