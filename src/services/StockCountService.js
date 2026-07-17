// src/services/StockCountService.js
// Thin layer between hooks/UI and the StockCountRepository.
import { StockCountRepository } from "../repositories/StockCountRepository.js";

export const StockCountService = {
  getMonth: (monthId) => StockCountRepository.getMonth(monthId),
  getPrevClosing: (monthId) => StockCountRepository.getPrevClosing(monthId),
  saveMonth: (args) => StockCountRepository.saveMonth(args),
  setStatus: (monthId, status) => StockCountRepository.setStatus(monthId, status),
  listMonths: (n) => StockCountRepository.listMonths(n),
  getMonthsInRange: (a, b) => StockCountRepository.getMonthsInRange(a, b),
};

export default StockCountService;
