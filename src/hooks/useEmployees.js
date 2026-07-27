// src/hooks/useEmployees.js
import { useQuery } from "@tanstack/react-query";
import { EmployeeService } from "../services/EmployeeService.js";

// Shared cache key so the report form and the admin manager read the same data
// and a save can invalidate it everywhere.
export const EMPLOYEES_QUERY_KEY = ["employees"];

// The employee roster. Used by the report form (reporter dropdown + the
// Google-review coupon steppers) and by the admin "Manage employees" panel.
//
// activeOnly: the form shows only active employees; the admin panel shows all
// so inactive people can be reactivated.
export function useEmployees({ activeOnly = false } = {}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...EMPLOYEES_QUERY_KEY, activeOnly],
    queryFn: () => EmployeeService.list({ activeOnly }),
    staleTime: 60_000,
  });

  return {
    employees: data || [],
    isLoading,
    isError,
    refetch,
  };
}
