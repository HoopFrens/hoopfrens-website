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

    if (!name || !email) {
      setStatus("error");
      setMessage("Add your name and email to join.");
      return;
    }
    if (!db) {
      setStatus("error");
      setMessage("Newsletter signup is not configured yet.");
      return;
    }

    setStatus("loading");
    try {
      await addDoc(collection(db, "newsletterSubscribers"), { name, email, source: "homepage", createdAt: serverTimestamp() });
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
        <form onSubmit={handleSubmit} className="mx-auto mt-9 grid max-w-2xl gap-3 sm:grid-cols-[1fr_1.25fr_auto]">
          <input name="name" aria-label="First name" placeholder="First name" className="form-field border-white/30 bg-black/20 placeholder:text-red-100" />
          <input name="email" type="email" aria-label="Email address" placeholder="Email address" className="form-field border-white/30 bg-black/20 placeholder:text-red-100" />
          <button disabled={status === "loading"} className="rounded-xl bg-black px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition hover:bg-zinc-900 disabled:opacity-60">{status === "loading" ? "Joining..." : "Join now"}</button>
        </form>
        {message ? <p role="status" className="mt-4 text-sm font-bold text-white">{message}</p> : null}
      </div>
    </section>
  );
}