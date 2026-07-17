// src/services/ItemService.js
// Thin layer between hooks/UI and the ItemRepository.
import { ItemRepository } from "../repositories/ItemRepository.js";

export const ItemService = {
  getAll: () => ItemRepository.getAll(),
  seedIfEmpty: () => ItemRepository.seedIfEmpty(),
  resyncFromSeed: () => ItemRepository.resyncFromSeed(),
  add: (item) => ItemRepository.add(item),
  update: (id, patch) => ItemRepository.update(id, patch),
  setActive: (id, active) => ItemRepository.setActive(id, active),
};

export default ItemService;
