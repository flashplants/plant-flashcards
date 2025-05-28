-- Create flashcard_answers table
CREATE TABLE IF NOT EXISTS flashcard_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE flashcard_answers ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own answers
CREATE POLICY "Users can insert their own answers"
    ON flashcard_answers
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own answers
CREATE POLICY "Users can view their own answers"
    ON flashcard_answers
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX flashcard_answers_user_id_idx ON flashcard_answers(user_id);
CREATE INDEX flashcard_answers_plant_id_idx ON flashcard_answers(plant_id);
CREATE INDEX flashcard_answers_session_id_idx ON flashcard_answers(session_id);
CREATE INDEX flashcard_answers_answered_at_idx ON flashcard_answers(answered_at);

-- Create a function to get plants that need more practice
CREATE OR REPLACE FUNCTION get_plants_needing_practice(
    user_uuid UUID,
    min_attempts INTEGER DEFAULT 3,
    success_threshold NUMERIC DEFAULT 70.0,
    days_ago INTEGER DEFAULT 30
)
RETURNS TABLE (
    plant_id INTEGER,
    total_attempts BIGINT,
    success_rate NUMERIC,
    last_attempted TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH plant_stats AS (
        SELECT 
            fa.plant_id,
            COUNT(*) as total_attempts,
            (COUNT(*) FILTER (WHERE fa.is_correct)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 as success_rate,
            MAX(fa.answered_at) as last_attempted
        FROM flashcard_answers fa
        WHERE 
            fa.user_id = user_uuid
            AND fa.answered_at >= NOW() - (days_ago || ' days')::INTERVAL
        GROUP BY fa.plant_id
    )
    SELECT 
        ps.plant_id,
        ps.total_attempts,
        COALESCE(ps.success_rate, 0) as success_rate,
        ps.last_attempted
    FROM plant_stats ps
    WHERE 
        (ps.total_attempts >= min_attempts AND COALESCE(ps.success_rate, 0) < success_threshold)
        OR (ps.total_attempts < min_attempts)
    ORDER BY 
        CASE 
            WHEN ps.total_attempts < min_attempts THEN 1
            ELSE 2
        END,
        COALESCE(ps.success_rate, 0) ASC,
        COALESCE(ps.last_attempted, NOW()) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get incorrect answers for a user
CREATE OR REPLACE FUNCTION get_incorrect_answers(user_uuid UUID, days_ago INTEGER DEFAULT 7)
RETURNS TABLE (
    plant_id INTEGER,
    incorrect_count BIGINT,
    total_attempts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fa.plant_id,
        COUNT(*) FILTER (WHERE NOT fa.is_correct) as incorrect_count,
        COUNT(*) as total_attempts
    FROM flashcard_answers fa
    WHERE 
        fa.user_id = user_uuid
        AND fa.answered_at >= NOW() - (days_ago || ' days')::INTERVAL
    GROUP BY fa.plant_id
    HAVING COUNT(*) FILTER (WHERE NOT fa.is_correct) > 0
    ORDER BY incorrect_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get plant performance statistics
CREATE OR REPLACE FUNCTION get_plant_performance_stats(user_uuid UUID, days_ago INTEGER DEFAULT 30)
RETURNS TABLE (
    plant_id INTEGER,
    total_attempts BIGINT,
    correct_attempts BIGINT,
    incorrect_attempts BIGINT,
    success_rate NUMERIC,
    last_attempted TIMESTAMP WITH TIME ZONE,
    first_attempted TIMESTAMP WITH TIME ZONE,
    recent_success_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH plant_stats AS (
        SELECT 
            fa.plant_id,
            COUNT(*) as total_attempts,
            COUNT(*) FILTER (WHERE fa.is_correct) as correct_attempts,
            COUNT(*) FILTER (WHERE NOT fa.is_correct) as incorrect_attempts,
            MAX(fa.answered_at) as last_attempted,
            MIN(fa.answered_at) as first_attempted
        FROM flashcard_answers fa
        WHERE 
            fa.user_id = user_uuid
            AND fa.answered_at >= NOW() - (days_ago || ' days')::INTERVAL
        GROUP BY fa.plant_id
    ),
    recent_stats AS (
        SELECT 
            fa.plant_id,
            COUNT(*) FILTER (WHERE fa.is_correct)::NUMERIC / NULLIF(COUNT(*), 0) as recent_success_rate
        FROM flashcard_answers fa
        WHERE 
            fa.user_id = user_uuid
            AND fa.answered_at >= NOW() - (days_ago || ' days')::INTERVAL
        GROUP BY fa.plant_id
    )
    SELECT 
        ps.plant_id,
        ps.total_attempts,
        ps.correct_attempts,
        ps.incorrect_attempts,
        (ps.correct_attempts::NUMERIC / NULLIF(ps.total_attempts, 0)) * 100 as success_rate,
        ps.last_attempted,
        ps.first_attempted,
        rs.recent_success_rate * 100 as recent_success_rate
    FROM plant_stats ps
    LEFT JOIN recent_stats rs ON ps.plant_id = rs.plant_id
    ORDER BY ps.total_attempts DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 