// src/hooks/useItems.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ItemService } from "../services/ItemService.js";

// The master item list. Active + inactive both returned; the UI filters.
export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => ItemService.getAll(),
    staleTime: 5 * 60 * 1000, // items rarely change
  });
}

// One-time seed (admin). Safe to call repeatedly — it no-ops once seeded.
export function useSeedItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ItemService.seedIfEmpty(),
    onSuccess: (didSeed) => {
      if (didSeed) qc.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

// Re-sync the live list with the bundled master list (admin).
export function useResyncItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ItemService.resyncFromSeed(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item) => ItemService.add(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => ItemService.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useSetItemActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }) => ItemService.setActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
}
