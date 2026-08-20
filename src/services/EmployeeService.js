// src/services/EmployeeService.js
import { EmployeeRepository } from "../repositories/EmployeeRepository.js";

// Normalize a raw name: trim and collapse inner whitespace. (The old Firestore
// version also had to strip commas and dashes, because names were packed into
// a single "Anna - 4, Marek - 5" string. That format is gone — names are rows
// now — so those characters are safe to keep.)
export function sanitizeEmployeeName(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

export class EmployeeService {
  static async list({ activeOnly = false } = {}) {
    return await EmployeeRepository.list({ activeOnly });
  }

  static async add(rawName, sortOrder = 0) {
    const name = sanitizeEmployeeName(rawName);
    if (!name) throw new Error("Please enter a name.");
    if (name.length > 80) throw new Error("That name is too long.");

    const existing = await EmployeeRepository.list();
    if (existing.length >= 100) {
      throw new Error("You can have at most 100 employees.");
    }
    // Case-insensitive duplicate check up front, so the user gets a friendly
    // message instead of a raw unique-index violation from Postgres.
    const clash = existing.find(
      (e) => e.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) {
      if (!clash.active) {
        // Reactivate rather than fail — the name is taken by a past employee.
        return await EmployeeRepository.setActive(clash.id, true);
      }
      throw new Error(`"${name}" is already on the list.`);
    }

    return await EmployeeRepository.create(name, sortOrder);
  }

  static async rename(id, rawName) {
    const name = sanitizeEmployeeName(rawName);
    if (!name) throw new Error("Please enter a name.");
    return await EmployeeRepository.update(id, { name });
  }

  // Employees are deactivated, never deleted: reporter_id is ON DELETE
  // RESTRICT, so anyone who has filed a report is permanently referenced.
  static async setActive(id, active) {
    return await EmployeeRepository.setActive(id, active);
  }

  // Front desk membership is a flag on the employee — see frontdesk_column.sql.
  static async setFrontdesk(id, isFrontdesk) {
    return await EmployeeRepository.setFrontdesk(id, Boolean(isFrontdesk));
  }
}
