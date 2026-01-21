/**
 * Linkcccp_hashPassword - 密码哈希工具函数
 * 使用 Web Crypto API 进行 SHA-256 哈希，前端安全验证
 * 不增加 OneDrive API 负担，所有验证在客户端完成
 */

/**
 * 将密码转换为 SHA-256 哈希字符串
 * @param password 明文密码
 * @returns 哈希后的十六进制字符串
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 验证密码是否匹配
 * @param inputPassword 用户输入的密码
 * @param storedHash 存储的密码哈希
 * @returns 是否匹配
 */
export async function verifyPassword(inputPassword: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPassword(inputPassword)
  return inputHash === storedHash
}

// localStorage 存储键名
const HIDDEN_CONTENT_UNLOCKED_KEY = 'Linkcccp_hiddenContentUnlocked'

/**
 * 检查隐私内容是否已解锁
 * @returns 是否已解锁
 */
export function isHiddenContentUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(HIDDEN_CONTENT_UNLOCKED_KEY) === 'true'
}

/**
 * 设置隐私内容解锁状态
 * @param unlocked 是否解锁
 */
export function setHiddenContentUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return
  if (unlocked) {
    localStorage.setItem(HIDDEN_CONTENT_UNLOCKED_KEY, 'true')
  } else {
    localStorage.removeItem(HIDDEN_CONTENT_UNLOCKED_KEY)
  }
}

/**
 * 检查书籍是否包含隐私标签
 * @param bookTags 书籍的标签字符串（逗号分隔）
 * @param hiddenTags 隐私标签列表
 * @returns 是否包含任意一个隐私标签
 */
export function hasHiddenTag(bookTags: string | undefined, hiddenTags: string[]): boolean {
  if (!bookTags || hiddenTags.length === 0) return false
  
  // 将书籍标签拆分为数组
  const tagArray = bookTags.split(/[,;、]/).map(t => t.trim().toLowerCase())
  
  // 检查是否包含任意一个隐私标签
  return hiddenTags.some(hiddenTag => 
    tagArray.some(tag => tag === hiddenTag.toLowerCase())
  )
}
