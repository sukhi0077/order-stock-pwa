// src/hooks/useFrontdesk.js
//
// Front desk membership, derived from the is_frontdesk flag on employees — no
// separate query, so it stays in step with the roster and a toggle invalidates
// one cache. Callers get a Set of ids for O(1) membership checks.
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmployees, EMPLOYEES_QUERY_KEY } from "./useEmployees.js";
import { EmployeeService } from "../services/EmployeeService.js";

export function useFrontdesk() {
  // activeOnly:false — the flag lives on every employee, and the same query is
  // already warmed by the admin screens.
  const { employees, isLoading } = useEmployees({ activeOnly: false });
  const ids = useMemo(
    () => new Set(employees.filter((e) => e.is_frontdesk).map((e) => e.id)),
    [employees],
  );
  return { ids, isLoading };
}

export function useSetFrontdesk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, member }) => EmployeeService.setFrontdesk(employeeId, member),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY }),
  });
}
