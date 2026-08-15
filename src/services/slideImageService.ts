import { supabase } from '../lib/supabase';

const BUCKET = 'slide-images';
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export const slideImageService = {
  async uploadImage(boxId: string, cellId: string, file: File): Promise<string> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 15MB limit');
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${boxId}/${cellId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true });

    if (error) {
      console.error('Error uploading slide image:', error);
      throw error;
    }

    return path;
  },

  async deleteImage(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (error) {
      console.error('Error deleting slide image:', error);
      throw error;
    }
  },

  getPublicUrl(path: string): string {
    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return data.publicUrl;
  },
};
