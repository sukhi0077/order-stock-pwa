// src/hooks/useFrontdesk.js
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FrontdeskService } from "../services/FrontdeskService.js";

export const FRONTDESK_QUERY_KEY = ["frontdesk"];

// The front desk roster as a Set of employee ids, for O(1) membership checks.
// Returns an empty Set (never undefined) so callers can use it before it loads
// without guarding — an empty front desk simply flags nothing.
export function useFrontdesk() {
  const query = useQuery({
    queryKey: FRONTDESK_QUERY_KEY,
    queryFn: () => FrontdeskService.list(),
    staleTime: 60_000,
  });
  const ids = useMemo(() => new Set(query.data || []), [query.data]);
  return { ids, isLoading: query.isLoading };
}

export function useSetFrontdesk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, member }) => FrontdeskService.set(employeeId, member),
    onSuccess: () => qc.invalidateQueries({ queryKey: FRONTDESK_QUERY_KEY }),
  });
}
