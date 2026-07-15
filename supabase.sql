CREATE TABLE IF NOT EXISTS gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    caption TEXT,
    tags JSONB,
    comments JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- Policy: allow any authenticated user to INSERT rows
CREATE POLICY "Allow insert for authenticated users"
    ON gallery_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: allow any user to SELECT rows (public read)
CREATE POLICY "Allow select for all users"
    ON gallery_items FOR SELECT
    TO public
    USING (true);