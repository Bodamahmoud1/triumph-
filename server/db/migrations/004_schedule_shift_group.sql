-- Preserve roster section (Morning / Evening / Night) per employee row
ALTER TABLE schedule_shifts ADD COLUMN shift_group TEXT;
