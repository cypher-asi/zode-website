/**
 * One colour per GPU rail, after the OD3N planner's rail scheme, darkened so
 * the cable ribbons hold up on the light page. Indexed by rail.
 */
export const RAIL_COLORS = [
  "#c99700",
  "#1f7fcf",
  "#cf3f7a",
  "#6b7480",
  "#22915a",
  "#d9692a",
  "#7c4ddb",
  "#13918a",
] as const;

export const RAIL_NAMES = ["Yellow", "Blue", "Pink", "Grey", "Green", "Orange", "Violet", "Teal"] as const;
