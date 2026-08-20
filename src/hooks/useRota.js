// src/hooks/useRota.js
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotaService } from "../services/RotaService.js";

// One month of shifts. `employeeId` null means everyone — the admin editor.
// The staff view passes its own id so a shared device never pulls the whole
// team's schedule down.
export function useRotaMonth(monthId, employeeId = null) {
  return useQuery({
    queryKey: ["rota", monthId, employeeId || "all"],
    queryFn: () => RotaService.listMonth(monthId, employeeId),
    enabled: Boolean(monthId),
  });
}

export function useRotaStatus(monthId) {
  return useQuery({
    queryKey: ["rota-status", monthId],
    queryFn: () => RotaService.getMonthStatus(monthId),
    enabled: Boolean(monthId),
  });
}

export function useSaveShift() {
  const qc = useQueryClient();
  return useMutation({
    // value === null clears the shift; anything else sets/updates it.
    mutationFn: ({ employeeId, onDate, value }) =>
      value === null
        ? RotaService.clearShift(employeeId, onDate)
        : RotaService.setShift(employeeId, onDate, value),
    // A saved shift belongs to one employee's month AND the admin's
    // all-employees view of the same month, so invalidate the whole family.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rota"] }),
  });
}

export function useSetRotaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ monthId, status }) => RotaService.setMonthStatus(monthId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rota-status"] }),
  });
}
