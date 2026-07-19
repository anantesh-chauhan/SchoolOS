import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { communicationService } from '../services/communicationService';

export const communicationKeys = { all: ['communication'], notifications: (filters) => ['communication','notifications',filters], conversations: ['communication','conversations'] };
export const useNotifications = (filters = {}) => useQuery({ queryKey: communicationKeys.notifications(filters), queryFn: () => communicationService.notifications(filters), refetchInterval: 60000 });
export const useUnreadCount = () => useQuery({ queryKey: ['communication','unread'], queryFn: communicationService.unreadCount, refetchInterval: 60000 });
export const useConversations = () => useQuery({ queryKey: communicationKeys.conversations, queryFn: communicationService.conversations, refetchInterval: 30000 });
export const useMarkNotification = () => { const client=useQueryClient(); return useMutation({ mutationFn:({id,action,note})=>action==='acknowledge'?communicationService.acknowledge(id,note):action==='archive'?communicationService.archive(id):communicationService.read(id), onSuccess:()=>client.invalidateQueries({queryKey:communicationKeys.all}) }); };
