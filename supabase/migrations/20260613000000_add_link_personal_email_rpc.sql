-- Create link_personal_email RPC function to securely update login email
-- without sending verification emails (preventing bounces & session dropout)

CREATE OR REPLACE FUNCTION public.link_personal_email(p_personal_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_trimmed_email TEXT;
BEGIN
  -- 1. Get current authenticated user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication session missing. Please log in again.';
  END IF;

  -- 2. Clean and validate email input
  v_trimmed_email := LOWER(TRIM(p_personal_email));
  
  IF v_trimmed_email = '' OR v_trimmed_email IS NULL THEN
    RAISE EXCEPTION 'Personal email address cannot be empty.';
  END IF;

  IF v_trimmed_email LIKE '%@churchone.com' THEN
    RAISE EXCEPTION 'Please enter a personal email address (e.g. Gmail), not a @churchone.com email.';
  END IF;

  -- 3. Check for duplicates in auth.users
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = v_trimmed_email AND id != v_user_id
  ) THEN
    RAISE EXCEPTION 'This email address is already registered to another account.';
  END IF;

  -- 4. Update the email directly in auth.users and mark as confirmed
  UPDATE auth.users
  SET email = v_trimmed_email,
      email_confirmed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 5. Force update on people table as well to ensure immediate cache invalidation and UI reactivity
  UPDATE public.people
  SET personal_email = v_trimmed_email,
      email_verified = TRUE
  WHERE auth_user_id = v_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
