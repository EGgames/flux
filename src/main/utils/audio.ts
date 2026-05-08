import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import ffprobeStatic from 'ffprobe-static'

const execFileAsync = promisify(execFile)

/**
 * Returns the path to the ffprobe binary.
 * In production (packaged), uses the bundled binary from ffprobe-static (asarUnpack).
 * In development, uses the binary from node_modules directly.
 */
function getFfprobePath(): string {
  if (app.isPackaged) {
    // electron-builder unpacks asarUnpack files to app.asar.unpacked
    return ffprobeStatic.path.replace('app.asar', 'app.asar.unpacked')
  }
  return ffprobeStatic.path
}

/**
 * Reads audio duration in milliseconds from a local file.
 * Uses the bundled ffprobe binary. Falls back to null if unavailable.
 */
export async function getAudioDurationMs(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(getFfprobePath(), [
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
