import React from 'react'

// Ilustraciones lineales propias, escalables y con fondo transparente.
export default function AnimalIcon({ kind, size = 18 }) {
  const p = { width:size, height:size, viewBox:'0 0 64 64', fill:'none', stroke:'currentColor', strokeWidth:2.5, strokeLinecap:'round', strokeLinejoin:'round' }
  if (kind === 'eggs') return <svg {...p}><ellipse cx="32" cy="39" rx="15" ry="19"/><path d="M20 25c3-5 8-8 12-8s9 3 12 8"/></svg>
  if (kind === 'cooked-turkey') return <svg {...p}><path d="M20 43c-6-5-6-15 1-20 7-5 17-3 22 3 5 6 3 16-4 20-6 4-14 3-19-3Z"/><path d="M43 27c5-5 11-3 12 2 1 5-4 8-9 6M18 40l-5 5M23 45l-3 6M42 43l5 5"/></svg>
  if (kind === 'young-chicken') return <svg {...p}><path d="M20 43c-2-12 5-22 16-22 8 0 13 6 13 13 0 10-8 16-19 15-5 0-8-2-10-6Z"/><path d="M35 21c-2-5 2-8 5-4 4-4 7 0 4 4M46 30h8M51 27l3 3-3 3M27 49l-2 7M38 49l2 7"/></svg>
  return <svg {...p}><path d="M18 45c-3-11 3-23 15-25 10-2 18 5 18 14 0 10-8 17-20 17-6 0-10-2-13-6Z"/><path d="M32 20c-2-7 5-10 8-4 5-5 9 1 5 5M48 28h9M54 25l3 3-3 3M25 50l-3 7M39 50l3 7M19 35c-7-3-10-8-7-12 3-4 8-1 9 4"/></svg>
}
