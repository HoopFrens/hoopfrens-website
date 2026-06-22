"use client";

import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(isFirebaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setCheckingSession(false);
      if (user) router.replace("/admin");
    });
  }, [router]);

  async function loginWithGoogle() {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace("/admin");
    } catch {
      setError("Google sign-in could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/admin");
    } catch {
      setError("Could not sign in with those credentials.");
    } finally {
      setLoading(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <section className="min-h-screen bg-zinc-950 px-5 pt-28 text-white">
        <div className="mx-auto max-w-xl border border-white/10 bg-black p-8">
          <h1 className="text-3xl font-black uppercase">Firebase is not configured</h1>
          <p className="mt-4 leading-7 text-zinc-400">Add the Firebase environment variables before using Hoop Frens admin login.</p>
        </div>
      </section>
    );
  }

  if (checkingSession) {
    return (
      <section className="min-h-screen bg-zinc-950 px-5 pt-28 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3 border border-white/10 bg-black p-6 text-sm font-black uppercase text-zinc-300">
          <Loader2 className="animate-spin text-red-500" size={20} />
          Checking session
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-zinc-950 px-5 pt-28 text-white">
      <div className="mx-auto max-w-md border border-white/10 bg-black p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">Hoop Frens Admin</p>
        <h1 className="mt-3 text-4xl font-black uppercase">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Use an approved admin account. Access is checked against Firestore at users/your Firebase UID.</p>

        <button disabled={loading} onClick={loginWithGoogle} className="mt-7 w-full rounded-lg bg-red-600 px-5 py-4 text-sm font-black uppercase text-white hover:bg-red-500 disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>

        <div className="my-6 h-px bg-white/10" />

        <form onSubmit={loginWithEmail} className="grid gap-4">
          <input name="email" type="email" required placeholder="Email" className="form-field" />
          <input name="password" type="password" required placeholder="Password" className="form-field" />
          <button disabled={loading} className="rounded-lg border border-white/15 px-5 py-4 text-sm font-black uppercase text-white hover:border-red-500 disabled:opacity-60">
            Sign in with email
          </button>
        </form>

        {error ? <p role="alert" className="mt-4 text-sm font-bold text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
