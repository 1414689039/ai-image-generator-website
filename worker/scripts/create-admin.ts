/**
 * 创建管理员账户的脚本
 * 使用方法: npx tsx scripts/create-admin.ts
 */

import { hashPassword } from '../src/utils/password'

async function createAdmin() {
  const password = process.argv[2] || 'admin'
  const hash = await hashPassword(password)
  console.log('管理员密码hash:')
  console.log(hash)
  console.log('\nSQL命令:')
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'admin';`)
  console.log('\n或者插入新管理员:')
  console.log(`INSERT INTO users (username, email, password_hash, is_admin, points) VALUES ('admin', 'admin@example.com', '${hash}', 1, 1000.00);`)
}

createAdmin().catch(console.error)

