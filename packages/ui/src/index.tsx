// Shared React UI primitives (Tailwind classes; the consuming app scans this package).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="w-full max-w-md rounded-lg border-2 border-amber-900 bg-amber-50 p-6 text-amber-950 shadow-[4px_4px_0_0_#78350f]">
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded border-2 border-amber-900 bg-amber-400 px-4 py-2 font-bold hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input className="w-full rounded border-2 border-amber-900 bg-white px-3 py-2" {...props} />
    </label>
  );
}
