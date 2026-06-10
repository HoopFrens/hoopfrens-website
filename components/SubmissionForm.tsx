"use client";

import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FormEvent, useState } from "react";

export function SubmissionForm() {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) {
      setState("error");
      setMessage("Submissions are not configured yet.");
      return;
    }
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setState("loading");
    try {
      await addDoc(collection(db, "spotlightSubmissions"), { ...values, createdAt: serverTimestamp(), status: "new" });
      form.reset();
      setState("success");
      setMessage("Submission received. Thanks for putting a great story on our radar.");
    } catch {
      setState("error");
      setMessage("We couldn't send your submission. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-9">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="form-label">Submission type<select name="type" required className="form-field mt-2"><option value="player">Player spotlight</option><option value="coach">Coach spotlight</option><option value="school">School spotlight</option></select></label>
        <label className="form-label">Division<select name="division" required className="form-field mt-2"><option>JUCO</option><option>NAIA</option><option>NCAA DII</option><option>NCAA DIII</option><option>NCCAA</option><option>USCAA</option></select></label>
        <label className="form-label">Your name<input name="submittedBy" required className="form-field mt-2" /></label>
        <label className="form-label">Your email<input name="email" type="email" required className="form-field mt-2" /></label>
        <label className="form-label">Who or what are you submitting?<input name="subjectName" required className="form-field mt-2" /></label>
        <label className="form-label">Program or school<input name="program" required className="form-field mt-2" /></label>
      </div>
      <label className="form-label">Why should Hoop Frens tell this story?<textarea name="story" required rows={7} className="form-field mt-2 resize-y" placeholder="Share the achievement, journey, context, and any helpful links." /></label>
      <label className="form-label">Supporting link (optional)<input name="supportingLink" type="url" className="form-field mt-2" placeholder="https://" /></label>
      <button disabled={state === "loading"} className="rounded-xl bg-red-600 px-6 py-4 text-sm font-black uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-60">{state === "loading" ? "Sending..." : "Submit spotlight"}</button>
      {message ? <p role="status" className={state === "error" ? "text-sm font-bold text-red-400" : "text-sm font-bold text-yellow-400"}>{message}</p> : null}
    </form>
  );
}