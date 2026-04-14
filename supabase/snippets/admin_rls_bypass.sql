-- Admin RLS bypass — promote Bruno and add admin read/write policies
-- across every table the admin portal queries.

-- 1. Promote account to ADMIN
UPDATE users SET role = 'ADMIN' WHERE email = 'bpdesfosses@gmail.com';

-- 2. Reusable admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN');
$$;

-- 3. Admin READ policies
CREATE POLICY "admins read all" ON public.users FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.athletes FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.schools FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.sports FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.positions FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.evaluations FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.subscriptions FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.recruiter_pipeline FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.recruiter_favorites FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.profile_views FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.reports FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.teams FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.team_athletes FOR SELECT USING (is_admin());
CREATE POLICY "admins read all" ON public.profile_changes FOR SELECT USING (is_admin());

-- 4. Admin UPDATE policies
CREATE POLICY "admins update all" ON public.users FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins update all" ON public.athletes FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins update all" ON public.schools FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins update all" ON public.sports FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins update all" ON public.positions FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins update all" ON public.evaluations FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins update all" ON public.subscriptions FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins update all" ON public.recruiter_pipeline FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins update all" ON public.reports FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- 5. Admin INSERT policies
CREATE POLICY "admins insert all" ON public.schools FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admins insert all" ON public.sports FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admins insert all" ON public.positions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admins insert all" ON public.subscriptions FOR INSERT WITH CHECK (is_admin());

-- 6. Admin DELETE policies
CREATE POLICY "admins delete all" ON public.positions FOR DELETE USING (is_admin());
CREATE POLICY "admins delete all" ON public.reports FOR DELETE USING (is_admin());
