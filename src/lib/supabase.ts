import { createClient } from '@supabase/supabase-js';
import type { TutorialSupabaseMock } from '../tutorial/tutorialSupabaseMock';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let tutorialMock: TutorialSupabaseMock | null = null;

export function setTutorialMock(mock: TutorialSupabaseMock) {
  tutorialMock = mock;
}

export function clearTutorialMock() {
  tutorialMock = null;
}

export function getClient(): any {
  return tutorialMock ?? supabase;
}
