-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    points DECIMAL(10, 2) DEFAULT 0.00,
    is_admin INTEGER DEFAULT 0, -- 0=普通用户, 1=管理员
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 生成记录表
CREATE TABLE IF NOT EXISTS generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'text_to_image' 或 'image_to_image'
    prompt TEXT NOT NULL,
    reference_image_url TEXT, -- 参考图URL（图生图时使用）
    model TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    quality TEXT NOT NULL, -- 'standard', 'hd', 'ultra_hd'
    quantity INTEGER NOT NULL,
    points_cost DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    result_urls TEXT, -- JSON数组，存储生成的图片URL
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 订单表（积分充值）
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_no TEXT UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    points DECIMAL(10, 2) NOT NULL, -- 充值的积分数量
    payment_method TEXT, -- 支付方式
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
    payment_transaction_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 积分记录表
CREATE TABLE IF NOT EXISTS point_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'recharge', 'consume', 'adjust', 'refund'
    amount DECIMAL(10, 2) NOT NULL, -- 正数=增加, 负数=减少
    balance_after DECIMAL(10, 2) NOT NULL, -- 操作后的余额
    description TEXT,
    related_order_id INTEGER, -- 关联的订单ID（如果是充值）
    related_generation_id INTEGER, -- 关联的生成记录ID（如果是消费）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (related_order_id) REFERENCES orders(id),
    FOREIGN KEY (related_generation_id) REFERENCES generations(id)
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API密钥配置表
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, -- 'nano_banana', 'other'
    api_key TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 积分规则配置表
CREATE TABLE IF NOT EXISTS point_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_type TEXT NOT NULL, -- 'text_to_image', 'image_to_image'
    quality TEXT NOT NULL, -- 'standard', 'hd', 'ultra_hd'
    base_points DECIMAL(10, 2) NOT NULL, -- 基础积分
    points_per_image DECIMAL(10, 2) NOT NULL, -- 每张图片的积分
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);

-- 插入默认管理员账户（密码: admin）
-- 注意：实际部署时应该通过注册接口或手动生成密码hash
-- 这里使用一个占位符，首次部署后需要通过API修改密码
-- 或者可以通过wrangler d1 execute命令手动插入正确的hash
INSERT OR IGNORE INTO users (username, email, password_hash, is_admin, points) 
VALUES ('admin', 'admin@example.com', 'PLACEHOLDER_HASH', 1, 1000.00);

-- 插入默认积分规则
INSERT OR IGNORE INTO point_rules (generation_type, quality, base_points, points_per_image) VALUES
('text_to_image', 'standard', 1.0, 1.0),
('text_to_image', 'hd', 2.0, 2.0),
('text_to_image', 'ultra_hd', 3.0, 3.0),
('image_to_image', 'standard', 1.5, 1.5),
('image_to_image', 'hd', 3.0, 3.0),
('image_to_image', 'ultra_hd', 4.5, 4.5);

