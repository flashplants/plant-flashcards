-- Create study_sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    studied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own study sessions
CREATE POLICY "Users can insert their own study sessions"
    ON study_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own study sessions
CREATE POLICY "Users can view their own study sessions"
    ON study_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX study_sessions_user_id_idx ON study_sessions(user_id);
CREATE INDEX study_sessions_plant_id_idx ON study_sessions(plant_id); 