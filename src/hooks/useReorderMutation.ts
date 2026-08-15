import { useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';

interface UseReorderMutationOptions<T extends { id: string }> {
  queryKey: QueryKey;
  mutationFn: (ids: string[]) => Promise<unknown>;
  additionalInvalidations?: QueryKey[];
}

export function useReorderMutation<T extends { id: string }>({
  queryKey,
  mutationFn,
  additionalInvalidations,
}: UseReorderMutationOptions<T>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => mutationFn(ids),
    onMutate: async (newOrder: string[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<T[]>(queryKey);

      if (previousData) {
        const reordered = newOrder
          .map((id) => previousData.find((item) => item.id === id))
          .filter((item): item is T => item !== undefined)
          .map((item, index) => ({ ...item, display_order: index }));

        queryClient.setQueryData(queryKey, reordered);
      }

      return { previousData };
    },
    onError: (_err: unknown, _vars: string[], context: { previousData?: T[] } | undefined) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      if (additionalInvalidations) {
        for (const key of additionalInvalidations) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });
}
