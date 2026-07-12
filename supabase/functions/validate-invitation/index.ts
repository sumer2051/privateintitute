import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return json({ valid: false, message: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '').trim();

    if (!/^[a-f0-9]{48}$/i.test(token)) {
      return json({ valid: false, message: 'This invitation link is invalid.' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: invitation, error } = await admin
      .from('invitations')
      .select('email,status,expires_at')
      .eq('token', token)
      .maybeSingle();

    if (error) return json({ valid: false, message: 'Unable to verify this invitation.' }, 500);
    if (!invitation) return json({ valid: false, message: 'This invitation link is invalid.' });

    if (invitation.status !== 'pending') {
      return json({
        valid: false,
        status: invitation.status,
        message: `This invitation has already been ${invitation.status}.`,
      });
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return json({ valid: false, status: 'expired', message: 'This invitation has expired. Ask your admin for a new one.' });
    }

    return json({
      valid: true,
      email: invitation.email,
      status: invitation.status,
      expires_at: invitation.expires_at,
    });
  } catch (e: any) {
    return json({ valid: false, message: e?.message || 'Unable to verify this invitation.' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}