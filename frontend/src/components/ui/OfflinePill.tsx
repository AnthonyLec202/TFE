// Header status pill shown when the backend is unreachable. Identical visual treatment to the
// "Mes patients" header badge (terracotta/red state colours), so the offline cue is consistent
// across the app. Pure presentational — render it conditionally on the offline state.
export function OfflinePill() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#E7CEC8] bg-[#F6E9E6] px-3 py-1.5 text-[12.5px] text-[#B5453C]">
      <span className="h-[7px] w-[7px] rounded-full bg-[#B5453C]" />
      Hors ligne
    </span>
  );
}
