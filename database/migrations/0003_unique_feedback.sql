CREATE UNIQUE INDEX IF NOT EXISTS feedback_user_message
  ON preference_feedback(user_key, message_key);
