// src/services/FrontdeskService.js
import { FrontdeskRepository } from "../repositories/FrontdeskRepository.js";

export const FrontdeskService = {
  list: () => FrontdeskRepository.list(),
  set: (employeeId, member) =>
    member ? FrontdeskRepository.add(employeeId) : FrontdeskRepository.remove(employeeId),
};

export default FrontdeskService;
