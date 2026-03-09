import { startOfDay, subDays, format } from "date-fns";

function buildDayMap(meds, days = 14) {
  const map = {};

  for (let i = 0; i < days; i++) {
    const day = startOfDay(subDays(new Date(), i));
    map[format(day, "yyyy-MM-dd")] = {
      taken: 0,
      skipped: 0,
      snoozed: 0
    };
  }

  meds.forEach((med) => {
    (med.history || []).forEach((entry) => {
      const key = format(startOfDay(new Date(entry.time)), "yyyy-MM-dd");
      if (!map[key]) return;

      if (entry.type === "TAKEN") map[key].taken++;
      if (entry.type === "SKIPPED") map[key].skipped++;
      if (entry.type === "SNOOZED") map[key].snoozed++;
    });
  });

  return Object.entries(map).reverse();
}

function colorForDay(day) {
  if (day.taken === 0 && day.skipped === 0 && day.snoozed === 0)
    return "heat-none";
  if (day.skipped > day.taken) return "heat-bad";
  if (day.snoozed > 0 || day.skipped > 0) return "heat-mixed";
  return "heat-good";
}

export default function AdherenceHeatmap({ meds }) {
  const days = buildDayMap(meds);

  return (
    <div className="card">
      <h3>📅 Adherence (Last 14 Days)</h3>

      <div className="heatmap">
        {days.map(([date, day]) => (
          <div
            key={date}
            className={`heat-cell ${colorForDay(day)}`}
            title={`${date}
Taken: ${day.taken}
Skipped: ${day.skipped}
Snoozed: ${day.snoozed}`}
          />
        ))}
      </div>

      <small style={{ display: "block", marginTop: "0.5rem" }}>
        🟢 Taken • 🟡 Mixed • 🔴 Missed • ⚪ No data
      </small>
    </div>
  );
}