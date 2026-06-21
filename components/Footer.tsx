import { divisions } from "@/data/divisions";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black px-5 py-14">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr] lg:px-3">
        <div><Link href="/" className="text-3xl font-black uppercase tracking-[-0.06em] text-white">Hoop<span className="text-red-500">Frens</span></Link><p className="mt-4 max-w-sm leading-7 text-zinc-500">The basketball media home for every pathway, every player, and every program beyond the usual spotlight.</p></div>
        <div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">Coverage</h3><div className="mt-5 grid grid-cols-2 gap-3">{divisions.map((division) => <Link key={division.slug} href={`/${division.slug}`} className="text-sm font-semibold text-zinc-400 hover:text-white">{division.shortName}</Link>)}</div></div>
        <div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">Community</h3><div className="mt-5 flex flex-col gap-3"><Link href="/join" className="text-sm font-semibold text-zinc-400 hover:text-white">Join the community</Link><Link href="/submit" className="text-sm font-semibold text-zinc-400 hover:text-white">Submit a spotlight</Link><Link href="/recruiting-resources" className="text-sm font-semibold text-zinc-400 hover:text-white">Recruiting resources</Link><a href="mailto:hello@hoopfrens.com" className="text-sm font-semibold text-zinc-400 hover:text-white">Contact us</a></div></div>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-7 text-xs font-bold uppercase tracking-wider text-zinc-600 sm:flex-row sm:justify-between lg:px-3"><p>© 2026 Hoop Frens. All rights reserved.</p><p>Everybody Hoops. Everyone&apos;s Welcome.</p></div>
    </footer>
  );
}
