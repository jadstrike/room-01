export const LOCATIONS = [
  { id: "room01", label: "Room 01", href: "?" },
  { id: "kitchen", label: "House / Kitchen", href: "?section=kitchen" },
  { id: "living-room", label: "House / Living room", href: "?section=living-room" },
  { id: "bedroom", label: "House / Bedroom", href: "?section=bedroom" },
  { id: "basement", label: "House / Basement", href: "?section=basement" },
  { id: "utility-room", label: "House / Utility room", href: "?section=utility-room" },
  { id: "study", label: "House / Study", href: "?section=study" },
] as const;

export type LocationId = typeof LOCATIONS[number]["id"];

export function locationFromSearch(search: string): LocationId {
  const requested = new URLSearchParams(search).get("section");
  return LOCATIONS.find(location => location.id === requested)?.id ?? "room01";
}

export function locationLabel(id: LocationId): string {
  return LOCATIONS.find(location => location.id === id)!.label;
}
