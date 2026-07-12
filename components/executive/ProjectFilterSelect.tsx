"use client";

type ProjectFilterSelectProps = {
  label: string;
  value: string;
  onChange(value: string): void;
  options: Array<{ value: string; label: string }>;
};

export function ProjectFilterSelect({ label, value, onChange, options }: ProjectFilterSelectProps) {
  return (
    <label className="block">
      <span className="sr-only">Filter by {label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full border border-white/10 bg-black px-3 text-xs font-black text-zinc-300 outline-none transition focus:border-red-500"
      >
        <option value="all">{label}: All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
