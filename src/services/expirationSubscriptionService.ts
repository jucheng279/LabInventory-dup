import { supabase } from '../lib/supabase';

export interface ExpirationSubscription {
  id: string;
  team_member_id: string;
  workspace_id: string;
  item_name: string;
  item_info: string;
  source: 'cell' | 'slide' | 'item';
  source_id: string;
  expiration_date: string;
  location_name: string | null;
  box_name: string | null;
  last_alert_sent_at: string | null;
  created_at: string;
}

export interface CreateSubscriptionInput {
  team_member_id: string;
  workspace_id: string;
  item_name: string;
  item_info: string;
  source: 'cell' | 'slide' | 'item';
  source_id: string;
  expiration_date: string;
  location_name?: string | null;
  box_name?: string | null;
}

export function makeSubscriptionKey(name: string, info: string, date: string): string {
  return `${name.trim()}|||${(info || '').trim()}|||${date}`;
}

export async function getSubscriptions(teamMemberId: string): Promise<ExpirationSubscription[]> {
  const { data, error } = await supabase
    .from('expiration_subscriptions')
    .select('*')
    .eq('team_member_id', teamMemberId)
    .order('expiration_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ExpirationSubscription[];
}

export async function addSubscription(input: CreateSubscriptionInput): Promise<ExpirationSubscription> {
  const { data, error } = await supabase
    .from('expiration_subscriptions')
    .upsert(
      {
        team_member_id: input.team_member_id,
        workspace_id: input.workspace_id,
        item_name: input.item_name,
        item_info: input.item_info || '',
        source: input.source,
        source_id: input.source_id,
        expiration_date: input.expiration_date,
        location_name: input.location_name ?? null,
        box_name: input.box_name ?? null,
      },
      { onConflict: 'team_member_id,item_name,item_info,expiration_date' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as ExpirationSubscription;
}

export async function removeSubscription(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('expiration_subscriptions')
    .delete()
    .eq('id', subscriptionId);

  if (error) throw error;
}

export async function removeSubscriptionByKey(
  teamMemberId: string,
  itemName: string,
  itemInfo: string,
  expirationDate: string,
): Promise<void> {
  const { error } = await supabase
    .from('expiration_subscriptions')
    .delete()
    .eq('team_member_id', teamMemberId)
    .eq('item_name', itemName)
    .eq('item_info', itemInfo || '')
    .eq('expiration_date', expirationDate);

  if (error) throw error;
}

export async function removeSubscriptionBySourceId(teamMemberId: string, sourceId: string): Promise<void> {
  const { error } = await supabase
    .from('expiration_subscriptions')
    .delete()
    .eq('team_member_id', teamMemberId)
    .eq('source_id', sourceId);

  if (error) throw error;
}

export async function removeStaleSubscriptions(
  teamMemberId: string,
  subscriptions: ExpirationSubscription[],
  liveKeys: Set<string>,
): Promise<string[]> {
  const staleIds: string[] = [];
  for (const sub of subscriptions) {
    const key = makeSubscriptionKey(sub.item_name, sub.item_info, sub.expiration_date);
    if (!liveKeys.has(key)) {
      staleIds.push(sub.id);
    }
  }
  if (staleIds.length === 0) return [];

  const { error } = await supabase
    .from('expiration_subscriptions')
    .delete()
    .in('id', staleIds);

  if (error) throw error;
  return staleIds;
}
