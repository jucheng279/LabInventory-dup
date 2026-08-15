import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getResendFrom(): string {
  const fromEnv = Deno.env.get("RESEND_FROM_EMAIL");
  if (!fromEnv) return "LabTrack <onboarding@resend.dev>";
  if (fromEnv.includes("@")) return fromEnv;
  return `LabTrack <noreply@${fromEnv}>`;
}

interface Subscription {
  id: string;
  team_member_id: string;
  workspace_id: string;
  item_name: string;
  item_info: string;
  source: string;
  source_id: string;
  expiration_date: string;
  location_name: string | null;
  box_name: string | null;
  last_alert_sent_at: string | null;
}

interface NotificationPrefs {
  id: string;
  team_member_id: string;
  workspace_id: string;
  digest_enabled: boolean;
  digest_frequency: "weekly" | "monthly";
  digest_last_sent_at: string | null;
  alert_enabled: boolean;
  alert_days_before: number;
  alert_repeat_interval: number;
  alert_repeat_unit: "days" | "weeks" | "months";
}

interface TeamMemberRow {
  id: string;
  email: string;
  display_name: string | null;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured. Add it to your Edge Function secrets.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getResendFrom(),
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[RESEND] Failed to send to ${to}: ${res.status} ${body}`);
    let detail = `Email delivery failed (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.message) detail = parsed.message;
    } catch { /* use default */ }
    throw new Error(detail);
  }

  console.log(`[RESEND] Sent to ${to}: ${subject}`);
}

function getDaysUntil(expirationDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);
  return Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function getStatusColor(days: number): string {
  if (days < 0) return "#dc2626";
  if (days <= 7) return "#ea580c";
  if (days <= 30) return "#d97706";
  if (days <= 90) return "#ca8a04";
  return "#059669";
}

function shouldSendDigest(prefs: NotificationPrefs, now: Date): boolean {
  if (!prefs.digest_enabled) return false;
  if (!prefs.digest_last_sent_at) return true;

  const lastSent = new Date(prefs.digest_last_sent_at);
  const diffMs = now.getTime() - lastSent.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (prefs.digest_frequency === "weekly") return diffDays >= 7;
  if (prefs.digest_frequency === "monthly") return diffDays >= 30;
  return false;
}

function shouldSendAlert(sub: Subscription, prefs: NotificationPrefs, now: Date): boolean {
  if (!prefs.alert_enabled) return false;

  const days = getDaysUntil(sub.expiration_date);
  if (days > prefs.alert_days_before) return false;

  if (!sub.last_alert_sent_at) return true;

  const lastSent = new Date(sub.last_alert_sent_at);
  const diffMs = now.getTime() - lastSent.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  const interval = prefs.alert_repeat_interval;
  const unit = prefs.alert_repeat_unit;

  if (unit === "days") return diffDays >= interval;
  if (unit === "weeks") return diffDays >= interval * 7;
  if (unit === "months") return diffDays >= interval * 30;
  return false;
}

