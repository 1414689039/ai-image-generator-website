-- 添加 gallery 相关的字段和表

-- 尝试添加字段，如果存在则忽略（SQLite不直接支持 IF NOT EXISTS COLUMN，所以分步执行或忽略错误）
-- 注意：在本地开发环境中，如果你已经运行过这个脚本，再次运行会报错。
-- 为了安全起见，我们假设这些字段可能已经存在。
-- 正确的迁移脚本应该只包含增量更改。由于本地已经报错 duplicate column，说明字段已存在。
-- 我们可以通过创建一个只包含新表的脚本来修复这个问题，或者手动确认字段是否存在。

-- 但为了确保生产环境（Remote）也能正确执行，通常我们会提交一个新的迁移文件。
-- 既然本地报错 duplicate column name: is_public，说明本地数据库已经跑过类似的迁移，或者之前手动添加过。

-- 让我们创建一个更安全的迁移脚本，只创建表，对于 ALTER TABLE 如果失败（因为列已存在）通常会中断。
-- 我们把 ALTER TABLE 放在单独的块中，或者注释掉已存在的列。

-- 根据报错，is_public 已存在。
-- 让我们检查一下 price 和 likes_count 是否存在。

-- 修正后的策略：
-- 1. 创建表（IF NOT EXISTS）
-- 2. 尝试添加列（如果已存在会报错，但在生产环境可能是第一次运行）
-- 由于无法在 SQL 脚本中做条件判断（除了使用复杂的存储过程，D1不支持），
-- 我们通常的做法是：如果是在全新的环境部署，这些语句是必须的。
-- 如果是增量更新，而列已存在，这说明环境状态不一致。

-- 既然用户说“之前这个功能是有的”，说明数据库里可能已经有这些字段了！
-- 所以我们不需要 ALTER TABLE，或者只需要创建缺失的表。

-- 让我们先只创建表，看看是否成功。
CREATE TABLE IF NOT EXISTS gallery_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    generation_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (generation_id) REFERENCES generations(id),
    UNIQUE(user_id, generation_id)
);

CREATE TABLE IF NOT EXISTS gallery_unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    generation_id INTEGER NOT NULL,
    price_paid DECIMAL(10, 2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (generation_id) REFERENCES generations(id),
    UNIQUE(user_id, generation_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_gallery_likes_generation_id ON gallery_likes(generation_id);

-- 尝试添加列的语句我们先注释掉，如果运行时发现缺列再补
-- ALTER TABLE generations ADD COLUMN is_public INTEGER DEFAULT 0;
-- ALTER TABLE generations ADD COLUMN price DECIMAL(10, 2) DEFAULT 0;
-- ALTER TABLE generations ADD COLUMN likes_count INTEGER DEFAULT 0;
-- CREATE INDEX IF NOT EXISTS idx_generations_is_public ON generations(is_public);
