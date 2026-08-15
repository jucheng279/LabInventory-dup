import { supabase } from '../lib/supabase';
import type { BoxQRCode, ResolvedQRToken } from '../types/database';

function generateToken(): string {
  const array = new Uint8Array(9);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

export const qrCodeService = {
  async getForBox(boxId: string): Promise<BoxQRCode | null> {
    const { data, error } = await supabase
      .from('box_qr_codes')
      .select('*')
      .eq('box_id', boxId)
      .is('revoked_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(boxId: string, workspaceId: string, createdBy: string, label?: string): Promise<BoxQRCode> {
    // Remove any lingering row (revoked or otherwise) to avoid UNIQUE constraint violation
    await supabase
      .from('box_qr_codes')
      .delete()
      .eq('box_id', boxId);

    const token = generateToken();
    const { data, error } = await supabase
      .from('box_qr_codes')
      .insert({
        box_id: boxId,
        workspace_id: workspaceId,
        token,
        label: label || null,
        created_by: createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async revoke(boxId: string): Promise<void> {
    const { error } = await supabase
      .from('box_qr_codes')
      .delete()
      .eq('box_id', boxId);
    if (error) throw error;
  },

  async regenerate(boxId: string, workspaceId: string, createdBy: string, label?: string): Promise<BoxQRCode> {
    return this.create(boxId, workspaceId, createdBy, label);
  },

  async resolveToken(token: string): Promise<ResolvedQRToken | null> {
    const { data, error } = await supabase.rpc('resolve_qr_token', { p_token: token });
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data[0] as ResolvedQRToken;
  },

  buildDeepLinkUrl(token: string): string {
    const base = import.meta.env.VITE_APP_URL || window.location.origin;
    return `${base}?qr=${token}`;
  },
};