function buildDigestEmailHtml(
  displayName: string,
  subscriptions: Subscription[],
  frequency: string,
  isOnDemand: boolean
): string {
  const rows = subscriptions
    .sort((a, b) => getDaysUntil(a.expiration_date) - getDaysUntil(b.expiration_date))
    .map((sub) => {
      const days = getDaysUntil(sub.expiration_date);
      const color = getStatusColor(days);
      const status = getStatusLabel(days);
      const info = sub.item_info || "\u2014";
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;">${sub.item_name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${info}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${sub.expiration_date}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600;color:${color};">${status}</td>
        </tr>`;
    })
    .join("");

  const title = isOnDemand
    ? "Your Expiration Report"
    : `Your ${frequency === "weekly" ? "Weekly" : "Monthly"} Expiration Report`;

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;font-weight:600;color:#111827;margin-bottom:4px;">
        ${title}
      </h1>
      <p style="font-size:14px;color:#6b7280;margin-bottom:24px;">
        Hi ${displayName || "there"}, here is the status of your ${subscriptions.length} subscribed item${subscriptions.length !== 1 ? "s" : ""}:
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Item</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Info</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Expires</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">
        You are receiving this because you have expiration notifications enabled. Manage your subscriptions in the app.
      </p>
    </div>`;
}

function buildAlertEmailHtml(displayName: string, sub: Subscription): string {
  const days = getDaysUntil(sub.expiration_date);
  const color = getStatusColor(days);
  const status = getStatusLabel(days);
  const info = sub.item_info || "\u2014";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h1 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 8px 0;">
          Expiration Alert
        </h1>
        <p style="font-size:14px;color:#6b7280;margin:0;">
          Hi ${displayName || "there"}, an item you are tracking needs attention:
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;width:100px;">Item</td>
          <td style="padding:8px 0;font-size:14px;font-weight:500;color:#111827;">${sub.item_name}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Info</td>
          <td style="padding:8px 0;font-size:14px;color:#374151;">${info}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Expires</td>
          <td style="padding:8px 0;font-size:14px;color:#374151;">${sub.expiration_date}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Status</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;color:${color};">${status}</td>
        </tr>
      </table>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">
        To stop receiving alerts for this item, unsubscribe it in the app's Expiration section.
      </p>
    </div>`;
}

async function processOnDemandDigest(
  serviceClient: ReturnType<typeof createClient>,
  teamMemberId: string
): Promise<Response> {
  const now = new Date();

  const { data: prefs, error: prefsErr } = await serviceClient
    .from("expiration_notification_preferences")
    .select("*")
    .eq("team_member_id", teamMemberId)
    .maybeSingle();

  if (prefsErr) throw prefsErr;
  if (!prefs) {
    return new Response(
      JSON.stringify({ error: "No notification preferences found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: member } = await serviceClient
    .from("team_members")
    .select("id, email, display_name")
    .eq("id", teamMemberId)
    .maybeSingle();

  if (!member) {
    return new Response(
      JSON.stringify({ error: "Team member not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const tmRow = member as TeamMemberRow;

  const { data: subs } = await serviceClient
    .from("expiration_subscriptions")
    .select("*")
    .eq("team_member_id", teamMemberId);

  if (!subs || subs.length === 0) {
    return new Response(
      JSON.stringify({ error: "No subscribed items to report on" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const subscriptions = subs as Subscription[];
  const html = buildDigestEmailHtml(
    tmRow.display_name || tmRow.email.split("@")[0],
    subscriptions,
    (prefs as NotificationPrefs).digest_frequency,
    true
  );

  const subject = "Your Expiration Report";
  await sendEmail(tmRow.email, subject, html);

  await serviceClient
    .from("expiration_notification_preferences")
    .update({ digest_last_sent_at: now.toISOString() })
    .eq("id", prefs.id);

  return new Response(
    JSON.stringify({ message: "Digest report sent", digestsSent: 1 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON — proceed with scheduled flow
    }

    if (body.sendDigestNow === true && typeof body.teamMemberId === "string") {
      return await processOnDemandDigest(serviceClient, body.teamMemberId);
    }

    // --- Scheduled flow ---
    const now = new Date();
    let digestsSent = 0;
    let alertsSent = 0;

    const { data: allPrefs, error: prefsErr } = await serviceClient
      .from("expiration_notification_preferences")
      .select("*");

    if (prefsErr) throw prefsErr;
    if (!allPrefs || allPrefs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No notification preferences configured", digestsSent: 0, alertsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const prefs of allPrefs as NotificationPrefs[]) {
      const { data: member } = await serviceClient
        .from("team_members")
        .select("id, email, display_name")
        .eq("id", prefs.team_member_id)
        .maybeSingle();

      if (!member) continue;
      const tmRow = member as TeamMemberRow;

      const { data: subs } = await serviceClient
        .from("expiration_subscriptions")
        .select("*")
        .eq("team_member_id", prefs.team_member_id);

      if (!subs || subs.length === 0) continue;
      const subscriptions = subs as Subscription[];

      if (shouldSendDigest(prefs, now)) {
        const html = buildDigestEmailHtml(
          tmRow.display_name || tmRow.email.split("@")[0],
          subscriptions,
          prefs.digest_frequency,
          false
        );

        const subject = `Your ${prefs.digest_frequency === "weekly" ? "Weekly" : "Monthly"} Expiration Report`;

        try {
          await sendEmail(tmRow.email, subject, html);

          await serviceClient
            .from("expiration_notification_preferences")
            .update({ digest_last_sent_at: now.toISOString() })
            .eq("id", prefs.id);

          digestsSent++;
        } catch (e) {
          console.error(`[DIGEST] Failed for ${tmRow.email}: ${(e as Error).message}`);
        }
      }

      if (prefs.alert_enabled) {
        for (const sub of subscriptions) {
          if (shouldSendAlert(sub, prefs, now)) {
            const html = buildAlertEmailHtml(
              tmRow.display_name || tmRow.email.split("@")[0],
              sub
            );

            const days = getDaysUntil(sub.expiration_date);
            const subject =
              days < 0
                ? `[Expired] ${sub.item_name} has expired`
                : days === 0
                ? `[Today] ${sub.item_name} expires today`
                : `[Alert] ${sub.item_name} expires in ${days} days`;

            try {
              await sendEmail(tmRow.email, subject, html);

              await serviceClient
                .from("expiration_subscriptions")
                .update({ last_alert_sent_at: now.toISOString() })
                .eq("id", sub.id);

              alertsSent++;
            } catch (e) {
              console.error(`[ALERT] Failed for ${tmRow.email}: ${(e as Error).message}`);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Notification processing complete", digestsSent, alertsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
