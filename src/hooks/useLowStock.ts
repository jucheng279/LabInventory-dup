import { useQuery } from '@tanstack/react-query';
import { getLowStockItems, LowStockSeverity } from '../services/lowStockService';
import { useAuth } from '../contexts/AuthContext';

export const LOW_STOCK_QUERY_KEY = ['lowStock'];

export function useLowStock() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id ?? '';

  return useQuery({
    queryKey: [...LOW_STOCK_QUERY_KEY, workspaceId],
    queryFn: () => getLowStockItems(workspaceId),
    enabled: !!workspaceId,
    staleTime: 0,
  });
}

export function useLowStockStats() {
  const { data = [], isLoading } = useLowStock();

  const counts: Record<LowStockSeverity, number> = { out: 0, critical: 0, low: 0 };
  for (const record of data) {
    counts[record.severity] += 1;
  }

  return {
    counts,
    total: data.length,
    isLoading,
  };
}
