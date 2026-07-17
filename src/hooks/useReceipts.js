// src/hooks/useReceipts.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReceiptService } from "../services/ReceiptService.js";

export function useReceipts() {
  return useQuery({
    queryKey: ["receipts"],
    queryFn: () => ReceiptService.list(1000),
    staleTime: 30 * 1000,
  });
}

export function useAddReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args) => ReceiptService.add(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });
}

export function useDeleteReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => ReceiptService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });
}
