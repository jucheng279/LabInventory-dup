import { supabase } from '../lib/supabase';

let cachedToken: string | null = null;
let fetchInFlight: Promise<string> | null = null;

async function requestToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-stt-token`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Token request failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.token || typeof data.token !== 'string') {
    throw new Error('Invalid token response');
  }

  return data.token;
}

export function prefetchScribeToken(): void {
  if (cachedToken || fetchInFlight) return;
  fetchInFlight = requestToken()
    .then((token) => {
      cachedToken = token;
      fetchInFlight = null;
      return token;
    })
    .catch(() => {
      fetchInFlight = null;
      return '';
    });
}

export async function fetchScribeToken(): Promise<string> {
  if (cachedToken) {
    const token = cachedToken;
    cachedToken = null;
    return token;
  }

  if (fetchInFlight) {
    const token = await fetchInFlight;
    cachedToken = null;
    fetchInFlight = null;
    if (token) return token;
  }

  return requestToken();
}

export function refillTokenCache(): void {
  cachedToken = null;
  fetchInFlight = null;
  prefetchScribeToken();
}
