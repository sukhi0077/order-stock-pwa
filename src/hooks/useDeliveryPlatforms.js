// src/hooks/useDeliveryPlatforms.js
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase.js";
import { FALLBACK_PLATFORMS } from "../models/DailyReportModel.js";

// The delivery portals (Uber, Bolt, Wolt, Glovo, Pyszne, RePOS) now live in
// public.delivery_platforms instead of a hardcoded array, so adding one is a
// row insert rather than a redeploy.
//
// FALLBACK_PLATFORMS is used only while the query is in flight (and if it
// fails), so the form always has something to render.
export function useDeliveryPlatforms() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["deliveryPlatforms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_platforms")
        .select("id, name")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((p) => p.name);
    },
    staleTime: 5 * 60_000,
  });

  return {
    platforms: data && data.length ? data : FALLBACK_PLATFORMS,
    isLoading,
    isError,
  };
}
