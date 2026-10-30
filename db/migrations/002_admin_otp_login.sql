ALTER TABLE users ADD COLUMN username TEXT;

CREATE UNIQUE INDEX users_username_lower_idx
  ON users (LOWER(username))
  WHERE username IS NOT NULL;

CREATE TABLE admin_login_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_login_challenges_user_idx
  ON admin_login_challenges (user_id, created_at DESC);
