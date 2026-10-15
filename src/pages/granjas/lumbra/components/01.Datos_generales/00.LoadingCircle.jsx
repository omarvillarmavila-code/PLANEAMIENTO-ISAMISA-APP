import React from 'react'

export default function LoadingCircle({ text = 'Cargando...' }) {
  return <div className="loading-circle"><span />{text}</div>
}
