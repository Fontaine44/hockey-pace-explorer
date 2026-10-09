export const PACE_TYPES = [
  { value: "speed_total_ft_s", label: "Total" },
  { value: "speed_ew_ft_s", label: "East-west" },
  { value: "speed_ns_ft_s", label: "North-south" },
  { value: "speed_n_ft_s", label: "North-only" },
] as const;
export type PaceType = (typeof PACE_TYPES)[number]["value"];
