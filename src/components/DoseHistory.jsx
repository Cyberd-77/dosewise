export default function DoseHistory({ meds }) {
  function formatDateTime(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";

    const datePart = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `${datePart} • ${timePart}`;
  }

  const entries = (Array.isArray(meds) ? meds : [])
    .flatMap((m) => (Array.isArray(m.history) ? m.history : []).map((h) => ({ ...h, med: m.name })))
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  if (entries.length === 0) return null;

  return (
    <div style={{ textAlign: "left" }}>
      <h3>📜 Dose History</h3>
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {entries.slice(0, 20).map((e, i) => (
          <li key={`${e.med}-${e.type}-${e.time}-${i}`}>
            <strong>{e.med}</strong> —{" "}
            {e.type === "TAKEN" && "✅ Taken"}
            {e.type === "SKIPPED" && "⏭ Skipped"}
            {e.type === "SNOOZED" && `⏰ Snoozed (${e.minutes}m)`}{" "}
            at {formatDateTime(e.time)}
          </li>
        ))}
      </ul>
    </div>
  );
}
``