/** Canonical regions used only by the internal Hoop Frens Knowledge Graph. */
export enum KnowledgeRegion {
  Northeast = "northeast",
  MidAtlantic = "mid_atlantic",
  Southeast = "southeast",
  GulfStates = "gulf_states",
  GreaterLakes = "greater_lakes",
  Midwest = "midwest",
  Texas = "texas",
  Southwest = "southwest",
  Northwest = "northwest",
}

export const hoopFrensRegionLabels: Record<KnowledgeRegion, string> = {
  [KnowledgeRegion.Northeast]: "Northeast",
  [KnowledgeRegion.MidAtlantic]: "Mid-Atlantic",
  [KnowledgeRegion.Southeast]: "Southeast",
  [KnowledgeRegion.GulfStates]: "Gulf States",
  [KnowledgeRegion.GreaterLakes]: "Greater Lakes",
  [KnowledgeRegion.Midwest]: "Midwest",
  [KnowledgeRegion.Texas]: "Texas",
  [KnowledgeRegion.Southwest]: "Southwest",
  [KnowledgeRegion.Northwest]: "Northwest",
};

export const hoopFrensStateCodesByRegion: Record<KnowledgeRegion, readonly string[]> = {
  [KnowledgeRegion.Northeast]: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ"],
  [KnowledgeRegion.MidAtlantic]: ["DE", "PA", "DC", "WV", "VA"],
  [KnowledgeRegion.Southeast]: ["NC", "SC", "GA", "TN", "KY"],
  [KnowledgeRegion.GulfStates]: ["AL", "FL", "MS", "LA"],
  [KnowledgeRegion.GreaterLakes]: ["OH", "MI", "IL", "IN", "WI"],
  [KnowledgeRegion.Midwest]: ["AR", "MO", "IA", "MN", "OK", "KS", "NE", "ND", "SD"],
  [KnowledgeRegion.Texas]: ["TX", "CO", "NM"],
  [KnowledgeRegion.Southwest]: ["AZ", "UT", "NV", "CA"],
  [KnowledgeRegion.Northwest]: ["WA", "OR", "ID", "MT", "WY", "AK", "HI"],
};

const stateNameByCode: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const stateCodeByNormalizedName = new Map(
  Object.entries(stateNameByCode).map(([code, name]) => [name.toLowerCase(), code]),
);

const regionByStateCode = new Map<string, KnowledgeRegion>(
  Object.entries(hoopFrensStateCodesByRegion).flatMap(([region, stateCodes]) => (
    stateCodes.map((stateCode) => [stateCode, region as KnowledgeRegion] as const)
  )),
);

function normalizeRegionValue(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_");
}

export function normalizeUSStateCode(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  if (stateNameByCode[upper]) return upper;
  return stateCodeByNormalizedName.get(normalized.toLowerCase()) || null;
}

export function hoopFrensRegionForState(value: string): KnowledgeRegion | null {
  const stateCode = normalizeUSStateCode(value);
  return stateCode ? regionByStateCode.get(stateCode) || null : null;
}

export function hoopFrensRegionFromName(value: string): KnowledgeRegion | null {
  const normalized = normalizeRegionValue(value);
  return (Object.values(KnowledgeRegion) as string[]).includes(normalized)
    ? normalized as KnowledgeRegion
    : null;
}

export function formatHoopFrensRegion(region: KnowledgeRegion) {
  return hoopFrensRegionLabels[region];
}
