import { supabase } from '../lib/supabase';

export interface ExpirationNotificationPreferences {
  id: string;
  team_member_id: string;
  workspace_id: string;
  digest_enabled: boolean;
  digest_frequency: 'weekly' | 'monthly';
  digest_last_sent_at: string | null;
  alert_enabled: boolean;
  alert_days_before: number;
  alert_repeat_interval: number;
  alert_repeat_unit: 'days' | 'weeks' | 'months';
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPrefsInput {
  digest_enabled?: boolean;
  digest_frequency?: 'weekly' | 'monthly';
  alert_enabled?: boolean;
  alert_days_before?: number;
  alert_repeat_interval?: number;
  alert_repeat_unit?: 'days' | 'weeks' | 'months';
}

export async function getNotificationPreferences(
  teamMemberId: string
): Promise<ExpirationNotificationPreferences | null> {
  const { data, error } = await supabase
    .from('expiration_notification_preferences')
    .select('*')
    .eq('team_member_id', teamMemberId)
    .maybeSingle();

  if (error) throw error;
  return data as ExpirationNotificationPreferences | null;
}

export async function sendDigestNow(teamMemberId: string): Promise<void> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/expiration-notifications`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sendDigestNow: true, teamMemberId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
}

export async function upsertNotificationPreferences(
  teamMemberId: string,
  workspaceId: string,
  updates: UpdateNotificationPrefsInput
): Promise<ExpirationNotificationPreferences> {
  const { data, error } = await supabase
    .from('expiration_notification_preferences')
    .upsert(
      {
        team_member_id: teamMemberId,
        workspace_id: workspaceId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_member_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as ExpirationNotificationPreferences;
}
