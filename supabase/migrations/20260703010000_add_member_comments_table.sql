-- Migration: Create private_messages table for private 1-to-1 chats between leaders and members
CREATE TABLE IF NOT EXISTS public.private_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only read messages if they are the sender or the recipient
CREATE POLICY "Enable read access for participants" ON public.private_messages
    FOR SELECT TO authenticated
    USING (
        sender_id IN (SELECT id FROM public.people WHERE auth_user_id = auth.uid())
        OR recipient_id IN (SELECT id FROM public.people WHERE auth_user_id = auth.uid())
    );

-- Policies: Users can only insert messages if they are the sender
CREATE POLICY "Enable insert access for sender" ON public.private_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id IN (SELECT id FROM public.people WHERE auth_user_id = auth.uid())
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_private_messages_participants ON public.private_messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_created ON public.private_messages(created_at DESC);

-- Enable Supabase Realtime for private_messages table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'private_messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
        END IF;
    END IF;
END $$;
