import { D1Database } from '@cloudflare/workers-types'
import { queryOne, execute } from './db'

/**
 * 积分系统工具函数
 */

// 计算生成所需的积分
export async function calculatePointsCost(
  db: D1Database,
  generationType: string,
  quality: string,
  quantity: number
): Promise<number> {
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
  relatedOrderId?: number
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
     (user_id, type, amount, balance_after, description, related_order_id) 
     VALUES (?, 'recharge', ?, ?, ?, ?)`,
    [userId, amount, newBalance, description, relatedOrderId || null]
  )

  return { success: true, newBalance }
}

