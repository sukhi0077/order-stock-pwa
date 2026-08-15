// src/hooks/useTimesheet.js
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TimesheetService } from "../services/TimesheetService.js";

// One month of entries. `employeeId` null means everyone — the admin view.
export function useTimesheetMonth(monthId, employeeId = null) {
  return useQuery({
    queryKey: ["timesheet", monthId, employeeId || "all"],
    queryFn: () => TimesheetService.listMonth(monthId, employeeId),
    enabled: Boolean(monthId),
  });
}

export function useSaveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry) => TimesheetService.save(entry),
    // Invalidate the whole family: a saved entry belongs to one employee's
    // month AND to the admin's all-employees view of the same month.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet"] }),
  });
}

export function useRemoveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => TimesheetService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet"] }),
  });
}

export function useAvailability(employeeId, fromDate) {
  return useQuery({
    queryKey: ["availability", employeeId, fromDate],
    queryFn: () => TimesheetService.getAvailability(employeeId, fromDate),
    enabled: Boolean(employeeId),
  });
}

// Everyone's availability over a range, for the admin's consolidated view.
export function useAvailabilityRange(fromDate, toDate) {
  return useQuery({
    queryKey: ["availability", "range", fromDate, toDate],
    queryFn: () => TimesheetService.getAvailabilityRange(fromDate, toDate),
    enabled: Boolean(fromDate && toDate),
  });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, employeeId, key, value }) =>
      kind === "weekly"
        ? TimesheetService.setWeekly(employeeId, key, value)
        : // `key` is an array for the bulk cases — ticking or un-ticking a
          // usual weekday, which answers or clears every matching day at once.
          kind === "dates"
          ? value === null
            ? TimesheetService.clearDates(employeeId, key)
            : TimesheetService.setDates(employeeId, key, value)
          : value === null
            ? TimesheetService.clearDate(employeeId, key)
            : TimesheetService.setDate(employeeId, key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability"] }),
  });
}
