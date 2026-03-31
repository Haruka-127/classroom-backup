CREATE TABLE IF NOT EXISTS accounts (
  account_key TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  course_id TEXT PRIMARY KEY,
  name TEXT,
  section TEXT,
  description_heading TEXT,
  description TEXT,
  room TEXT,
  owner_id TEXT,
  course_state TEXT,
  alternate_link TEXT,
  creation_time TEXT,
  update_time TEXT,
  raw_json TEXT NOT NULL,
  last_seen_run_id TEXT,
  visibility_status TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  course_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  name TEXT,
  update_time TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, topic_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  course_id TEXT NOT NULL,
  announcement_id TEXT NOT NULL,
  text TEXT,
  state TEXT,
  alternate_link TEXT,
  creation_time TEXT,
  update_time TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, announcement_id)
);

CREATE TABLE IF NOT EXISTS course_work (
  course_id TEXT NOT NULL,
  course_work_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  work_type TEXT,
  state TEXT,
  alternate_link TEXT,
  topic_id TEXT,
  update_time TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, course_work_id)
);

CREATE TABLE IF NOT EXISTS course_work_materials (
  course_id TEXT NOT NULL,
  course_work_material_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  state TEXT,
  alternate_link TEXT,
  topic_id TEXT,
  update_time TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, course_work_material_id)
);

CREATE TABLE IF NOT EXISTS student_submissions (
  course_id TEXT NOT NULL,
  course_work_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  user_id TEXT,
  state TEXT,
  late INTEGER,
  course_work_type TEXT,
  associated_with_developer INTEGER,
  creation_time TEXT,
  update_time TEXT,
  short_answer TEXT,
  multiple_choice_answer TEXT,
  assigned_grade REAL,
  draft_grade REAL,
  alternate_link TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, course_work_id, submission_id)
);

CREATE TABLE IF NOT EXISTS drive_file_refs (
  ref_id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  announcement_id TEXT,
  course_work_id TEXT,
  course_work_material_id TEXT,
  submission_id TEXT,
  source_type TEXT NOT NULL,
  attachment_type TEXT NOT NULL,
  drive_file_id TEXT,
  template_drive_file_id TEXT,
  submission_drive_file_id TEXT,
  share_mode TEXT,
  materialization_state TEXT NOT NULL,
  link_url TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_files (
  drive_file_id TEXT PRIMARY KEY,
  name TEXT,
  mime_type TEXT,
  md5_checksum TEXT,
  size TEXT,
  modified_time TEXT,
  version TEXT,
  trashed INTEGER,
  web_view_link TEXT,
  export_links_json TEXT,
  raw_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drive_file_artifacts (
  artifact_id INTEGER PRIMARY KEY AUTOINCREMENT,
  drive_file_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  output_mime_type TEXT NOT NULL DEFAULT '',
  download_name TEXT NOT NULL,
  status TEXT NOT NULL,
  blob_id TEXT,
  size_bytes INTEGER,
  checksum_type TEXT,
  checksum_value TEXT,
  source_modified_time TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(drive_file_id, artifact_kind, output_mime_type)
);

CREATE TABLE IF NOT EXISTS artifact_blobs (
  blob_id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL,
  content BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drive_comments (
  drive_file_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  content TEXT,
  author_display_name TEXT,
  created_time TEXT,
  modified_time TEXT,
  resolved INTEGER,
  deleted INTEGER,
  quoted_file_content_value TEXT,
  replies_json TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (drive_file_id, comment_id)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  run_id TEXT PRIMARY KEY,
  account_key TEXT NOT NULL,
  mode TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  drive_start_page_token_candidate TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  summary_json TEXT
);

CREATE TABLE IF NOT EXISTS sync_status_records (
  status_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_checkpoints (
  account_key TEXT PRIMARY KEY,
  committed_start_page_token TEXT,
  last_successful_run_id TEXT,
  last_classroom_sync_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS failures (
  failure_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  status TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_aliases (
  course_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, alias)
);

CREATE TABLE IF NOT EXISTS course_grading_period_settings (
  course_id TEXT PRIMARY KEY,
  raw_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rubrics (
  course_id TEXT NOT NULL,
  course_work_id TEXT NOT NULL,
  rubric_id TEXT NOT NULL,
  title TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, course_work_id, rubric_id)
);

CREATE TABLE IF NOT EXISTS students (
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  profile_name TEXT,
  profile_photo_url TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS teachers (
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  profile_name TEXT,
  profile_photo_url TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  photo_url TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invitations (
  invitation_id TEXT PRIMARY KEY,
  course_id TEXT,
  user_id TEXT,
  role TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_groups (
  course_id TEXT NOT NULL,
  student_group_id TEXT NOT NULL,
  title TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, student_group_id)
);

CREATE TABLE IF NOT EXISTS student_group_members (
  course_id TEXT NOT NULL,
  student_group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (course_id, student_group_id, user_id)
);

CREATE TABLE IF NOT EXISTS guardians (
  student_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  guardian_name TEXT,
  invited_email_address TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (student_id, guardian_id)
);

CREATE TABLE IF NOT EXISTS guardian_invitations (
  student_id TEXT NOT NULL,
  invitation_id TEXT NOT NULL,
  invited_email_address TEXT,
  state TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (student_id, invitation_id)
);

CREATE INDEX IF NOT EXISTS idx_course_aliases_course_id ON course_aliases(course_id);
CREATE INDEX IF NOT EXISTS idx_rubrics_course_work ON rubrics(course_id, course_work_id);
CREATE INDEX IF NOT EXISTS idx_students_course_id ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_teachers_course_id ON teachers(course_id);
CREATE INDEX IF NOT EXISTS idx_invitations_course_id ON invitations(course_id);
CREATE INDEX IF NOT EXISTS idx_student_groups_course_id ON student_groups(course_id);
CREATE INDEX IF NOT EXISTS idx_student_group_members_group ON student_group_members(course_id, student_group_id);
CREATE INDEX IF NOT EXISTS idx_guardians_student_id ON guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_student_id ON guardian_invitations(student_id);
CREATE INDEX IF NOT EXISTS idx_drive_file_artifacts_drive_file_id ON drive_file_artifacts(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_file_artifacts_blob_id ON drive_file_artifacts(blob_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_records_run_id ON sync_status_records(run_id, status_id);
