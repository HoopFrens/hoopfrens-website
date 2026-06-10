import Link from "next/link";

export default function NotFound() {
  return <section className="grid min-h-[75vh] place-items-center px-5 pt-20 text-center"><div><p className="eyebrow">Out of bounds</p><h1 className="mt-4 text-7xl font-black uppercase text-white">404</h1><p className="mt-4 text-zinc-400">That page is not on the roster.</p><Link href="/" className="mt-8 inline-block rounded-full bg-red-600 px-6 py-3 font-black uppercase text-white">Back home</Link></div></section>;
}