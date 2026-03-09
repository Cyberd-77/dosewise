export default function AcetaminophenBar({ total }) {
  const percent = Math.min((total / 4000) * 100, 100);

  const fillColor =
    percent >= 100 ? "var(--danger)" : percent >= 75 ? "var(--warning)" : "var(--success)";

  return (
    <div className="apap-bar">
      <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>
        {total} mg / 4000 mg acetaminophen (24 hrs)
      </div>

      <div className="apap-meter" aria-hidden="true">
        <div className="apap-fill" style={{ width: `${percent}%`, background: fillColor }} />
      </div>

      {total >= 4000 && <div className="warning">⚠ You are at or above the daily maximum.</div>}
    </div>
  );
}