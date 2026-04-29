import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "./_components/AdminShell";

/* ─────────────────────────────────────────────────────────────────
   Admin Portal Layout — server component + SSR guard.

   Pattern:
   - Layout itself is async + runs the is_platform_admin check
     before any UI mounts. Non-admins see the redirect destination,
     not a flash of admin chrome.
   - Mobile menu state + sidebar live in AdminShell (client) so the
     layout stays pure server.

   Auth + authz:
   - No session → /auth
   - Authenticated but not is_platform_admin = true → /
   - Otherwise → render <AdminShell>{children}</AdminShell>

   The guard uses the SECURITY DEFINER helper is_platform_admin(uid)
   added in 20260429000000_add_media_partners.sql, which falls
   back to false when the row is missing.
───────────────────────────────────────────────────────────────── */

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin", { uid: user.id });
  if (error) {
    console.error("[admin layout] is_platform_admin rpc:", error);
    redirect("/");
  }
  if (!isAdmin) redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
