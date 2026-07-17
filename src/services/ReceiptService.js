// src/services/ReceiptService.js
import { ReceiptRepository } from "../repositories/ReceiptRepository.js";

export const ReceiptService = {
  add: (args) => ReceiptRepository.add(args),
  list: (n) => ReceiptRepository.list(n),
  remove: (id) => ReceiptRepository.remove(id),
};

export default ReceiptService;
