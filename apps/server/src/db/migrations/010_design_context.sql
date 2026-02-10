-- Add design context column to codebase_contexts
-- Stores extracted design tokens, component patterns, and styling conventions
ALTER TABLE codebase_contexts ADD COLUMN design_context TEXT;
