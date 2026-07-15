
-- Add a limited support role that can only change transaction statuses
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tx_support';
