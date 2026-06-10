type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
};

export function SectionHeading({ eyebrow, title, description, centered = false }: SectionHeadingProps) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-4xl font-black uppercase tracking-[-0.04em] text-white sm:text-6xl">{title}</h2>
      {description ? <p className="mt-5 text-base leading-7 text-zinc-400 sm:text-lg">{description}</p> : null}
    </div>
  );
}