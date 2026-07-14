import type Database from 'better-sqlite3'

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table) as { name?: string } | undefined
  return Boolean(row?.name)
}

function addColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

function runAdminSectionMigration(db: Database.Database): void {
  if (!tableExists(db, 'admin_section_posts')) return
  try {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      DROP TABLE IF EXISTS admin_section_posts_migration;
      CREATE TABLE admin_section_posts_migration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section TEXT NOT NULL CHECK(section IN ('accounts', 'tracking', 'students', 'social-economic')),
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        file_url TEXT,
        file_name TEXT,
        file_type TEXT,
        file_size INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      INSERT INTO admin_section_posts_migration (id, section, user_id, content, category, file_url, file_name, file_type, file_size, created_at)
      SELECT id, CASE WHEN section IN ('national-humanitarian', 'civilizational') THEN 'social-economic' ELSE section END AS section, user_id, content, category, file_url, file_name, file_type, file_size, created_at
      FROM admin_section_posts
      WHERE section IN ('accounts', 'tracking', 'students', 'national-humanitarian', 'civilizational', 'social-economic');
      DROP TABLE admin_section_posts;
      ALTER TABLE admin_section_posts_migration RENAME TO admin_section_posts;
      PRAGMA foreign_keys=ON;
    `)
  } catch {
    db.exec('DROP TABLE IF EXISTS admin_section_posts_migration;')
  }
}

function runExerciseDomainMigration(db: Database.Database): void {
  if (!tableExists(db, 'exercises')) return
  try {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      DROP TABLE IF EXISTS exercises_migration;
      CREATE TABLE exercises_migration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        fields TEXT NOT NULL,
        lecture_id INTEGER,
        domain TEXT DEFAULT 'social-economic' CHECK(domain IN ('social-economic')),
        file_url TEXT,
        file_name TEXT,
        file_type TEXT,
        file_size INTEGER,
        "order" INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE SET NULL
      );
      INSERT INTO exercises_migration (id, title, description, fields, lecture_id, domain, file_url, file_name, file_type, file_size, "order", created_at)
      SELECT id, title, description, fields, lecture_id, 'social-economic' AS domain, file_url, file_name, file_type, file_size, "order", created_at
      FROM exercises;
      DROP TABLE exercises;
      ALTER TABLE exercises_migration RENAME TO exercises;
      PRAGMA foreign_keys=ON;
    `)
  } catch {
    db.exec('DROP TABLE IF EXISTS exercises_migration;')
  }
}

