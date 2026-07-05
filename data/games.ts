export type GameStatus = "live" | "final" | "upcoming";

export type Game = {
  id: string;
  level: "JUCO" | "NAIA" | "NCAA DII" | "NCAA DIII" | "NCCAA" | "USCAA";
  status: GameStatus;
  period?: string;
  startTime?: string;
  away: {
    name: string;
    score?: number;
  };
  home: {
    name: string;
    score?: number;
  };
  venue: string;
  streamLabel: string;
  watchUrl?: string;
  statsUrl?: string;
  sourceLabel: string;
  streamStatus: "verified" | "missing";
};

export const featuredGames: Game[] = [
  {
    id: "juco-indian-hills-moberly",
    level: "JUCO",
    status: "live",
    period: "2nd 7:42",
    away: { name: "Indian Hills", score: 69 },
    home: { name: "Moberly Area", score: 73 },
    venue: "Moberly, MO",
    streamLabel: "Team stream",
    watchUrl: "https://www.njcaa.org/sports/mbkb/index",
    statsUrl: "https://www.njcaa.org/sports/mbkb/index",
    sourceLabel: "NJCAA",
    streamStatus: "verified",
  },
  {
    id: "naia-college-idaho-georgetown",
    level: "NAIA",
    status: "final",
    away: { name: "College of Idaho", score: 82 },
    home: { name: "Georgetown", score: 77 },
    venue: "Kansas City, MO",
    streamLabel: "NAIA Network",
    watchUrl: "https://naiastats.prestosports.com/sports/mbkb/scoreboard",
    statsUrl: "https://naiastats.prestosports.com/sports/mbkb/scoreboard",
    sourceLabel: "NAIA",
    streamStatus: "verified",
  },
  {
    id: "d2-northwest-missouri-minnesota-state",
    level: "NCAA DII",
    status: "upcoming",
    startTime: "8:00 PM",
    away: { name: "NW Missouri St." },
    home: { name: "Minnesota St." },
    venue: "Mankato, MN",
    streamLabel: "Stream needed",
    statsUrl: "https://www.ncaa.com/scoreboard/basketball-men/d2",
    sourceLabel: "NCAA",
    streamStatus: "missing",
  },
  {
    id: "d3-trine-nyu",
    level: "NCAA DIII",
    status: "final",
    away: { name: "Trine", score: 64 },
    home: { name: "NYU", score: 68 },
    venue: "New York, NY",
    streamLabel: "School broadcast",
    watchUrl: "https://www.ncaa.com/scoreboard/basketball-men/d3",
    statsUrl: "https://www.ncaa.com/scoreboard/basketball-men/d3",
    sourceLabel: "NCAA",
    streamStatus: "verified",
  },
  {
    id: "nccaa-grace-campbellsville-harrodsburg",
    level: "NCCAA",
    status: "upcoming",
    startTime: "9:00 PM",
    away: { name: "Grace" },
    home: { name: "CU Harrodsburg" },
    venue: "Harrodsburg, KY",
    streamLabel: "Stream needed",
    statsUrl: "https://thenccaa.org/sports/mbkb",
    sourceLabel: "NCCAA",
    streamStatus: "missing",
  },
  {
    id: "uscaa-villa-maria-berkeley",
    level: "USCAA",
    status: "live",
    period: "Halftime",
    away: { name: "Villa Maria", score: 41 },
    home: { name: "Berkeley", score: 39 },
    venue: "New York, NY",
    streamLabel: "Watch page",
    watchUrl: "https://www.theuscaa.com/sports/mbkb",
    statsUrl: "https://www.theuscaa.com/sports/mbkb",
    sourceLabel: "USCAA",
    streamStatus: "verified",
  },
];
