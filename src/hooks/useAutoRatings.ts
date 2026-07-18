import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AutoRating = {
  slug: string;
  units_sold: number;
  order_count: number;
  avg_related_rating: number | null;
  related_review_count: number;
  auto_rating: number;
  auto_confidence: number;
};

export type AutoRatingMap = Record<string, AutoRating>;

async function fetchAutoRatings(): Promise<AutoRatingMap> {
  const { data, error } = await supabase.rpc("get_product_auto_ratings");
  if (error) throw error;
  const map: AutoRatingMap = {};
  for (const row of (data ?? []) as AutoRating[]) map[row.slug] = row;
  return map;
}

export function useAutoRatings() {
  return useQuery({
    queryKey: ["product-auto-ratings"],
    queryFn: fetchAutoRatings,
    staleTime: 5 * 60_000,
  });
}
