import { D1Database } from '@cloudflare/workers-types'
import { queryOne, execute } from './db'

/**
 * 积分系统工具函数
 */

interface Model {
  id: string
  price: number
}

// 模型价格表 (需与前端保持一致)
const MODELS: Model[] = [
  { id: 'nano-banana-pro-reverse', price: 0.8 },
  { id: 'gemini-3-pro-image-preview', price: 2.5 },
  { id: 'gemini-3-pro-image-preview-2k', price: 5.0 },
  { id: 'gemini-3-pro-image-preview-4k', price: 5.0 },
]

// 计算生成所需的积分
export async function calculatePointsCost(
  db: D1Database,
  generationType: string,
  quality: string,
  quantity: number,
  modelId?: string // 新增模型ID参数
): Promise<number> {
  
  // 1. 尝试使用模型特定的价格
  let basePoints = 0
  let pointsPerImage = 0
  
  if (modelId) {
    const model = MODELS.find(m => m.id === modelId)
    if (model) {
        const price = model.price
        // 参照前端逻辑计算
        if (generationType === 'image_to_image') {
            // 图生图系数 1.5
            if (quality === 'standard') { basePoints = price * 1.5; pointsPerImage = price * 1.5 }
            else if (quality === 'hd') { basePoints = price * 3; pointsPerImage = price * 3 }
            else { basePoints = price * 4.5; pointsPerImage = price * 4.5 }
        } else {
            // 文生图
            if (quality === 'standard') { basePoints = price; pointsPerImage = price }
            else if (quality === 'hd') { basePoints = price * 2; pointsPerImage = price * 2 }
            else { basePoints = price * 3; pointsPerImage = price * 3 }
        }
        return basePoints + pointsPerImage * quantity
    }
  }

  // 2. 如果没有找到模型价格，回退到数据库规则查询
  // 查询积分规则
  const rule = await queryOne<{
    base_points: number
    points_per_image: number
  }>(
    db,
    `SELECT base_points, points_per_image 
     FROM point_rules 
     WHERE generation_type = ? AND quality = ? AND is_active = 1`,
    [generationType, quality]
  )

  if (!rule) {
    // 如果没有找到规则，使用默认值
    return quantity * 2.0
  }

  return rule.base_points + rule.points_per_image * quantity
}

// 扣除用户积分
export async function deductPoints(
  db: D1Database,
  userId: number,
  amount: number,
  description: string,
  relatedGenerationId?: number
): Promise<{ success: boolean; newBalance: number }> {
  // 获取当前余额
  const user = await queryOne<{ points: number }>(
    db,
    'SELECT points FROM users WHERE id = ?',
    [userId]
  )

  if (!user) {
    return { success: false, newBalance: 0 }
  }

  const currentBalance = parseFloat(user.points.toString())
  const newBalance = currentBalance - amount

  if (newBalance < 0) {
    return { success: false, newBalance: currentBalance }
  }

  // 更新用户积分
  await execute(
    db,
    'UPDATE users SET points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newBalance, userId]
  )

  // 记录积分交易
  await execute(
    db,
    `INSERT INTO point_transactions 
     (user_id, type, amount, balance_after, description, related_generation_id) 
     VALUES (?, 'consume', ?, ?, ?, ?)`,
    [userId, -amount, newBalance, description, relatedGenerationId || null]
  )

  return { success: true, newBalance }
}

// 增加用户积分
export async function addPoints(
  db: D1Database,
  userId: number,
  amount: number,
  description: string,
  relatedOrderId?: number,
  relatedGenerationId?: number,
  type: string = 'recharge'
): Promise<{ success: boolean; newBalance: number }> {
  // 获取当前余额
  const user = await queryOne<{ points: number }>(
    db,
    'SELECT points FROM users WHERE id = ?',
    [userId]
  )

  if (!user) {
    return { success: false, newBalance: 0 }
  }

  const currentBalance = parseFloat(user.points.toString())
  const newBalance = currentBalance + amount

  // 更新用户积分
  await execute(
    db,
    'UPDATE users SET points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newBalance, userId]
  )

  // 记录积分交易
  await execute(
    db,
    `INSERT INTO point_transactions 
     (user_id, type, amount, balance_after, description, related_order_id, related_generation_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, amount, newBalance, description, relatedOrderId || null, relatedGenerationId || null]
  )

  return { success: true, newBalance }
}

