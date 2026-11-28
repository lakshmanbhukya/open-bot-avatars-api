// Log at most once per subsystem per minute, with no request or error payloads.
export function createDiagnostics({ now = Date.now, log = console.error } = {}) {
  const last = new Map()
  return function report(subsystem, category) {
    const time = now()
    if (last.has(subsystem) && time - last.get(subsystem) < 60_000) return
    last.set(subsystem, time)
    log(`[avatar-api] ${subsystem}: ${category}`)
  }
}

export const reportFailure = createDiagnostics()
