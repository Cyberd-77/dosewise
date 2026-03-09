import { useEffect, useMemo, useState } from "react";

import { initialMedications } from "./data/medications";
import {
  acetaminophenTotal,
  normalizeMedication,
  normalizeTimestampString,
  undoLastAction,
} from "./utils/doseEngine";
import { groupMedications } from "./utils/dashboard";

import MedicationCard from "./components/MedicationCard";
import AcetaminophenBar from "./components/AcetaminophenBar";
import NextUpCard from "./components/NextUpCard";
import DoseHistory from "./components/DoseHistory";
import LiveClock from "./components/LiveClock";
import AdherenceHeatmap from "./components/AdherenceHeatmap";
import UndoToast from "./components/UndoToast";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Migration / sanitation: make persisted meds safe and deterministic.
 * - Ensure history is an array
 * - Normalize timestamps (naive -> ISO)
 * - Force prn to match rule (prn := !intervalHours)
 */
function migrateMeds(raw) {
  const meds = Array.isArray(raw) ? raw : [];

  return meds.map((med) => {
    const intervalHours = med?.intervalHours ?? null;

    const history = Array.isArray(med?.history) ? med.history : [];
    const migratedHistory = history.map((h) => ({
      ...h,
      time: normalizeTimestampString(h?.time),
    }));

    return {
      ...med,
      intervalHours,
      history: migratedHistory,
      lastTaken: normalizeTimestampString(med?.lastTaken ?? null),
      nextDose: normalizeTimestampString(med?.nextDose ?? null),
      prn: !intervalHours,
    };
  });
}

export default function App() {
  /* =========================
     STATE
     ========================= */
  const [meds, setMeds] = useState(() => {
    const saved = localStorage.getItem("meds");
    if (!saved) return initialMedications;

    const parsed = safeParse(saved);
    if (!parsed) return initialMedications;

    return migrateMeds(parsed);
  });

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  // Undo toast state supports BOTH:
  // - callback-based undo (NextUpCard)
  // - medId-based undo (MedicationCard)
  const [toast, setToast] = useState({
    open: false,
    message: "",
    onUndo: null,
    medId: null,
  });

  /* =========================
     EFFECTS
     ========================= */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("meds", JSON.stringify(meds));
  }, [meds]);

  /* =========================
     DERIVED STATE (CRITICAL)
     ========================= */
  const normalizedMeds = useMemo(() => meds.map(normalizeMedication), [meds]);
  const apapTotal = useMemo(() => acetaminophenTotal(normalizedMeds), [normalizedMeds]);
  const groups = useMemo(() => groupMedications(normalizedMeds), [normalizedMeds]);

  const nextUp = groups.NEXT[0] || groups.DUE_SOON[0] || null;

  /* =========================
     UNDO TOAST HELPERS
     ========================= */
  function showUndoToast(payload) {
    setToast({
      open: true,
      message: payload?.message || "",
      onUndo: typeof payload?.onUndo === "function" ? payload.onUndo : null,
      medId: payload?.medId || null,
    });
  }

  function closeToast() {
    setToast({ open: false, message: "", onUndo: null, medId: null });
  }

  function handleToastUndo() {
    // Preferred: explicit callback (snapshot restore)
    if (typeof toast.onUndo === "function") {
      toast.onUndo();
      closeToast();
      return;
    }

    // Fallback: medId-based undo (engine undo from history)
    if (toast.medId) {
      setMeds((prev) => prev.map((m) => (m.id === toast.medId ? undoLastAction(m) : m)));
      closeToast();
      return;
    }

    // Nothing to undo
    closeToast();
  }

  /* =========================
     RENDER
     ========================= */
  return (
    <div className="container">
      <header>
  <div>
    <h1 className="app-title">Dosewise</h1>
    <div className="app-tagline">your medication, handled thoughtfully</div>
    <LiveClock />
  </div>

  <button
    className="toggle"
    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    aria-label="Toggle night mode"
    title="Toggle theme"
  >
    {theme === "light" ? "🌙" : "☀️"}
  </button>
</header>

      <AcetaminophenBar total={apapTotal} />

      <NextUpCard med={nextUp} meds={normalizedMeds} setMeds={setMeds} showUndoToast={showUndoToast} />

      {groups.NEXT.length > 0 && (
        <>
          <h3 style={{ textAlign: "left" }}>🚨 Next</h3>
          {groups.NEXT.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              meds={normalizedMeds}
              setMeds={setMeds}
              apapTotal={apapTotal}
              showUndoToast={showUndoToast}
            />
          ))}
        </>
      )}

      {groups.DUE_SOON.length > 0 && (
        <>
          <h3 style={{ textAlign: "left" }}>⏳ Due Soon</h3>
          {groups.DUE_SOON.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              meds={normalizedMeds}
              setMeds={setMeds}
              apapTotal={apapTotal}
              showUndoToast={showUndoToast}
            />
          ))}
        </>
      )}

      {groups.NOT_STARTED.length > 0 && (
        <>
          <h3 style={{ textAlign: "left" }}>🆕 Not Started</h3>
          {groups.NOT_STARTED.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              meds={normalizedMeds}
              setMeds={setMeds}
              apapTotal={apapTotal}
              showUndoToast={showUndoToast}
            />
          ))}
        </>
      )}

      {groups.LATER.length > 0 && (
        <>
          <h3 style={{ textAlign: "left" }}>🕒 Later</h3>
          {groups.LATER.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              meds={normalizedMeds}
              setMeds={setMeds}
              apapTotal={apapTotal}
              showUndoToast={showUndoToast}
            />
          ))}
        </>
      )}

      {groups.PRN.length > 0 && (
        <>
          <h3 style={{ textAlign: "left" }}>ℹ As Needed</h3>
          {groups.PRN.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              meds={normalizedMeds}
              setMeds={setMeds}
              apapTotal={apapTotal}
              showUndoToast={showUndoToast}
            />
          ))}
        </>
      )}

      <AdherenceHeatmap meds={normalizedMeds} />
      <DoseHistory meds={normalizedMeds} />

      <UndoToast
        open={toast.open}
        message={toast.message}
        onUndo={handleToastUndo}
        onClose={closeToast}
      />
    </div>
  );
}