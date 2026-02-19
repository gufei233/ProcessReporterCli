export interface Rule {
  matchApplication: string
  replace?: {
    application?: (appName: string) => string
    description?: (des: string | undefined) => string | undefined
  }
  override?: {
    iconUrl?: string
  }
  /** Extract media info from window title for apps that don't support SMTC */
  extractMedia?: (windowTitle: string) => { title: string; artist: string } | null
}

/** Process info matching update.ts server interface */
export interface ProcessInfo {
  name: string
  iconBase64?: string
  iconUrl?: string
  description?: string
}

/** Media info matching update.ts server interface */
export interface MediaInfo {
  title: string
  artist: string
  duration?: number
  elapsedTime?: number
  processName?: string
}

/** Full POST body sent to the server */
export interface ReportPayload {
  process: ProcessInfo
  media?: MediaInfo
  key: string
  timestamp: number
}
