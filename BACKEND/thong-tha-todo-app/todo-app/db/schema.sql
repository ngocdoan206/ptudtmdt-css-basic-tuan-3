-- Thong Thả – cấu trúc cơ sở dữ liệu (SQLite)

-- Bảng công việc chính
CREATE TABLE IF NOT EXISTS tasks (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  title                 TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  note                  TEXT,
  due_date              TEXT,                         -- 'YYYY-MM-DD' theo giờ Việt Nam
  due_time              TEXT,                         -- 'HH:MM'
  priority              TEXT    NOT NULL DEFAULT 'vua' CHECK (priority IN ('thap','vua','cao')),
  tag                   TEXT,
  energy                TEXT    NOT NULL DEFAULT 'nang' CHECK (energy IN ('nhe','nang')),
  estimate_min          INTEGER,
  actual_min            INTEGER NOT NULL DEFAULT 0,
  status                TEXT    NOT NULL DEFAULT 'todo'
                        CHECK (status IN ('todo','done','let_go','unconfirmed','archived')),
  lane                  TEXT    NOT NULL DEFAULT 'chinh' CHECK (lane IN ('chinh','neu_con_suc')),
  if_then_plan          TEXT,
  friction_reason       TEXT    CHECK (friction_reason IN ('qua_lon','chua_ro','khong_quan_trong') OR friction_reason IS NULL),
  postpone_count        INTEGER NOT NULL DEFAULT 0,
  recurrence            TEXT    NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','after_n_days')),
  recur_n               INTEGER,
  reserve_days_per_week INTEGER NOT NULL DEFAULT 2,
  series_id             INTEGER,                      -- nhóm các lần lặp của cùng một việc
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL,
  completed_at          TEXT,
  done_date             TEXT,                         -- ngày thực sự làm xong (cho phép đánh dấu bù)
  deleted_at            TEXT                          -- xoá mềm để hoàn tác
);
CREATE INDEX IF NOT EXISTS idx_tasks_due    ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Bước nhỏ của một việc
CREATE TABLE IF NOT EXISTS subtasks (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title   TEXT    NOT NULL,
  done    INTEGER NOT NULL DEFAULT 0
);

-- Check-in mỗi sáng: tâm trạng, năng lượng, giờ trống
CREATE TABLE IF NOT EXISTS daily_checkins (
  date          TEXT PRIMARY KEY,
  mood          INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy        TEXT    NOT NULL CHECK (energy IN ('thap','vua','cao')),
  available_min INTEGER,
  created_at    TEXT    NOT NULL
);

-- Nhật ký hành vi: mọi lần đổi trạng thái đều ghi lại để phân tích
CREATE TABLE IF NOT EXISTS task_events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  type    TEXT    NOT NULL CHECK (type IN ('created','started','done','postponed','let_go','restored','marked_late_done','archived','unconfirmed','deleted')),
  at      TEXT    NOT NULL,
  meta    TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id);

-- Phiên tập trung (bấm Bắt đầu / Xong) – ghi thời gian thực tế không cần nhập tay
CREATE TABLE IF NOT EXISTS focus_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at TEXT    NOT NULL,
  ended_at   TEXT,
  minutes    INTEGER
);

-- Cài đặt dạng key/value
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
