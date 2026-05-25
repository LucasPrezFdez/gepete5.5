"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  hint?: string;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", hint: "Visión general" },
  { href: "/admin/users", label: "Usuarios", hint: "Gestión de cuentas" },
  { href: "/admin/reports", label: "Moderación", hint: "Cola de reportes" },
  { href: "/admin/games", label: "Catálogo", hint: "Juegos y overrides" },
  { href: "/admin/cache", label: "Caché", hint: "Estado y resync" }
];

type AdminSidebarProps = {
  pendingReports?: number;
};

export function AdminSidebar({ pendingReports = 0 }: AdminSidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:block lg:w-60 lg:shrink-0">
      <nav className="sticky top-24 grid gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2" aria-label="Panel de administración">
        <div className="px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A3E635]">Admin</p>
          <p className="mt-0.5 text-[12px] text-muted">Panel interno</p>
        </div>
        {NAV.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const showBadge = item.href === "/admin/reports" && pendingReports > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13.5px] font-medium motion-safe:transition-colors motion-safe:duration-150",
                active
                  ? "bg-white/[0.07] text-foreground"
                  : "text-muted hover:bg-white/[0.04] hover:text-foreground"
              )}
            >
              <span className="flex flex-col">
                <span>{item.label}</span>
                {item.hint && <span className="text-[11px] font-normal text-muted/70">{item.hint}</span>}
              </span>
              {showBadge && (
                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#A3E635] px-1.5 text-[10px] font-bold text-background">
                  {pendingReports > 99 ? "99+" : pendingReports}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdminMobileNav({ pendingReports = 0 }: AdminSidebarProps) {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden -mx-4 flex gap-2 overflow-x-auto px-4 pb-2" aria-label="Panel de administración (móvil)">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const showBadge = item.href === "/admin/reports" && pendingReports > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium",
              active
                ? "border-[#A3E635]/40 bg-[#A3E635]/10 text-[#A3E635]"
                : "border-white/[0.08] bg-white/[0.02] text-muted hover:text-foreground"
            )}
          >
            {item.label}
            {showBadge && (
              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#A3E635] px-1 text-[9px] font-bold text-background">
                {pendingReports > 99 ? "99+" : pendingReports}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
