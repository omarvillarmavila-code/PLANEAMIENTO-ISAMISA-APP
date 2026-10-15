import { useEffect, useState } from 'react'

const EVENT = 'lumbra-calendar-filter'
export function emitCalendarFilter(ano, semana) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { ano, semana } }))
}
export function useCalendarFilter() {
  const [filter, setFilter] = useState({ ano: 'actual', semana: 'actual' })
  useEffect(() => {
    const receive = (event) => setFilter(event.detail || { ano: 'actual', semana: 'actual' })
    const receiveSelect = () => {
      const selects = document.querySelectorAll('.weekly-filter select')
      if (selects.length >= 2) setFilter({ ano: selects[0].value, semana: selects[1].value })
    }
    window.addEventListener(EVENT, receive)
    document.addEventListener('change', receiveSelect)
    return () => { window.removeEventListener(EVENT, receive); document.removeEventListener('change', receiveSelect) }
  }, [])
  return filter
}
