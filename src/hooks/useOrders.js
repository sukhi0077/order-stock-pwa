// src/hooks/useOrders.js
import { useQuery } from "@tanstack/react-query";
import { OrderService } from "../services/OrderService.js";

// All orders, newest first (admin list).
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => OrderService.list(100),
  });
}
