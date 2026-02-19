import { endpoint, updateKey } from "./configs"
import { logger } from "./logger"
import { Uploader } from "./uploader"
import { MediaInfo, ProcessInfo, ReportPayload } from "./types"

export interface PushData {
  process: string
  description?: string
  iconUrl?: string
  iconBase64?: string
  media?: MediaInfo | null
}

type StatusCallback = (processName: string, media: MediaInfo | null) => void

export class Pusher {
  static readonly shared = new Pusher()
  private requestQueue = [] as {
    fetcher: () => Promise<any>
    cancelToken: AbortController
  }[]

  private lastSentKey: string | null = null
  private lastSentTime = 0
  private onStatusUpdate: StatusCallback | null = null

  setStatusCallback(cb: StatusCallback) {
    this.onStatusUpdate = cb
  }

  push(data: PushData) {
    const processInfo: ProcessInfo = {
      name: data.process,
      iconUrl: data.iconUrl,
      iconBase64: data.iconBase64,
      description: data.description,
    }

    const payload: ReportPayload = {
      key: updateKey,
      timestamp: Date.now(),
      process: processInfo,
      media: data.media || undefined,
    }

    this.batch(payload)
  }

  private contentKey(d: ReportPayload): string {
    return JSON.stringify({ p: d.process.name, d: d.process.description, m: d.media })
  }

  private batch(data: ReportPayload) {
    const now = Date.now()
    const key = this.contentKey(data)

    // Deduplicate: skip if same content was sent within the last 30 seconds
    if (this.lastSentKey === key && now - this.lastSentTime < 1000 * 30) {
      return
    }

    this.lastSentKey = key
    this.lastSentTime = now

    const cancelToken = new AbortController()
    const fetcher = async () => {
      try {
        try {
          const iconBase64 = data.process.iconBase64
          if (iconBase64) {
            data.process.iconUrl = await Uploader.shared.uploadIcon(
              iconBase64,
              data.process.name
            )
            delete data.process.iconBase64
          }

          const body = JSON.stringify(data)
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body,
            signal: cancelToken.signal,
          })

          this.onStatusUpdate?.(data.process.name, data.media || null)

          return res
        } catch (err: any) {
          if (err.name === "AbortError") {
            logger.log("AbortError: Fetch request aborted")
          } else logger.error(err)
          return err
        }
      } finally {
        this.requestQueue = this.requestQueue.filter(
          (task) => task.cancelToken !== cancelToken
        )
      }
    }

    this.requestQueue.forEach((task) => {
      if (task.cancelToken.signal.aborted) {
        return
      }
      task.cancelToken.abort()
    })
    this.requestQueue = []
    this.requestQueue.push({ fetcher, cancelToken: cancelToken })

    const mediaStr = data.media
      ? ` | Media: ${data.media.title} - ${data.media.artist}`
      : ""
    logger.log(
      "Pushing",
      data.process.name + " - " + (data.process.description || "N/A") + mediaStr
    )
    fetcher()
  }
}
