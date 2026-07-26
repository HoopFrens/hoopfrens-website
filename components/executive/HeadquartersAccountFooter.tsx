import { Loader2, LogOut } from "lucide-react";

type HeadquartersAccountFooterProps = {
  userLabel: string;
  signingOut: boolean;
  signOutError: string;
  onSignOut(): void;
};

export function HeadquartersAccountFooter({
  userLabel,
  signingOut,
  signOutError,
  onSignOut,
}: HeadquartersAccountFooterProps) {
  return (
    <div className="border-t border-white/10 p-3 lg:mt-auto lg:p-4">
      <div className="flex min-w-0 items-center justify-between gap-3 lg:block">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Signed in</p>
          <p className="mt-1 truncate text-xs font-bold text-zinc-300 lg:mt-2">{userLabel}</p>
        </div>
        <button
          aria-busy={signingOut}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200 transition hover:border-red-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50 lg:mt-3 lg:w-full"
          disabled={signingOut}
          onClick={onSignOut}
          type="button"
        >
          {signingOut ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={15} />
          ) : (
            <LogOut aria-hidden="true" size={15} />
          )}
          {signingOut ? "Signing Out" : "Sign Out"}
        </button>
      </div>
      {signOutError ? (
        <p className="mt-3 text-xs font-bold leading-5 text-red-300" role="alert">
          {signOutError}
        </p>
      ) : null}
    </div>
  );
}
