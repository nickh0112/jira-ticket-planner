-- Add jira_status column to store the real Jira status string
-- (e.g., "In Progress", "Code Review", "To Do")
-- Separate from the internal `status` column which uses a constrained enum
ALTER TABLE tickets ADD COLUMN jira_status TEXT;
