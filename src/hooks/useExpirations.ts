import { useQuery } from '@tanstack/react-query';
import { getAllExpirations, getDaysUntil, getUrgency, UrgencyBucket } from '../services/expirationService';
import { useAuth } from '../contexts/AuthContext';

export const EXPIRATIONS_QUERY_KEY = ['expirations'];

export function useExpirations() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id ?? '';

  return useQuery({
    queryKey: [...EXPIRATIONS_QUERY_KEY, workspaceId],
    queryFn: () => getAllExpirations(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useExpirationStats() {
  const { data = [], isLoading } = useExpirations();

  const counts: Record<UrgencyBucket, number> = {
    expired: 0,
    week: 0,
    month: 0,
    quarter: 0,
    later: 0,
  };

  for (const record of data) {
    const days = getDaysUntil(record.expirationDate);
    counts[getUrgency(days)] += 1;
  }

  return {
    counts,
    total: data.length,
    isLoading,
    upcomingSoon: data.slice(0, 5),
  };
}
