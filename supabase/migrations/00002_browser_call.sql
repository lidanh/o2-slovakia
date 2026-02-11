-- Browser call support: add call_type, OTP fields to training_sessions
ALTER TABLE training_sessions
  ADD COLUMN call_type TEXT NOT NULL DEFAULT 'phone' CHECK (call_type IN ('phone', 'browser')),
  ADD COLUMN otp TEXT,
  ADD COLUMN otp_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_sessions_otp ON training_sessions(otp) WHERE otp IS NOT NULL;
