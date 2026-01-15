// 这是一个通用的 IndexedDB 缓存工具，用于 Linkcccp 系列离线功能
const DB_NAME = 'Linkcccp_File_Cache'
const STORE_NAME = 'files'

// 初始化/打开数据库
export const Linkcccp_getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' })
            }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

// 写入缓存
export const Linkcccp_saveToCache = async (id: string, blob: Blob, lastModified: string) => {
    try {
        const db = await Linkcccp_getDB()
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put({ id, blob, lastModified, timestamp: Date.now() })
    } catch (e) {
        console.error('Cache save failed', e)
    }
}

// 读取缓存
export const Linkcccp_getFromCache = async (id: string): Promise<{ blob: Blob, lastModified: string } | null> => {
    try {
        const db = await Linkcccp_getDB()
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly')
            const request = tx.objectStore(STORE_NAME).get(id)
            request.onsuccess = () => resolve(request.result || null)
            request.onerror = () => resolve(null)
        })
    } catch (e) {
        return null
    }
}

// 通用的下载并缓存器（Hook 逻辑的纯函数版）
export const Linkcccp_downloadAndCache = async (
    fileKey: string,
    fileLastModified: string,
    downloadUrl: string,
    onProgress: (progress: number) => void
): Promise<Blob> => {
    // 1. 尝试读缓存
    const cached = await Linkcccp_getFromCache(fileKey)
    if (cached && cached.lastModified === fileLastModified) {
        onProgress(100)
        return cached.blob
    }

    // 2. 缓存未命中，下载
    const response = await fetch(downloadUrl)
    if (!response.ok) throw new Error('Download failed')

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0
    let loaded = 0

    const reader = response.body!.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
            chunks.push(value)
            loaded += value.length
            if (total > 0) {
                onProgress(Math.round((loaded / total) * 100))
            }
        }
    }

    const blob = new Blob(chunks)

    // 3. 写入缓存
    await Linkcccp_saveToCache(fileKey, blob, fileLastModified)
    return blob
}
