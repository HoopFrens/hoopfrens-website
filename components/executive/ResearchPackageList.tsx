type ResearchPackageListProps = {
  title: string;
  items: string[];
};

export function ResearchPackageList({ title, items }: ResearchPackageListProps) {
  return (
    <div>
      <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">{title}</h4>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => (
          <li key={item} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2 text-xs font-bold leading-5 text-zinc-300">
            <span className="text-red-500">+</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
