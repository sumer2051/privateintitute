
-- Revoke EXECUTE from anon on all SECURITY DEFINER functions in public schema
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_account_balance(uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_transfer_pin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_transfer_pin(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_transfer_pin(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_support_staff(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_account_balance(uuid, numeric, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_account_frozen(uuid, boolean, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_transaction_status(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_staff_action(text, text, uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_staff_pin(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_staff_pin(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_staff_pin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_invite_only() FROM anon, PUBLIC;

-- Re-grant to authenticated for the RPCs the app calls
GRANT EXECUTE ON FUNCTION public.adjust_account_balance(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_transfer_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_transfer_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_transfer_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_account_balance(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_frozen(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_transaction_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_staff_pin() TO authenticated;
