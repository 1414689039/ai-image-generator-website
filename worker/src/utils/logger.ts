import { execute } from './db'

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export async function logSystem(
  db: D1Database, 
  level: LogLevel, 
  category: string, 
  message: string, 
  details?: any
) {
  try {
    // 控制台同时也打印，方便实时调试
    const logMsg = `[${category}] ${message}`
    if (level === 'ERROR') console.error(logMsg, details)
    else if (level === 'WARN') console.warn(logMsg, details)
    else console.log(logMsg, details)

    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null
    
    // 异步写入数据库，不等待结果
    // 注意：在 Worker 环境中，如果不 await，可能会在请求结束时被取消
    // 所以调用方最好使用 ctx.waitUntil(logSystem(...)) 或者 await logSystem(...)
    await execute(
      db,
      'INSERT INTO system_logs (level, category, message, details) VALUES (?, ?, ?, ?)',
      [level, category, message, detailsStr]
    )
  } catch (e) {
    console.error('Failed to write system log:', e)
  }
}
