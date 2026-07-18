import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'churchone_last_messages_read';

export function useUnreadMessages() {
    const { userRole } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const getLastRead = useCallback(() => {
        return localStorage.getItem(STORAGE_KEY) || new Date(0).toISOString();
    }, []);

    const markAsRead = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        setUnreadCount(0);
    }, []);

    const fetchUnread = useCallback(async () => {
        if (!userRole?.personId) return;
        const lastRead = getLastRead();

        try {
            const { count, error } = await supabase
                .from('private_messages')
                .select('*', { count: 'exact', head: true })
                .eq('recipient_id', userRole.personId)
                .gt('created_at', lastRead);

            console.log('[UnreadBadge] fetchUnread:', { personId: userRole.personId, count, lastRead, error });

            if (!error) {
                setUnreadCount(count ?? 0);
            }
        } catch (err) {
            // silent
        }
    }, [userRole?.personId, getLastRead]);

    // Initial fetch + polling every 8 seconds
    useEffect(() => {
        if (!userRole?.personId) return;
        fetchUnread();
        const interval = setInterval(fetchUnread, 8000);
        return () => clearInterval(interval);
    }, [userRole?.personId, fetchUnread]);

    // Real-time listener
    useEffect(() => {
        if (!userRole?.personId) return;
        const ch = supabase
            .channel(`unread-badge-${userRole.personId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'private_messages',
            }, (payload) => {
                if (payload.new?.recipient_id === userRole.personId) {
                    setUnreadCount(prev => prev + 1);
                }
            })
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [userRole?.personId]);

    return { unreadCount, markAsRead };
}
