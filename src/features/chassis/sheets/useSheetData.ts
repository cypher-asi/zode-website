import { useDesign } from "@/features/chassis/store";

export function useSheetData() {
  const data = useDesign((s) => s.data);
  const d = useDesign((s) => s.derived);
  return { data, d };
}
