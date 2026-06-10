import { SubmissionForm } from "@/components/SubmissionForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Submit a Spotlight", description: "Nominate a player, coach, or school for a Hoop Frens spotlight." };

export default function SubmitPage() {
  return (
    <section className="px-5 pb-28 pt-40 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.7fr_1.3fr]">
        <div><p className="eyebrow">Put us on game</p><h1 className="mt-4 text-5xl font-black uppercase leading-[.92] tracking-[-0.05em] text-white sm:text-7xl">A great story deserves a bigger audience.</h1><p className="mt-6 text-lg leading-8 text-zinc-400">Nominate a player, coach, or school from JUCO, NAIA, NCAA DII, NCAA DIII, NCCAA, or USCAA. Give us the context that makes the story matter.</p></div>
        <SubmissionForm />
      </div>
    </section>
  );
}