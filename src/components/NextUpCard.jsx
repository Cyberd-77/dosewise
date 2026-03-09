import { takeDose, timeLabelForMed } from "../utils/doseEngine";

export default function NextUpCard({ med, meds, setMeds, showUndoToast }) {
  if (!med) return null;

  function replaceMed(nextMed) {
    setMeds(meds.map((m) => (m.id === med.id ? nextMed : m)));
  }

  function handleTake() {
    const prev = med;
    const next = takeDose(med);
    replaceMed(next);

    // Provide onUndo callback (snapshot restore) — App.jsx supports this too.
    if (showUndoToast) {
      showUndoToast({
        message: `${med.name}: Dose logged`,
        onUndo: () => replaceMed(prev),
      });
    }
  }

  return (
    <div className="card OK">
      <h3>⏭ Next Up</h3>
      <div style={{ fontWeight: 700, marginTop: "0.25rem" }}>💊 {med.name}</div>
      <div className="next-dose">⏱ {timeLabelForMed(med)}</div>

      <button onClick={handleTake}>Take Dose</button>

      <small style={{ display: "block", marginTop: "0.5rem", color: "var(--muted)" }}>
        {med.instructions}
      </small>
    </div>
  );
}