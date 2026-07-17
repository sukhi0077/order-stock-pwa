// src/services/OrderService.js
import { OrderRepository } from "../repositories/OrderRepository.js";

export const OrderService = {
  getDraft: () => OrderRepository.getDraft(),
  getById: (id) => OrderRepository.getById(id),
  saveDraft: (args) => OrderRepository.saveDraft(args),
  update: (id, args) => OrderRepository.update(id, args),
  list: (n) => OrderRepository.list(n),
};

export default OrderService;
