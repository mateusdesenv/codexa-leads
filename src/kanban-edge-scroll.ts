import { getEventCoordinates } from '@dnd-kit/utilities'

// dnd-kit still handles vertical scrolling within each column.
export const columnAutoScroll = {
  canScroll: (element: Element) => !element.classList.contains('kanban-board'),
}

export function startBoardScroll(board: HTMLElement, activator: Event) {
  let point = getEventCoordinates(activator)
  let frame = 0
  let previousTime = 0
  const moveEvent = activator.type.startsWith('touch') ? 'touchmove' : 'pointermove'

  function tick(time: number) {
    frame = 0
    if (!point || !board.isConnected) return
    const rect = board.getBoundingClientRect()
    const left = Math.max(0, rect.left)
    const right = Math.min(window.innerWidth, rect.right)
    const band = Math.min(104, (right - left) / 4)
    if (band <= 0 || point.y < rect.top || point.y > rect.bottom ||
        point.x < left - 24 || point.x > right + 24) return

    const fromLeft = point.x - left
    const fromRight = right - point.x
    const distance = Math.min(fromLeft, fromRight)
    if (distance >= band) return
    const direction = fromLeft < fromRight ? -1 : 1
    const strength = Math.min(1, 1 - distance / band)
    const elapsed = previousTime ? Math.min(time - previousTime, 32) : 16
    previousTime = time
    const start = board.scrollLeft
    const limit = board.scrollWidth - board.clientWidth
    const pixels = Math.max(1, Math.round((160 + 1120 * strength) * elapsed / 1000))
    board.scrollLeft = Math.max(0, Math.min(limit, start + direction * pixels))
    if (board.scrollLeft !== start) frame = requestAnimationFrame(tick)
  }

  function schedule() {
    if (!frame) {
      previousTime = 0
      frame = requestAnimationFrame(tick)
    }
  }
  function track(event: Event) {
    point = getEventCoordinates(event)
    schedule()
  }
  document.addEventListener(moveEvent, track, { capture: true, passive: true })
  schedule()
  return () => {
    cancelAnimationFrame(frame)
    document.removeEventListener(moveEvent, track, true)
  }
}
