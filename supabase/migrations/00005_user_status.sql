-- Add user status tracking for invite flow
CREATE TYPE user_status AS ENUM ('invited', 'active');

ALTER TABLE users ADD COLUMN status user_status NOT NULL DEFAULT 'invited';

-- Mark all existing users as active (they already have passwords set)
UPDATE users SET status = 'active';
