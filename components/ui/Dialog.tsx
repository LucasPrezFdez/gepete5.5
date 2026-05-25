"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
};

export function Dialog({ open, onClose, title, description, size = "md", children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleClose = () => onClose();
    node.addEventListener("close", handleClose);
    return () => node.removeEventListener("close", handleClose);
  }, [onClose]);

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      className={cn(
        "m-auto rounded-2xl border border-white/[0.08] bg-background text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-in fade-in",
        size === "sm" && "w-[calc(100%-2rem)] max-w-sm",
        size === "md" && "w-[calc(100%-2rem)] max-w-md",
        size === "lg" && "w-[calc(100%-2rem)] max-w-2xl",
        "p-0",
        className
      )}
    >
      <div className="flex max-h-[85vh] flex-col">
        {(title || description) && (
          <header className="border-b border-white/[0.06] px-5 py-4">
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </header>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}

type DialogFooterProps = {
  children: React.ReactNode;
  className?: string;
};

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <footer
      className={cn(
        "-mx-5 -mb-4 mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] bg-white/[0.02] px-5 py-3",
        className
      )}
    >
      {children}
    </footer>
  );
}
