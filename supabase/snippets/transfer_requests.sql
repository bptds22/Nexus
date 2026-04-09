-- Transfer requests table for CÉGEP recruiter transfers
CREATE TABLE IF NOT EXISTS transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  from_school_id UUID REFERENCES schools(id),
  to_school_id UUID REFERENCES schools(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  reason TEXT,
  keep_favorites BOOLEAN DEFAULT true,
  keep_pipeline BOOLEAN DEFAULT true,
  keep_notes BOOLEAN DEFAULT true,
  keep_lists BOOLEAN DEFAULT true,
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id)
);

ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own transfers"
ON transfer_requests FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view transfers for their school"
ON transfer_requests FOR SELECT
USING (
  from_school_id IN (SELECT school_id FROM users WHERE id = auth.uid() AND is_school_admin = true)
  OR to_school_id IN (SELECT school_id FROM users WHERE id = auth.uid() AND is_school_admin = true)
);

CREATE POLICY "Admins can update transfers for their school"
ON transfer_requests FOR UPDATE
USING (
  from_school_id IN (SELECT school_id FROM users WHERE id = auth.uid() AND is_school_admin = true)
  OR to_school_id IN (SELECT school_id FROM users WHERE id = auth.uid() AND is_school_admin = true)
);
