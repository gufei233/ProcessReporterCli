import SysTray, { MenuItem } from "systray2"
import { resolve } from "path"
import { existsSync } from "fs"
import { exec } from "child_process"
import { MediaInfo } from "./types"
import { logger } from "./logger"

interface ClickableMenuItem extends MenuItem {
  click?: () => void
  items?: ClickableMenuItem[]
}

let systray: SysTray | null = null
let processItem: ClickableMenuItem
let mediaItem: ClickableMenuItem

// Minimal 16x16 ICO (blue square) as base64
const DEFAULT_ICON_BASE64 =
  "AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8AQGn/MEBS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAEBp/zD///8A////AP///wBAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4BAUX+A////AP///wBAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQFb/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gP///wD///8AQGn/MEBS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAFL/gABS/4AAUv+AAEBp/zD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A"

function getIconBase64(): string {
  // Try to load custom icon from resources directory
  const icoPath = resolve(process.cwd(), "resources", "icon.ico")
  if (existsSync(icoPath)) {
    try {
      const fs = require("fs")
      return fs.readFileSync(icoPath).toString("base64")
    } catch {}
  }
  return DEFAULT_ICON_BASE64
}

export function initTray(callbacks?: {
  onReloadConfig?: () => void
  onQuit?: () => void
}) {
  processItem = {
    title: "Process: -",
    tooltip: "Current active process",
    checked: false,
    enabled: false,
  }

  mediaItem = {
    title: "Media: -",
    tooltip: "Current playing media",
    checked: false,
    enabled: false,
  }

  const editConfigItem: ClickableMenuItem = {
    title: "Edit Config",
    tooltip: "Open .env in editor",
    checked: false,
    enabled: true,
    click: () => {
      const envPath = resolve(process.cwd(), ".env")
      exec(`notepad "${envPath}"`)
    },
  }

  const viewLogsItem: ClickableMenuItem = {
    title: "View Logs",
    tooltip: "Open logs folder",
    checked: false,
    enabled: true,
    click: () => {
      const logsPath = resolve(process.cwd(), "logs")
      exec(`explorer "${logsPath}"`)
    },
  }

  const reloadItem: ClickableMenuItem = {
    title: "Reload Config",
    tooltip: "Reload configuration",
    checked: false,
    enabled: true,
    click: () => {
      callbacks?.onReloadConfig?.()
      logger.log("Config reloaded")
    },
  }

  const exitItem: ClickableMenuItem = {
    title: "Exit",
    tooltip: "Quit Process Reporter",
    checked: false,
    enabled: true,
    click: () => {
      callbacks?.onQuit?.()
      killTray()
      process.exit(0)
    },
  }

  systray = new SysTray({
    menu: {
      icon: getIconBase64(),
      title: "",
      tooltip: "Process Reporter",
      items: [
        processItem,
        mediaItem,
        SysTray.separator,
        editConfigItem,
        viewLogsItem,
        reloadItem,
        SysTray.separator,
        exitItem,
      ],
    },
    debug: false,
    copyDir: false,
  })

  systray.onClick((action) => {
    const item = action.item as ClickableMenuItem
    if (item.click) {
      item.click()
    }
  })

  systray.ready().then(() => {
    logger.log("System tray initialized")
  }).catch((err) => {
    logger.error("Failed to initialize system tray:", err.message)
  })
}

export function updateTrayStatus(processName: string, media: MediaInfo | null) {
  if (!systray) return

  processItem.title = `Process: ${processName}`
  systray.sendAction({
    type: "update-item",
    item: processItem,
  })

  if (media) {
    mediaItem.title = `Media: ${media.title} - ${media.artist}`
  } else {
    mediaItem.title = "Media: -"
  }
  systray.sendAction({
    type: "update-item",
    item: mediaItem,
  })
}

export function killTray() {
  if (systray) {
    systray.kill(false)
    systray = null
  }
}
