import { D1Database } from '@cloudflare/workers-types'

/**
 * 数据库工具函数
 */

// 执行查询并返回结果
export async function query<T = any>(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all()
  return result.results as T[]
}

// 执行查询并返回单条记录
export async function queryOne<T = any>(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const result = await db.prepare(sql).bind(...params).first()
  return result as T | null
}

// 执行插入/更新/删除操作
export async function execute(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<{ success: boolean; meta: any }> {
  const result = await db.prepare(sql).bind(...params).run()
  return {
    success: result.success,
    meta: result.meta,
  }
}

// 执行事务
export async function transaction(
  db: D1Database,
  queries: Array<{ sql: string; params: any[] }>
): Promise<boolean> {
  try {
    await db.batch(
      queries.map((q) => db.prepare(q.sql).bind(...q.params))
    )
    return true
  } catch (error) {
    console.error('Transaction failed:', error)
    return false
  }
}

