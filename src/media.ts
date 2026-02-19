import { spawn, ChildProcess } from "child_process"
import { resolve } from "path"
import { existsSync } from "fs"
import { createInterface } from "readline"
import { logger } from "./logger"
import { MediaInfo } from "./types"

let latestMedia: MediaInfo | null = null
let helperProcess: ChildProcess | null = null
let lastValidMediaTime = 0
const MEDIA_GRACE_PERIOD = 30_000 // Keep last valid media for 30s after null

// Map AUMID (Application User Model ID) to friendly process names
const AUMID_MAP: Record<string, string> = {
  "Spotify.exe": "Spotify",
  "Spotify": "Spotify",
  "com.electron.bilibili": "bilibili",
  "QQMusic": "QQ\u97f3\u4e50",
  "CloudMusic": "\u7f51\u6613\u4e91\u97f3\u4e50",
  "com.apple.Music": "Apple Music",
  "AppleMusic": "Apple Music",
  "AppleInc.AppleMusic": "Apple Music",
  "Chrome": "Chrome",
  "msedge": "Microsoft Edge",
  "firefox": "Firefox",
  "foobar2000": "foobar2000",
  "AIMP": "AIMP",
  "Groove Music": "Groove Music",
  "Media Player": "Windows Media Player",
  "MediaPlayer": "Windows Media Player",
}

function resolveFriendlyName(aumid: string | undefined): string | undefined {
  if (!aumid) return undefined
  for (const [key, name] of Object.entries(AUMID_MAP)) {
    if (aumid.includes(key)) return name
  }
  // Fallback: extract last segment
  const parts = aumid.split(/[\\!]/)
  const last = parts[parts.length - 1]
  if (last?.endsWith(".exe")) return last.replace(/\.exe$/, "")
  return last || aumid
}

export function getLatestMedia(): MediaInfo | null {
  // If we have media, return it
  if (latestMedia) return latestMedia
  // Grace period expired — no media
  return null
}

export function startMediaDetection() {
  // Prefer C# media-helper.exe (reliable WinRT access)
  const helperExe = resolve(process.cwd(), "scripts", "media-helper.exe")

  if (!existsSync(helperExe)) {
    logger.error("media-helper.exe not found at", helperExe)
    logger.error("Media detection disabled. Run: cd scripts/media-helper && dotnet publish -c Release -o ../../dist/scripts")
    return
  }

  helperProcess = spawn(helperExe, [], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })

  const rl = createInterface({ input: helperProcess.stdout! })

  rl.on("line", (line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed === "null") {
      // Grace period: only clear media if no valid update for 30s
      if (latestMedia && Date.now() - lastValidMediaTime > MEDIA_GRACE_PERIOD) {
        latestMedia = null
      }
      return
    }
    try {
      const parsed = JSON.parse(trimmed) as MediaInfo
      if (parsed && parsed.title) {
        parsed.processName = resolveFriendlyName(parsed.processName)
        latestMedia = parsed
        lastValidMediaTime = Date.now()
      } else if (latestMedia && Date.now() - lastValidMediaTime > MEDIA_GRACE_PERIOD) {
        latestMedia = null
      }
    } catch {
      // Don't clear on parse errors
    }
  })

  helperProcess.stderr!.on("data", (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) {
      logger.log("Media helper stderr:", msg)
    }
  })

  helperProcess.on("error", (err) => {
    logger.error("Failed to start media helper:", err.message)
    helperProcess = null
  })

  helperProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      logger.error("Media helper exited with code", code)
    }
    helperProcess = null
    latestMedia = null
  })

  logger.log("Media detection started (media-helper.exe)")
}

export function stopMediaDetection() {
  if (helperProcess) {
    helperProcess.kill()
    helperProcess = null
    latestMedia = null
  }
}
