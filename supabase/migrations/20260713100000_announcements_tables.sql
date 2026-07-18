-- Migration: Add Announcements and Reactions/Replies tables
-- 20260713100000_announcements_tables.sql

-- ── 1. Announcements table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.organizational_units(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    -- who should see this announcement
    -- 'all' | 'mc_heads' | 'buscenta_heads' | 'cell_shepherds' | 'cell_members'
    target_audience TEXT NOT NULL DEFAULT 'all',
    pinned BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_author ON public.announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_unit ON public.announcements(unit_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

-- ── 2. Emoji Reactions table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcement_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(announcement_id, person_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_announcement ON public.announcement_reactions(announcement_id);

-- ── 3. Replies table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcement_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replies_announcement ON public.announcement_replies(announcement_id);

-- ── 4. Row Level Security ──────────────────────────────────────────────────
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_replies ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all announcements
CREATE POLICY "announcements_select" ON public.announcements
    FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert announcements (auth checked in frontend/RPC)
CREATE POLICY "announcements_insert" ON public.announcements
    FOR INSERT TO authenticated WITH CHECK (true);

-- Authors can delete their own announcements
CREATE POLICY "announcements_delete" ON public.announcements
    FOR DELETE TO authenticated
    USING (
        author_id IN (
            SELECT id FROM public.people WHERE auth_user_id = auth.uid()
        )
    );

-- Authors can update/pin their own
CREATE POLICY "announcements_update" ON public.announcements
    FOR UPDATE TO authenticated
    USING (
        author_id IN (
            SELECT id FROM public.people WHERE auth_user_id = auth.uid()
        )
    );

-- Reactions: anyone authenticated can manage their own reactions
CREATE POLICY "reactions_all" ON public.announcement_reactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Replies: anyone authenticated can read/write
CREATE POLICY "replies_select" ON public.announcement_replies
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "replies_insert" ON public.announcement_replies
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "replies_delete" ON public.announcement_replies
    FOR DELETE TO authenticated
    USING (
        author_id IN (
            SELECT id FROM public.people WHERE auth_user_id = auth.uid()
        )
    );

-- ── 5. Enable Realtime ─────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_replies;
