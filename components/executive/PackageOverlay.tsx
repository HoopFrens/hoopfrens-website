"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

export type PackageOverlayMetadata = {
  label: string;
  value: string;
};

type PackageOverlayFrameProps = {
  title: string;
  projectTitle: string;
  status: string;
  metadata: PackageOverlayMetadata[];
  titleId: string;
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  onClose(): void;
  onBackdropMouseDown?(event: ReactMouseEvent<HTMLDivElement>): void;
  children?: ReactNode;
};

type PackageOverlayProps = Omit<PackageOverlayFrameProps, "titleId" | "closeButtonRef" | "onBackdropMouseDown">;

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
const subscribeToClientEnvironment = () => () => {};

export function overlayFocusWrapIndex(currentIndex: number, focusableCount: number, shiftKey: boolean) {
  if (focusableCount <= 0) return null;
  if (currentIndex < 0) return shiftKey ? focusableCount - 1 : 0;
  if (shiftKey && currentIndex === 0) return focusableCount - 1;
  if (!shiftKey && currentIndex === focusableCount - 1) return 0;
  return null;
}

export function isPackageOverlayDismissKey(key: string) {
  return key === "Escape";
}

export function PackageOverlayFrame({
  title,
  projectTitle,
  status,
  metadata,
  titleId,
  closeButtonRef,
  onClose,
  onBackdropMouseDown,
  children,
}: PackageOverlayFrameProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-5"
      data-package-overlay-backdrop="true"
      onMouseDown={onBackdropMouseDown}
    >
      <section
        className="flex h-[88vh] w-[92vw] max-w-[1280px] min-w-0 flex-col overflow-hidden border border-white/15 bg-[#090909] text-white shadow-2xl shadow-black/80 sm:h-[86vh] sm:w-[88vw]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-package-overlay="true"
      >
        <header className="shrink-0 border-b border-white/10 bg-[#0d0d0d] px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">Headquarters Package</p>
              <h2 id={titleId} className="mt-2 text-xl font-black uppercase leading-tight text-white sm:text-2xl">{title}</h2>
              <p className="mt-2 break-words text-sm font-bold leading-6 text-zinc-300">{projectTitle}</p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex size-10 shrink-0 items-center justify-center border border-white/15 text-zinc-300 transition hover:border-red-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              aria-label={`Close ${title}`}
              title={`Close ${title}`}
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-red-200">
              {status}
            </span>
            {metadata.map((item) => (
              <span key={item.label} className="max-w-full border border-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
                {item.label}: <span className="break-words text-zinc-200">{item.value}</span>
              </span>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" data-package-overlay-scroll="true">
          {children}
        </div>
      </section>
    </div>
  );
}

export function PackageOverlay({ title, projectTitle, status, metadata, onClose, children }: PackageOverlayProps) {
  const mounted = useSyncExternalStore(subscribeToClientEnvironment, () => true, () => false);
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!mounted) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (isPackageOverlayDismissKey(event.key)) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const targetIndex = overlayFocusWrapIndex(currentIndex, focusable.length, event.shiftKey);
      if (targetIndex === null) return;
      event.preventDefault();
      focusable[targetIndex]?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div ref={(element) => { dialogRef.current = element?.querySelector("[role='dialog']") || null; }}>
      <PackageOverlayFrame
        title={title}
        projectTitle={projectTitle}
        status={status}
        metadata={metadata}
        titleId={titleId}
        closeButtonRef={closeButtonRef}
        onClose={onClose}
        onBackdropMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {children}
      </PackageOverlayFrame>
    </div>,
    document.body,
  );
}
