"use client";

import { accessDeniedCopy } from "@/components/admin/adminDashboardUtils";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useState } from "react";

export function AccessRestricted() {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    const activeAuth = auth;
    if (!activeAuth || signingOut) return;

    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut(activeAuth);
    } catch {
      setSignOutError("Sign out was unsuccessful. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <section
      aria-labelledby="access-restricted-title"
      className="mx-auto w-full max-w-xl border border-red-600/40 bg-black p-6 shadow-2xl sm:p-8"
    >
      <ShieldAlert aria-hidden="true" className="text-red-500" size={34} />
      <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-red-500">Hoop Frens Headquarters</p>
      <h1 id="access-restricted-title" className="mt-3 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
        {accessDeniedCopy.title}
      </h1>
      <p className="mt-4 leading-7 text-zinc-300">{accessDeniedCopy.body}</p>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{accessDeniedCopy.help}</p>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 sm:w-auto"
      >
        {signingOut ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <LogOut aria-hidden="true" size={16} />}
        {signingOut ? "Signing Out" : "Sign Out"}
      </button>
      {signOutError ? <p role="alert" className="mt-4 text-sm font-bold text-red-300">{signOutError}</p> : null}
    </section>
  );
}
