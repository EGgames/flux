import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Reads audio duration in milliseconds from a local file.
 * Uses ffprobe if available, falls back to 0 if not.
 */
export async function getAudioDurationMs(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ])
    const seconds = parseFloat(stdout.trim())
    return isNaN(seconds) ? null : Math.round(seconds * 1000)
  } catch {
    // ffprobe not available — duration unknown
    return null
  }
}

/**
 * Converts a local file path to a safe local-audio:// URL
 * served by the custom protocol registered in main.ts.
 */
export function toLocalAudioUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return `local-audio://?p=${encodeURIComponent(normalized.replace(/\//g, '\\'))}`
}
