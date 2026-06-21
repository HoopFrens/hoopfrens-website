"use client";

import type { Game } from "@/data/games";
import { Bell, ExternalLink, Play, Radio, X } from "lucide-react";
import { useState } from "react";

type LevelFilter = "All" | Game["level"];

const levelFilters: LevelFilter[] = ["All", "JUCO", "NAIA", "NCAA DII", "NCAA DIII", "NCCAA", "USCAA"];

const statusStyles = {
  live: "bg-red-600 text-white",
  final: "bg-zinc-950 text-white",
  upcoming: "bg-zinc-200 text-zinc-700",
};

function statusLabel(game: Game) {
  if (game.status === "live") return game.period ?? "Live";
  if (game.status === "upcoming") return game.startTime ?? "Upcoming";
  return "Final";
}

function ScoreLine({ game, side }: { game: Game; side: "away" | "home" }) {
  const team = game[side];
  const isWinner = game.status === "final" && typeof game.away.score === "number" && typeof game.home.score === "number" && team.score === Math.max(game.away.score, game.home.score);

  return (
    <>
      <span className={`truncate ${isWinner || game.status === "live" ? "text-zinc-950" : "text-zinc-500"}`}>{team.name}</span>
      <span className={isWinner || game.status === "live" ? "text-zinc-950" : "text-zinc-400"}>{typeof team.score === "number" ? team.score : "-"}</span>
    </>
  );
}

export function GameTicker({ games }: { games: Game[] }) {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("All");
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(["Indian Hills", "Trine"]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const filteredGames = levelFilter === "All" ? games : games.filter((game) => game.level === levelFilter);
  const selectedTeams = selectedGame ? [selectedGame.away.name, selectedGame.home.name] : [];
  const selectedFavoriteTeams = selectedTeams.filter((team) => favoriteTeams.includes(team));
  const subscriberWillBeNotified = Boolean(selectedGame && alertsEnabled && selectedGame.status === "live" && selectedFavoriteTeams.length > 0);

  const launchWatch = (game: Game) => {
    if (!game.watchUrl) return;
    window.open(game.watchUrl, "_blank", "noopener,noreferrer");
  };

  const toggleFavoriteTeam = (team: string) => {
    setFavoriteTeams((currentTeams) => (currentTeams.includes(team) ? currentTeams.filter((currentTeam) => currentTeam !== team) : [...currentTeams, team]));
  };

  return (
    <>
      <div className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-5 lg:px-8" aria-label="Featured games and watch links">
          <div className="sticky left-0 z-10 flex min-w-56 items-center border-x border-zinc-200 bg-zinc-50 px-4 py-3 shadow-[12px_0_18px_rgba(250,250,250,.92)]">
            <label className="w-full">
              <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Level</span>
              <select
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-black uppercase text-zinc-950 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                aria-label="Filter ticker by level"
              >
                {levelFilters.map((level) => (
                  <option key={level} value={level}>
                    {level === "All" ? "All levels" : level}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredGames.map((game) => (
            <button
              type="button"
              key={game.id}
              onClick={() => setSelectedGame(game)}
              className="group min-w-64 border-r border-zinc-200 px-4 py-3 text-left transition hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusStyles[game.status]}`}>{statusLabel(game)}</span>
                <span className="text-[10px] font-black uppercase text-zinc-400">{game.level}</span>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs font-bold uppercase">
                <ScoreLine game={game} side="away" />
                <ScoreLine game={game} side="home" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-black uppercase text-red-600">
                <span className="inline-flex items-center gap-1.5">
                  <Play size={11} fill="currentColor" />
                  {game.streamLabel}
                </span>
                <span className="text-zinc-400 transition group-hover:text-zinc-950">Open</span>
              </div>
            </button>
          ))}
          {filteredGames.length === 0 ? (
            <div className="flex min-w-80 items-center border-r border-zinc-200 px-5 py-3 text-xs font-bold uppercase text-zinc-500">
              No games listed for {levelFilter} yet
            </div>
          ) : null}
        </div>
      </div>

      {selectedGame ? (
        <div className="fixed inset-0 z-[70] bg-black/55 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="game-hub-title">
          <div className="mx-auto flex min-h-full max-w-lg items-center">
            <div className="w-full overflow-hidden rounded-lg bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-red-600">{selectedGame.level} Game Hub</p>
                  <h2 id="game-hub-title" className="mt-1 text-2xl font-black leading-tight text-zinc-950">
                    {selectedGame.away.name} at {selectedGame.home.name}
                  </h2>
                </div>
                <button type="button" onClick={() => setSelectedGame(null)} className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200" aria-label="Close game hub">
                  <X size={20} />
                </button>
              </div>

              <div className="px-5 py-5">
                <div className="rounded-lg border border-zinc-200">
                  <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusStyles[selectedGame.status]}`}>{statusLabel(selectedGame)}</span>
                    <span className="text-xs font-bold text-zinc-500">{selectedGame.venue}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 px-4 py-5 text-lg font-black uppercase">
                    <ScoreLine game={selectedGame} side="away" />
                    <ScoreLine game={selectedGame} side="home" />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => launchWatch(selectedGame)}
                    disabled={!selectedGame.watchUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-black uppercase text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    <Play size={16} fill="currentColor" />
                    {selectedGame.streamStatus === "missing" ? "Stream needed" : "Watch game"}
                  </button>
                  <a
                    href={selectedGame.statsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 px-5 py-3 text-sm font-black uppercase text-zinc-950 transition hover:border-zinc-950"
                  >
                    Live stats
                    <ExternalLink size={16} />
                  </a>
                </div>

                {selectedGame.streamStatus === "missing" ? (
                  <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-700">
                      <Radio size={15} />
                      No verified stream yet
                    </p>
                    <p className="mt-2 text-sm leading-6 text-red-950/75">
                      Hoop Frens can keep looking for an official school, team, conference, or association stream and update this game when one is verified.
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 rounded-lg border border-zinc-200 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-700">
                        <Bell size={15} className="text-red-600" />
                        Favorite-team alerts
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        Subscribers can get notified when a favorite team is live or when a verified stream becomes available.
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs font-black uppercase text-zinc-700">
                      <input
                        type="checkbox"
                        checked={alertsEnabled}
                        onChange={(event) => setAlertsEnabled(event.target.checked)}
                        className="size-4 accent-red-600"
                      />
                      Alerts on
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedTeams.map((team) => {
                      const selected = favoriteTeams.includes(team);
                      return (
                        <button
                          type="button"
                          key={team}
                          onClick={() => toggleFavoriteTeam(team)}
                          className={`rounded-full px-4 py-2 text-xs font-black uppercase transition ${selected ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                        >
                          {selected ? "Following " : "Follow "}
                          {team}
                        </button>
                      );
                    })}
                  </div>
                  <p className={`mt-4 text-xs font-bold uppercase ${subscriberWillBeNotified ? "text-red-600" : "text-zinc-500"}`}>
                    {subscriberWillBeNotified ? `Live alert ready for ${selectedFavoriteTeams.join(" and ")}` : "No live favorite-team alert for this game yet"}
                  </p>
                </div>

                <div className="mt-5 rounded-lg bg-zinc-100 p-4">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-700">
                    <Radio size={15} className="text-red-600" />
                    Stream source
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Hoop Frens can route fans to the best known watch page for this level, then upgrade to exact school or conference streams when a verified feed is available.
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase text-zinc-500">Source: {selectedGame.sourceLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