function seedDefaultQuizStageConfigs(db: Database.Database): void {
  const mainDefaults = [1, 2, 3, 4, 5].map((stageNumber) => ({
    stageType: 'main',
    stageNumber,
    title: `الباب ${stageNumber}`,
    image: `/quiz-map/door-${stageNumber}.jpeg`,
    questions: Array.from({ length: 4 }, (_, index) => ({
      id: `main-${stageNumber}-${index + 1}`,
      question: `سؤال الباب ${stageNumber}.${index + 1}`,
      options: ['الإجابة الأولى', 'الإجابة الثانية', 'الإجابة الثالثة', 'الإجابة الرابعة'],
      correctAnswer: index % 4,
    })),
  }))

  const bonusDefaults = [1, 2, 3, 4, 5].map((stageNumber) => ({
    stageType: 'bonus',
    stageNumber,
    title: `سؤال المسار ${stageNumber}`,
    image: `/quiz-map/door-${Math.min(stageNumber, 5)}.jpeg`,
    questions: [{
      id: `bonus-${stageNumber}-1`,
      question: `سؤال مكافأة المسار ${stageNumber}`,
      options: ['الإجابة الأولى', 'الإجابة الثانية', 'الإجابة الثالثة', 'الإجابة الرابعة'],
      correctAnswer: 0,
    }],
  }))

  const statement = db.prepare(`
    INSERT OR IGNORE INTO quiz_stage_configs (stage_type, stage_number, title, image, questions)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const config of [...mainDefaults, ...bonusDefaults]) {
    statement.run(config.stageType, config.stageNumber, config.title, config.image, JSON.stringify(config.questions))
  }
}

export function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected')),
      profile_photo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      youtube_url TEXT NOT NULL,
      key_points TEXT,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      "order" INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      fields TEXT NOT NULL,
      lecture_id INTEGER,
      domain TEXT DEFAULT 'social-economic' CHECK(domain IN ('social-economic')),
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      "order" INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      answers TEXT NOT NULL,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      correction_text TEXT,
      correction_file_url TEXT,
      correction_file_name TEXT,
      correction_file_type TEXT,
      correction_file_size INTEGER,
      corrected_at DATETIME,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      questions TEXT NOT NULL,
      difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
      lecture_id INTEGER,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_game_profiles (
      user_id INTEGER PRIMARY KEY,
      unlocked_stage INTEGER DEFAULT 1,
      current_stage INTEGER DEFAULT 1,
      best_stage INTEGER DEFAULT 0,
      total_stars INTEGER DEFAULT 0,
      total_rewards INTEGER DEFAULT 0,
      sound_enabled INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_game_stage_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stage_number INTEGER NOT NULL,
      stage_type TEXT NOT NULL CHECK(stage_type IN ('main', 'bonus')),
      completed INTEGER DEFAULT 0,
      stars_earned INTEGER DEFAULT 0,
      reward_earned INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, stage_number, stage_type),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_stage_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage_type TEXT NOT NULL CHECK(stage_type IN ('main', 'bonus')),
      stage_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      image TEXT,
      questions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(stage_type, stage_number)
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      answers TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      grade TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      lecture_id INTEGER,
      group_id INTEGER,
      due_date DATETIME,
      solution TEXT,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE SET NULL,
      FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS homework_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      homework_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      users_can_send INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_section_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL CHECK(section IN ('accounts', 'tracking', 'students', 'social-economic')),
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_creations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('بودكاست', 'قصص مصورة', 'قصص قصيرة', 'صورة و تعليق')),
      description TEXT,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_content_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('lecture', 'domain_component')),
      item_id TEXT NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, item_type, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('الاستماع', 'اللغة', 'القراءة', 'الكتابة')),
      unit_name TEXT,
      group_name TEXT,
      student_count INTEGER DEFAULT 0,
      activity_count INTEGER DEFAULT 0,
      lab_name TEXT,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      description TEXT,
      is_archived INTEGER DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  addColumn(db, 'users', 'full_name', "TEXT NOT NULL DEFAULT ''")
  addColumn(db, 'users', 'status', "TEXT NOT NULL DEFAULT 'approved'")
  addColumn(db, 'users', 'profile_photo_url', 'TEXT')
  addColumn(db, 'users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0')

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY);
  `)

  const emailVerifiedBackfill = db
    .prepare("SELECT 1 AS ok FROM schema_migrations WHERE name = 'backfill_email_verified'")
    .get() as { ok: number } | undefined
  if (!emailVerifiedBackfill && tableExists(db, 'users')) {
    db.exec('UPDATE users SET email_verified = 1')
    db.prepare("INSERT INTO schema_migrations (name) VALUES ('backfill_email_verified')").run()
  }
  addColumn(db, 'project_groups', 'grade', 'TEXT')

  addColumn(db, 'lectures', 'file_url', 'TEXT')
  addColumn(db, 'lectures', 'file_name', 'TEXT')
  addColumn(db, 'lectures', 'file_type', 'TEXT')
  addColumn(db, 'lectures', 'file_size', 'INTEGER')
  addColumn(db, 'lectures', 'thumbnail_url', 'TEXT')
  addColumn(db, 'student_creations', 'thumbnail_url', 'TEXT')

  addColumn(db, 'exercises', 'domain', "TEXT DEFAULT 'social-economic'")
  addColumn(db, 'exercises', 'file_url', 'TEXT')
  addColumn(db, 'exercises', 'file_name', 'TEXT')
  addColumn(db, 'exercises', 'file_type', 'TEXT')
  addColumn(db, 'exercises', 'file_size', 'INTEGER')

  addColumn(db, 'exercise_submissions', 'file_url', 'TEXT')
  addColumn(db, 'exercise_submissions', 'file_name', 'TEXT')
  addColumn(db, 'exercise_submissions', 'file_type', 'TEXT')
  addColumn(db, 'exercise_submissions', 'file_size', 'INTEGER')
  addColumn(db, 'exercise_submissions', 'correction_text', 'TEXT')
  addColumn(db, 'exercise_submissions', 'correction_file_url', 'TEXT')
  addColumn(db, 'exercise_submissions', 'correction_file_name', 'TEXT')
  addColumn(db, 'exercise_submissions', 'correction_file_type', 'TEXT')
  addColumn(db, 'exercise_submissions', 'correction_file_size', 'INTEGER')
  addColumn(db, 'exercise_submissions', 'corrected_at', 'DATETIME')

  addColumn(db, 'quizzes', 'difficulty', "TEXT DEFAULT 'medium'")
  addColumn(db, 'quizzes', 'lecture_id', 'INTEGER')
  addColumn(db, 'quizzes', 'file_url', 'TEXT')
  addColumn(db, 'quizzes', 'file_name', 'TEXT')
  addColumn(db, 'quizzes', 'file_type', 'TEXT')
  addColumn(db, 'quizzes', 'file_size', 'INTEGER')

  addColumn(db, 'homework', 'group_id', 'INTEGER')
  addColumn(db, 'homework', 'file_url', 'TEXT')
  addColumn(db, 'homework', 'file_name', 'TEXT')
  addColumn(db, 'homework', 'file_type', 'TEXT')
  addColumn(db, 'homework', 'file_size', 'INTEGER')

  addColumn(db, 'homework_submissions', 'file_url', 'TEXT')
  addColumn(db, 'homework_submissions', 'file_name', 'TEXT')
  addColumn(db, 'homework_submissions', 'file_type', 'TEXT')
  addColumn(db, 'homework_submissions', 'file_size', 'INTEGER')
  addColumn(db, 'homework_submissions', 'correction_text', 'TEXT')
  addColumn(db, 'homework_submissions', 'correction_file_url', 'TEXT')
  addColumn(db, 'homework_submissions', 'correction_file_name', 'TEXT')
  addColumn(db, 'homework_submissions', 'correction_file_type', 'TEXT')
  addColumn(db, 'homework_submissions', 'correction_file_size', 'INTEGER')
  addColumn(db, 'homework_submissions', 'corrected_at', 'DATETIME')

  addColumn(db, 'messages', 'file_url', 'TEXT')
  addColumn(db, 'messages', 'file_name', 'TEXT')
  addColumn(db, 'messages', 'file_type', 'TEXT')
  addColumn(db, 'messages', 'file_size', 'INTEGER')

  addColumn(db, 'group_messages', 'file_url', 'TEXT')
  addColumn(db, 'group_messages', 'file_name', 'TEXT')
  addColumn(db, 'group_messages', 'file_type', 'TEXT')
  addColumn(db, 'group_messages', 'file_size', 'INTEGER')

  addColumn(db, 'admin_section_posts', 'category', 'TEXT')
  addColumn(db, 'admin_section_posts', 'file_url', 'TEXT')
  addColumn(db, 'admin_section_posts', 'file_name', 'TEXT')
  addColumn(db, 'admin_section_posts', 'file_type', 'TEXT')
  addColumn(db, 'admin_section_posts', 'file_size', 'INTEGER')

  addColumn(db, 'resources', 'unit_name', 'TEXT')
  addColumn(db, 'resources', 'group_name', 'TEXT')
  addColumn(db, 'resources', 'student_count', 'INTEGER DEFAULT 0')
  addColumn(db, 'resources', 'activity_count', 'INTEGER DEFAULT 0')
  addColumn(db, 'resources', 'lab_name', 'TEXT')
  addColumn(db, 'resources', 'file_url', 'TEXT')
  addColumn(db, 'resources', 'file_name', 'TEXT')
  addColumn(db, 'resources', 'file_type', 'TEXT')
  addColumn(db, 'resources', 'file_size', 'INTEGER')
  addColumn(db, 'resources', 'description', 'TEXT')
  addColumn(db, 'resources', 'is_archived', 'INTEGER DEFAULT 0')

  db.exec('INSERT OR IGNORE INTO chat_settings (id, users_can_send) VALUES (1, 0);')
  runAdminSectionMigration(db)
  runExerciseDomainMigration(db)
  seedDefaultQuizStageConfigs(db)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_exercises_lecture_id ON exercises(lecture_id);
    CREATE INDEX IF NOT EXISTS idx_quizzes_lecture_id ON quizzes(lecture_id);
    CREATE INDEX IF NOT EXISTS idx_quizzes_difficulty ON quizzes(difficulty);
    CREATE INDEX IF NOT EXISTS idx_quiz_stage_configs_type_number ON quiz_stage_configs(stage_type, stage_number);
    CREATE INDEX IF NOT EXISTS idx_quiz_game_profiles_best_stage ON quiz_game_profiles(best_stage);
    CREATE INDEX IF NOT EXISTS idx_quiz_game_stage_progress_user ON quiz_game_stage_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_game_stage_progress_month ON quiz_game_stage_progress(updated_at);
    CREATE INDEX IF NOT EXISTS idx_homework_lecture_id ON homework(lecture_id);
    CREATE INDEX IF NOT EXISTS idx_homework_group_id ON homework(group_id);
    CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework_id ON homework_submissions(homework_id);
    CREATE INDEX IF NOT EXISTS idx_homework_submissions_user_id ON homework_submissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON group_messages(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON group_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_admin_section_posts_section ON admin_section_posts(section);
    CREATE INDEX IF NOT EXISTS idx_admin_section_posts_created_at ON admin_section_posts(created_at);
    DROP INDEX IF EXISTS idx_admin_section_posts_unique_category;
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_student_creations_type ON student_creations(type);
    CREATE INDEX IF NOT EXISTS idx_student_creations_created_at ON student_creations(created_at);
    CREATE INDEX IF NOT EXISTS idx_user_content_progress_user ON user_content_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_content_progress_item ON user_content_progress(item_type, item_id);
    CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
    CREATE INDEX IF NOT EXISTS idx_resources_unit_name ON resources(unit_name);
    CREATE INDEX IF NOT EXISTS idx_resources_group_name ON resources(group_name);
    CREATE INDEX IF NOT EXISTS idx_resources_archived ON resources(is_archived);
  `)
}
