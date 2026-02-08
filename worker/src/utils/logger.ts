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

    // 性能优化：API_DEBUG 类型的 INFO 日志，除非出错，否则不写入数据库
    // 避免高频轮询导致数据库锁死 (Database Locked)
    if (category === 'API_DEBUG' && level === 'INFO') {
        return
    }

    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null
    
    // 使用非阻塞方式写入（不等待结果），或者是为了确保不阻塞主流程，我们捕获所有写入错误
    // 注意：在 Worker 中如果不 await，请求结束时 IO 可能会被中断。
    // 但为了防止 DB 挂掉影响业务，我们必须捕获异常。
    try {
        await execute(
          db,
          'INSERT INTO system_logs (level, category, message, details) VALUES (?, ?, ?, ?)',
          [level, category, message, detailsStr]
        )
    } catch (dbError) {
        // 关键修改：日志写入失败绝对不能影响主业务流程！
        // 仅在控制台记录错误，吞掉异常
        console.error('CRITICAL: Failed to write to system_logs table. Dropping log message.', dbError)
    }
    
  } catch (e) {
    console.error('Unexpected error in logSystem:', e)
    // 绝对不抛出异常
  }
}
