"use client";

import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FormEvent, useState } from "react";

export function NewsletterSignup() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim().toLowerCase();
    const role = String(data.get("role") || "").trim();
    const favoriteLevel = String(data.get("favoriteLevel") || "").trim();
    const favoriteTeam = String(data.get("favoriteTeam") || "").trim();
    const consent = data.get("consent") === "on";

    if (!name || !email || !role || !favoriteLevel) {
      setStatus("error");
      setMessage("Add your name, email, role, and favorite level to join.");
      return;
    }
    if (!consent) {
      setStatus("error");
      setMessage("Confirm that Hoop Frens can contact you.");
      return;
    }
    if (!db) {
      setStatus("error");
      setMessage("Newsletter signup is not configured yet.");
      return;
    }

    setStatus("loading");
    try {
      await addDoc(collection(db, "communityMembers"), {
        name,
        email,
        role,
        favoriteLevel,
        favoriteTeam,
        consent,
        source: "homepage-community-form",
        createdAt: serverTimestamp(),
        status: "new",
      });
      form.reset();
      setStatus("success");
      setMessage("You're in. Welcome to Hoop Frens.");
    } catch {
      setStatus("error");
      setMessage("We couldn't add you right now. Please try again.");
    }
  }

  return (
    <section className="relative overflow-hidden bg-red-600 px-5 py-24">
      <div className="absolute -right-20 -top-28 size-96 rounded-full border-[70px] border-black/10" />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">Join the community</p>
        <h2 className="mt-4 text-5xl font-black uppercase tracking-[-0.05em] text-white sm:text-7xl">Don&apos;t miss the next story.</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-red-100">Player spotlights, coach conversations, recruiting guidance, and the stories mainstream coverage skips.</p>
        <form onSubmit={handleSubmit} className="mx-auto mt-9 grid max-w-3xl gap-3 text-left sm:grid-cols-2">
          <input name="name" aria-label="First name" placeholder="First name" className="form-field border-white/30 bg-black/20 placeholder:text-red-100" />
          <input name="email" type="email" aria-label="Email address" placeholder="Email address" className="form-field border-white/30 bg-black/20 placeholder:text-red-100" />
          <select name="role" aria-label="Role" defaultValue="" className="form-field border-white/30 bg-black/20 text-red-100">
            <option value="" disabled>Role</option>
            <option>Fan</option>
            <option>Player</option>
            <option>Coach</option>
            <option>Parent</option>
            <option>School / athletic staff</option>
            <option>Media</option>
          </select>
          <select name="favoriteLevel" aria-label="Favorite level" defaultValue="" className="form-field border-white/30 bg-black/20 text-red-100">
            <option value="" disabled>Favorite level</option>
            <option>JUCO</option>
            <option>NAIA</option>
            <option>NCAA DII</option>
            <option>NCAA DIII</option>
            <option>NCCAA</option>
            <option>USCAA</option>
            <option>All levels</option>
          </select>
          <input name="favoriteTeam" aria-label="Favorite team" placeholder="Favorite team (optional)" className="form-field border-white/30 bg-black/20 placeholder:text-red-100 sm:col-span-2" />
          <label className="flex items-start gap-3 rounded-xl border border-white/20 bg-black/15 p-4 text-sm font-bold leading-6 text-red-50 sm:col-span-2">
            <input name="consent" type="checkbox" className="mt-1 size-4 shrink-0 accent-black" />
            Send me Hoop Frens updates, live-game alerts, and community news.
          </label>
          <button disabled={status === "loading"} className="rounded-xl bg-black px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition hover:bg-zinc-900 disabled:opacity-60 sm:col-span-2">{status === "loading" ? "Joining..." : "Join now"}</button>
        </form>
        {message ? <p role="status" className="mt-4 text-sm font-bold text-white">{message}</p> : null}
      </div>
    </section>
  );
}
