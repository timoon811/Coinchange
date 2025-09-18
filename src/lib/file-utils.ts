/**
 * Утилиты для работы с файлами
 */

/**
 * Определяет MIME тип файла по расширению
 */
export function getMimeTypeByExtension(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop()
  
  const mimeTypes: Record<string, string> = {
    // Изображения
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    
    // Документы
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    
    // Архивы
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Аудио
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    
    // Видео
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    
    // Веб
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    
    // Другие
    'csv': 'text/csv',
  }
  
  return mimeTypes[extension || ''] || 'application/octet-stream'
}

/**
 * Определяет размер файла по URL (если возможно)
 */
export async function getFileSizeFromUrl(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    const contentLength = response.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : 0
  } catch (error) {
    console.warn('Не удалось получить размер файла:', error)
    return 0
  }
}

/**
 * Проверяет является ли файл изображением
 */
export function isImageFile(filename: string): boolean {
  const extension = filename.toLowerCase().split('.').pop()
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
  return imageExtensions.includes(extension || '')
}

/**
 * Проверяет является ли файл документом
 */
export function isDocumentFile(filename: string): boolean {
  const extension = filename.toLowerCase().split('.').pop()
  const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf']
  return documentExtensions.includes(extension || '')
}

/**
 * Форматирует размер файла в человекочитаемый вид
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Генерирует безопасное имя файла
 */
export function sanitizeFilename(filename: string): string {
  // Удаляем опасные символы и заменяем их на безопасные
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
}
