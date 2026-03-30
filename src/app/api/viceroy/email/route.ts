import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSequenceStep, VICEROY_SEQUENCE } from '@/lib/viceroy/emailSequence';

const FROM_EMAIL = 'Viceroy <viceroy@machinemindconsulting.com>';
const ASSESSMENT_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'https://machinemindconsulting.com'}/viceroy/assess`;

interface SendRequest {
  leads: {
    email: string;
    firstName: string;
    lastName: string;
    leadId?: string;
  }[];
  step: number; // 1, 2, or 3
}

interface BulkSendRequest {
  step: number;
  limit?: number; // max leads to send to (default 50 for safety)
}

/**
 * POST /api/viceroy/email
 * Send a sequence step to a list of leads
 * Body: { leads: [{email, firstName, lastName, leadId}], step: 1|2|3 }
 *
 * Or bulk mode:
 * Body: { step: 1|2|3, limit: 50 } — pulls qualified leads from Supabase
 */
export async function POST(request: Request) {
  // Auth
  const authKey = request.headers.get('x-viceroy-key');
  if (authKey !== process.env.VICEROY_API_KEY && process.env.VICEROY_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const body = await request.json();
  const { step } = body as SendRequest | BulkSendRequest;

  const sequenceStep = getSequenceStep(step);
  if (!sequenceStep) {
    return NextResponse.json({ error: `Invalid step: ${step}. Must be 1, 2, or 3.` }, { status: 400 });
  }

  let leads: SendRequest['leads'] = [];

  // Bulk mode — pull from Supabase
  if (!body.leads && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const limit = (body as BulkSendRequest).limit || 50;
    const { createServiceClient } = await import('@/lib/supabase/server');
    const supabase = createServiceClient();

    // For step 1: pull qualified/pending leads who haven't received step 1
    // For step 2+: pull leads who received previous step and haven't received this one
    const { data: dbLeads, error } = await supabase
      .from('viceroy_leads')
      .select('id, first_name, last_name, email, alignment_score')
      .not('email', 'is', null)
      .neq('email', '')
      .in('status', step === 1 ? ['qualified', 'pending'] : ['qualified', 'contacted', 'engaged'])
      .order('alignment_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Viceroy Email] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    if (step > 1) {
      // Only include leads who received the previous step
      const { data: previousSends } = await supabase
        .from('viceroy_email_sends')
        .select('lead_id')
        .eq('sequence_step', step - 1)
        .eq('status', 'sent');

      const previousLeadIds = new Set((previousSends || []).map((s: { lead_id: string }) => s.lead_id));

      // Exclude leads who already received this step
      const { data: thisSends } = await supabase
        .from('viceroy_email_sends')
        .select('lead_id')
        .eq('sequence_step', step);

      const thisLeadIds = new Set((thisSends || []).map((s: { lead_id: string }) => s.lead_id));

      leads = (dbLeads || [])
        .filter((l: { id: string }) => previousLeadIds.has(l.id) && !thisLeadIds.has(l.id))
        .map((l: { id: string; first_name: string; last_name: string; email: string }) => ({
          leadId: l.id,
          email: l.email,
          firstName: l.first_name,
          lastName: l.last_name,
        }));
    } else {
      // Step 1 — exclude anyone already sent step 1
      const { data: existingSends } = await supabase
        .from('viceroy_email_sends')
        .select('lead_id')
        .eq('sequence_step', 1);

      const existingIds = new Set((existingSends || []).map((s: { lead_id: string }) => s.lead_id));

      leads = (dbLeads || [])
        .filter((l: { id: string }) => !existingIds.has(l.id))
        .map((l: { id: string; first_name: string; last_name: string; email: string }) => ({
          leadId: l.id,
          email: l.email,
          firstName: l.first_name,
          lastName: l.last_name,
        }));
    }
  } else {
    leads = (body as SendRequest).leads || [];
  }

  if (leads.length === 0) {
    return NextResponse.json({ message: 'No leads to send to.', sent: 0, failed: 0 });
  }

  console.log(`[Viceroy Email] Sending step ${step} to ${leads.length} leads`);

  const results = { sent: 0, failed: 0, errors: [] as string[] };

  // Send in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (lead) => {
        try {
          const htmlContent = sequenceStep.html(lead.firstName, ASSESSMENT_URL);

          const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: lead.email,
            subject: sequenceStep.subject,
            html: htmlContent,
            tags: [
              { name: 'campaign', value: 'viceroy' },
              { name: 'step', value: String(step) },
            ],
          });

          if (error) {
            console.error(`[Viceroy Email] Failed to send to ${lead.email}:`, error);
            results.failed++;
            results.errors.push(`${lead.email}: ${error.message}`);

            // Log failure to Supabase
            if (lead.leadId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
              const { createServiceClient } = await import('@/lib/supabase/server');
              const supabase = createServiceClient();
              await supabase.from('viceroy_email_sends').insert({
                lead_id: lead.leadId,
                email: lead.email,
                first_name: lead.firstName,
                sequence_step: step,
                subject: sequenceStep.subject,
                status: 'failed',
                error_message: error.message,
                sent_at: new Date().toISOString(),
              });
            }
          } else {
            results.sent++;
            console.log(`[Viceroy Email] Sent step ${step} to ${lead.email} (id: ${data?.id})`);

            // Log success to Supabase
            if (lead.leadId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
              const { createServiceClient } = await import('@/lib/supabase/server');
              const supabase = createServiceClient();
              await supabase.from('viceroy_email_sends').insert({
                lead_id: lead.leadId,
                email: lead.email,
                first_name: lead.firstName,
                sequence_step: step,
                subject: sequenceStep.subject,
                status: 'sent',
                resend_id: data?.id,
                sent_at: new Date().toISOString(),
              });

              // Update lead status to 'contacted'
              await supabase
                .from('viceroy_leads')
                .update({ status: 'contacted', contacted_at: new Date().toISOString() })
                .eq('id', lead.leadId)
                .eq('status', 'pending'); // Only update if still pending
            }
          }
        } catch (err) {
          results.failed++;
          results.errors.push(`${lead.email}: ${String(err)}`);
          console.error(`[Viceroy Email] Exception for ${lead.email}:`, err);
        }
      }),
    );

    // Small delay between batches
    if (i + batchSize < leads.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`[Viceroy Email] Complete: ${results.sent} sent, ${results.failed} failed`);

  return NextResponse.json({
    message: `Step ${step} complete: ${results.sent} sent, ${results.failed} failed`,
    sent: results.sent,
    failed: results.failed,
    total: leads.length,
    errors: results.errors.slice(0, 10), // cap error list
  });
}

/**
 * GET /api/viceroy/email
 * Campaign stats
 */
export async function GET(request: Request) {
  const authKey = request.headers.get('x-viceroy-key');
  if (authKey !== process.env.VICEROY_API_KEY && process.env.VICEROY_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  const { data: sends } = await supabase
    .from('viceroy_email_sends')
    .select('sequence_step, status');

  const stats = {
    total: sends?.length || 0,
    byStep: {} as Record<number, Record<string, number>>,
  };

  for (const row of sends || []) {
    if (!stats.byStep[row.sequence_step]) {
      stats.byStep[row.sequence_step] = { sent: 0, failed: 0, opened: 0, clicked: 0, replied: 0 };
    }
    stats.byStep[row.sequence_step][row.status] = (stats.byStep[row.sequence_step][row.status] || 0) + 1;
  }

  return NextResponse.json({ stats, sequence: VICEROY_SEQUENCE.map((s) => ({ step: s.step, subject: s.subject, delayDays: s.delayDays })) });
}
