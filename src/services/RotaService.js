// src/services/RotaService.js
// Thin layer between hooks/UI and the repository, matching the other services.
import { RotaRepository } from "../repositories/RotaRepository.js";

export const RotaService = {
  listMonth: (monthId, employeeId) => RotaRepository.listMonth(monthId, employeeId),
  setShift: (employeeId, onDate, value) => RotaRepository.setShift(employeeId, onDate, value),
  clearShift: (employeeId, onDate) => RotaRepository.clearShift(employeeId, onDate),
  getMonthStatus: (monthId) => RotaRepository.getMonthStatus(monthId),
  setMonthStatus: (monthId, status) => RotaRepository.setMonthStatus(monthId, status),
};

export default RotaService;
