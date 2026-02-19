import { ignoreProcessNames, rules } from "./configs"
import { PushData } from "./pusher"

export const pushDataReplacor = async (data: PushData): Promise<PushData | undefined> => {
  const processName = data.process

  if (
    ignoreProcessNames.some((ignoreName) => {
      if (typeof ignoreName === "string") {
        return processName === ignoreName
      } else if (ignoreName instanceof RegExp) {
        return ignoreName.test(processName)
      }
      return ignoreName(processName)
    })
  ) {
    return
  }

  const rule = rules.find(
    (rule) =>
      rule.matchApplication === data.process || rule.matchApplication === "*"
  )
  if (!rule) return data

  const finalIconProps: { iconUrl?: string; iconBase64?: string } =
    typeof rule.override?.iconUrl !== "undefined"
      ? {
          iconUrl: rule.override.iconUrl,
          iconBase64: undefined,
        }
      : {
          iconUrl: data.iconUrl,
          iconBase64: data.iconBase64,
        }

  const finalProcessName =
    rule.replace?.application?.(data.process) || data.process
  const finalDescription =
    rule.replace?.description?.(data.description) || data.description

  // If no SMTC media detected, try extracting from window title via rule
  let media = data.media
  if (!media && rule.extractMedia && data.description) {
    const extracted = rule.extractMedia(data.description)
    if (extracted) {
      media = {
        ...extracted,
        processName: finalProcessName,
      }
    }
  }

  return {
    process: finalProcessName,
    description: finalDescription,
    ...finalIconProps,
    media,
  }
}
