import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { communicationService } from '../services/communicationService';
import { queryKeys, workspaceQueryKey } from '../lib/queryClient';

export const communicationKeys = { all: workspaceQueryKey('communication'), notifications: queryKeys.notifications, conversations: queryKeys.conversations };
export const useNotifications = (filters = {}) => useQuery({ queryKey: communicationKeys.notifications(filters), queryFn: ({ signal }) => communicationService.notifications(filters, signal), staleTime: 10_000, refetchInterval: 60000 });
export const useUnreadCount = () => useQuery({ queryKey: queryKeys.unreadNotifications(), queryFn: ({ signal }) => communicationService.unreadCount(signal), staleTime: 10_000, refetchInterval: 60000 });
export const useConversations = (filters = {}) => useQuery({ queryKey: communicationKeys.conversations(filters), queryFn: ({ signal }) => communicationService.conversations(filters, signal), staleTime: 15_000, refetchInterval: 30000 });
export const useMarkNotification = () => { const client=useQueryClient(); return useMutation({ mutationFn:({id,action,note})=>action==='acknowledge'?communicationService.acknowledge(id,note):action==='archive'?communicationService.archive(id):communicationService.read(id), onSuccess:()=>client.invalidateQueries({queryKey:communicationKeys.all}) }); };
