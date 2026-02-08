-- 添加 gallery 相关的字段和表

-- 给 generations 表添加 price 和 is_public 字段
-- SQLite 不支持在 ALTER TABLE 中一次添加多个列，也不支持 IF NOT EXISTS
-- 也不支持直接添加列并设置默认值（如果是 NOT NULL）
-- 但 Cloudflare D1 的 SQLite 引擎通常支持简单的 ADD COLUMN

ALTER TABLE generations ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE generations ADD COLUMN price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE generations ADD COLUMN likes_count INTEGER DEFAULT 0;

-- 创建点赞表
CREATE TABLE IF NOT EXISTS gallery_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    generation_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (generation_id) REFERENCES generations(id),
    UNIQUE(user_id, generation_id)
);

-- 创建解锁表（购买提示词/做同款）
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
CREATE INDEX IF NOT EXISTS idx_generations_is_public ON generations(is_public);
CREATE INDEX IF NOT EXISTS idx_gallery_likes_generation_id ON gallery_likes(generation_id);
