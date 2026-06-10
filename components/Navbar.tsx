"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/#divisions", label: "Divisions" },
  { href: "/#stories", label: "Stories" },
  { href: "/#recruiting", label: "Recruiting" },
  { href: "/#rankings", label: "Rankings" },
  { href: "/#media", label: "Media" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8" aria-label="Main navigation">
        <Link href="/" className="text-2xl font-black uppercase tracking-[-0.06em] text-white">
          Hoop<span className="text-red-500">Frens</span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-bold uppercase tracking-wider text-zinc-300 transition hover:text-yellow-400">
              {link.label}
            </Link>
          ))}
        </div>
        <Link href="/submit" className="hidden rounded-full bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-500 md:block">
          Submit a spotlight
        </Link>
        <button className="text-white md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      {open ? (
        <div className="border-t border-white/10 bg-black px-5 py-6 md:hidden">
          <div className="flex flex-col gap-5">
            {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="font-bold uppercase text-zinc-200">{link.label}</Link>)}
            <Link href="/submit" onClick={() => setOpen(false)} className="font-bold uppercase text-red-400">Submit a spotlight</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}