import { doseStatusForMed } from "./doseEngine";

export function groupMedications(meds) {
  const groups = {
    NEXT: [],
    DUE_SOON: [],
    NOT_STARTED: [],
    LATER: [],
    PRN: [],
  };

  (Array.isArray(meds) ? meds : []).forEach((med) => {
    const status = doseStatusForMed(med);

    if (status === "OVERDUE") {
      groups.NEXT.push(med);
    } else if (status === "DUE_SOON") {
      groups.DUE_SOON.push(med);
    } else if (status === "NS") {
      groups.NOT_STARTED.push(med);
    } else if (status === "OK") {
      groups.LATER.push(med);
    } else {
      // status === "PRN" (strictly intervalHours absent)
      groups.PRN.push(med);
    }
  });

  return groups;
}