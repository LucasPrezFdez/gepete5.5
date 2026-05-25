import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireAdminPage } from "@/services/auth-server";
import { createSqlClient } from "@/services/database";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false }
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const currentPath = headerList.get("x-pathname") || "/admin";
  await requireAdminPage(currentPath);

  const sql = createSqlClient();
  const rows = (await sql.query(
    "select count(*)::int as count from content_reports where status = 'pending'"
  )) as { count: number }[];
  const pendingReports = rows[0]?.count ?? 0;

  return (
    <div className="container-page py-8 lg:py-10">
      <AdminMobileNav pendingReports={pendingReports} />
      <div className="flex gap-8">
        <AdminSidebar pendingReports={pendingReports} />
        <section className="flex-1 min-w-0">{children}</section>
      </div>
    </div>
  );
}
