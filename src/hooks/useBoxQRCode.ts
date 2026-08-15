import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qrCodeService } from '../services/qrCodeService';

export function useBoxQRCode(boxId: string) {
  return useQuery({
    queryKey: ['boxQRCode', boxId],
    queryFn: () => qrCodeService.getForBox(boxId),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useCreateQRCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { boxId: string; workspaceId: string; createdBy: string; label?: string }) =>
      qrCodeService.create(params.boxId, params.workspaceId, params.createdBy, params.label),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(['boxQRCode', vars.boxId], data);
    },
  });
}

export function useRevokeQRCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (boxId: string) => qrCodeService.revoke(boxId),
    onSuccess: (_data, boxId) => {
      queryClient.invalidateQueries({ queryKey: ['boxQRCode', boxId] });
    },
  });
}

export function useRegenerateQRCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { boxId: string; workspaceId: string; createdBy: string; label?: string }) =>
      qrCodeService.regenerate(params.boxId, params.workspaceId, params.createdBy, params.label),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(['boxQRCode', vars.boxId], data);
    },
  });
}
