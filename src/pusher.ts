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

  private sending = false
  private pendingData: ReportPayload | null = null
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

  private batch(data: ReportPayload) {
    if (this.sending) {
      // A request is in flight — queue the latest data (overwrites any previous pending)
      this.pendingData = data
      return
    }

    const mediaStr = data.media
      ? ` | Media: ${data.media.title} - ${data.media.artist}`
      : ""
    logger.log(
      "Pushing",
      data.process.name + " - " + (data.process.description || "N/A") + mediaStr
    )

    this.sendNow(data)
  }

  private async sendNow(data: ReportPayload) {
    this.sending = true
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
      })

      this.onStatusUpdate?.(data.process.name, data.media || null)

      return res
    } catch (err: any) {
      logger.error(err)
    } finally {
      this.sending = false

      // If new data arrived while we were sending, send the latest
      if (this.pendingData) {
        const next = this.pendingData
        this.pendingData = null

        const mediaStr = next.media
          ? ` | Media: ${next.media.title} - ${next.media.artist}`
          : ""
        logger.log(
          "Pushing",
          next.process.name + " - " + (next.process.description || "N/A") + mediaStr
        )

        this.sendNow(next)
      }
    }
  }
}
