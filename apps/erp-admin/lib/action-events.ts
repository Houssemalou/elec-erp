export const ACTION_START = 'elec:action-start'
export const ACTION_COMPLETE = 'elec:action-complete'

export function startActionLoader() {
  window.dispatchEvent(new Event(ACTION_START))
}

export function stopActionLoader() {
  window.dispatchEvent(new Event(ACTION_COMPLETE))
}