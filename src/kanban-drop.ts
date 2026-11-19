import type { CollisionDetection } from '@dnd-kit/core'
import type { ColumnId } from './types'

export interface DropSlot {
  column: ColumnId
  before: string | null
}

export const locateDrop: CollisionDetection = ({ pointerCoordinates, droppableContainers }) => {
  if (!pointerCoordinates) return []
  const { x, y } = pointerCoordinates
  const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-kanban-column]')
  const id = column?.dataset.kanbanColumn
  if (!id) return []
  const container = droppableContainers.find(item => item.id === id)
  const list = container?.node.current
  if (!list) return []
  const cards = list.children

  // Use the same slot for the insertion line and the eventual mutation.
  // Binary search keeps pointer tracking cheap even on large prospecting lists.
  let low = 0
  let high = cards.length
  if (y < list.getBoundingClientRect().top) high = 0
  while (low < high) {
    const mid = (low + high) >>> 1
    const rect = cards[mid].getBoundingClientRect()
    if (y < rect.top + rect.height / 2) high = mid
    else low = mid + 1
  }
  const before = (cards[low] as HTMLElement | undefined)?.dataset.placeId ?? null
  return [{ id, data: { slot: { column: id, before } } }]
}
