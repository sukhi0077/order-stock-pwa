// src/services/TimesheetService.js
// Thin layer between hooks/UI and the repository, matching the other services.
import { TimesheetRepository } from "../repositories/TimesheetRepository.js";
import { buildEntryPayload, validateEntry } from "../models/TimesheetModel.js";

export const TimesheetService = {
  listMonth: (monthId, employeeId) => TimesheetRepository.listMonth(monthId, employeeId),

  // Validation lives here rather than in the component so every caller — the
  // staff screen, an admin correction — gets the same rules.
  async save(entry) {
    const { ok, errors } = validateEntry(entry);
    if (!ok) throw new Error(errors[0]);
    const payload = buildEntryPayload(entry);
    return entry.id
      ? TimesheetRepository.update(entry.id, payload)
      : TimesheetRepository.add(payload);
  },

  remove: (id) => TimesheetRepository.remove(id),
  getAvailability: (employeeId, fromDate) =>
    TimesheetRepository.getAvailability(employeeId, fromDate),
  setWeekly: (employeeId, weekday, value) =>
    TimesheetRepository.setWeekly(employeeId, weekday, value),
  setDate: (employeeId, onDate, value) => TimesheetRepository.setDate(employeeId, onDate, value),
  clearDate: (employeeId, onDate) => TimesheetRepository.clearDate(employeeId, onDate),
  verifyPin: (employeeId, pin) => TimesheetRepository.verifyPin(employeeId, pin),
  setPin: (employeeId, pin) => TimesheetRepository.setPin(employeeId, pin),
};

export default TimesheetService;
