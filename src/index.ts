import { resolve } from "path"
import { existsSync, writeFileSync } from "fs"

process.title = "Process Reporter"

const PKG_PATH = resolve(process.cwd(), "./package.json")
if (!existsSync(PKG_PATH)) {
  writeFileSync(PKG_PATH, "{}", "utf-8")
}

import("./bootstarp").then(({ bootstrap }) => {
  bootstrap()
})

import("./tray").then(({ initTray, updateTrayStatus }) => {
  import("./pusher").then(({ Pusher }) => {
    Pusher.shared.setStatusCallback(updateTrayStatus)
  })

  import("./media").then(({ stopMediaDetection }) => {
    initTray({
      onQuit: () => {
        stopMediaDetection()
      },
    })
  })
})
