-- Production-grade Academic Structure and Weekly Period Management schema (snake_case reference)
-- PostgreSQL dialect, multi-tenant by school_id

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS academic_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  min_class_order INT NOT NULL,
  max_class_order INT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  class_from INT NOT NULL DEFAULT 11,
  class_to INT NOT NULL DEFAULT 12,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS subjects_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  parent_subject_id UUID,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('core','optional','lab','activity')),
  is_lab BOOLEAN NOT NULL DEFAULT false,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, code),
  FOREIGN KEY (parent_subject_id) REFERENCES subjects_v2(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subject_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  subject_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  periods_per_week INT NOT NULL,
  is_lab BOOLEAN NOT NULL DEFAULT false,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, subject_id, code),
  FOREIGN KEY (subject_id) REFERENCES subjects_v2(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stream_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  stream_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  subject_component_id UUID,
  periods_per_week INT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects_v2(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_component_id) REFERENCES subject_components(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS class_subjects_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  section_id TEXT,
  stream_id UUID,
  subject_id UUID NOT NULL,
  periods_per_week INT NOT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects_v2(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  class_id TEXT,
  section_id TEXT,
  subject_id UUID NOT NULL,
  subject_component_id UUID,
  periods_per_week INT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (subject_id) REFERENCES subjects_v2(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_component_id) REFERENCES subject_components(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  capacity INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY')),
  period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 8),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_activity_period BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, day_of_week, period_number)
);

CREATE TABLE IF NOT EXISTS timetable_slots_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id TEXT NOT NULL,
  timetable_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  period_number INT NOT NULL,
  subject_id UUID,
  subject_component_id UUID,
  teacher_id TEXT,
  activity_id UUID,
  lab_room_id UUID,
  is_activity_period BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (subject_id) REFERENCES subjects_v2(id) ON DELETE SET NULL,
  FOREIGN KEY (subject_component_id) REFERENCES subject_components(id) ON DELETE SET NULL,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subjects_school_parent ON subjects_v2(school_id, parent_subject_id);
CREATE INDEX IF NOT EXISTS idx_stream_subjects_stream ON stream_subjects(stream_id, display_order);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(school_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_scope ON class_subjects_v2(school_id, class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slot_teacher ON timetable_slots_v2(school_id, teacher_id, day_of_week, period_number);
