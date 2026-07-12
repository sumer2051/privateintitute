# AI Customer Support System

Build a complete support system integrated across the app, using the existing AI chat widget as the entry point.

## 1. Database (new migration)

**`support_tickets`**
- ticket_number (e.g. `TKT-2026-000123`), user_id, customer_name, customer_email
- subject, description, category
- priority: low | medium | high | urgent
- status: open | pending | in_progress | resolved | closed
- assigned_to (nullable, uuid), ai_summary, created_at, updated_at

**`ticket_messages`**
- ticket_id, sender_type (customer | agent | ai | system), sender_id, message, created_at

**`scheduled_calls`**
- user_id, customer_name, phone, email, reason
- scheduled_at (timestamptz), timezone
- status: scheduled | completed | missed | rescheduled | cancelled
- agent_notes, assigned_to, created_at, updated_at

**`user_roles`** (if not present) + `has_role()` security-definer function.
Admin/support roles: `admin`, `support`.

RLS:
- Users: read/insert own tickets, calls, and messages on their own tickets.
- Admin/support: read/update/delete all.
Grants for `authenticated` + `service_role`. Auto ticket-number via trigger + sequence.

## 2. Edge Functions

- `create-support-ticket` — inserts ticket, emails customer confirmation + admin notification, returns ticket number.
- `schedule-support-call` — inserts call, emails customer + admin confirmation.
- `send-call-reminder` — cron-invocable, emails reminders ~1h before scheduled_at.
- Extend existing `ai-support-chat` — after N failed resolutions or explicit escalation, call `create-support-ticket` with AI-generated summary and return the ticket number in-chat.

All emails go through existing Gmail connector, branded with BoA private institute logo.

## 3. Frontend

**Global**
- `SupportLauncher` floating button on every page (mounted in `App.tsx`) opening a sheet with tabs: **Ask AI**, **My Tickets**, **Schedule a Call**.
- Reuse existing `AiChatWidget` inside Ask AI tab; add "Create ticket" button when AI suggests escalation.

**`/support` page**
- Full-page version of the same three tabs plus ticket detail view with message thread and reply box.

**`/admin/support` page (admin/support role only)**
- Ticket list with search, status/priority filters, assignment dropdown.
- Ticket detail: full thread, internal reply (emails customer), status/priority controls, AI-suggested reply button.
- Calls tab: upcoming calls, accept / reschedule / cancel / mark completed/missed, notes field.
- Analytics cards: open tickets, avg response time, resolution rate, calls today.

**Notifications**
- Extend existing `NotificationsBell` with realtime subscription to `support_tickets` and `ticket_messages` for the current user (and all rows for admins).

## 4. Routing & access
- `/support` — any authenticated user.
- `/admin/support` — gated by `has_role(auth.uid(),'admin' or 'support')`; redirect others.

## 5. Security
- All tables RLS-locked; roles in separate `user_roles` table via `has_role()`.
- Edge functions validate JWT, use service role only server-side for admin notifications.
- Email addresses validated; rate-limit ticket creation per user (5/min in function).

## Out of scope
- Real telephony (calls are scheduled bookings, not live calls).
- Full CRM-style customer 360 beyond existing profile + ticket history.

Approve to proceed?