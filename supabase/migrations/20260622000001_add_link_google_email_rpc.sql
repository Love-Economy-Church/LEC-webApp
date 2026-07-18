-- RPC to link a verified Google email to a person's profile.
-- Called from /auth/callback after Google OAuth completes in "link mode".
-- Uses SECURITY DEFINER because the currently authenticated user at call time
-- is the Google OAuth user, not the original @churchone.com user.

CREATE OR REPLACE FUNCTION public.link_google_email(
  p_person_id UUID,
  p_gmail     TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := LOWER(TRIM(p_gmail));

  -- Basic validation
  IF v_email = '' OR v_email IS NULL THEN
    RAISE EXCEPTION 'Gmail address cannot be empty.';
  END IF;

  IF v_email LIKE '%@churchone.com' THEN
    RAISE EXCEPTION 'Cannot link a @churchone.com email as a personal email.';
  END IF;

  -- Prevent overwriting an already-verified account
  IF EXISTS (
    SELECT 1 FROM public.people
    WHERE id = p_person_id AND email_verified = TRUE
  ) THEN
    RAISE EXCEPTION 'This account already has a verified email linked.';
  END IF;

  -- Prevent duplicate emails across all accounts
  IF EXISTS (
    SELECT 1 FROM public.people
    WHERE personal_email = v_email AND id != p_person_id
  ) THEN
    RAISE EXCEPTION 'This Gmail is already linked to another ChurchOne account.';
  END IF;

  -- Save the verified Gmail and mark the account as verified
  UPDATE public.people
  SET personal_email = v_email,
      email_verified  = TRUE
  WHERE id = p_person_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Person record not found. Contact your admin.';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow any authenticated user (including the transient Google session) to call this
GRANT EXECUTE ON FUNCTION public.link_google_email(UUID, TEXT) TO authenticated;
