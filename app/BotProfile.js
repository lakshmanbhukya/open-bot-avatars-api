'use client'

import { useEffect, useRef } from 'react'

// The SVG must be served from the page's origin to access its eye shapes.
export default function BotProfile({ src, size = 64, alt = 'Bot profile picture' }) {
  const profile = useRef(null)

  useEffect(() => {
    const object = profile.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let eyes = []
    let pointer = null
    let frame = 0

    function draw() {
      frame = 0
      if (!eyes.length) return
      const rect = object.getBoundingClientRect()
      const dx = pointer ? pointer.clientX - rect.left - rect.width / 2 : 0
      const dy = pointer ? pointer.clientY - rect.top - rect.height / 2 : 0
      const distance = Math.max(1, rect.width / 2, Math.hypot(dx, dy))
      for (const eye of eyes) {
        eye.setAttribute('transform', `translate(${2 * dx / distance} ${2 * dy / distance})`)
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw)
    }

    function reset() {
      pointer = null
      schedule()
    }

    function follow(event) {
      if (motion.matches || event.pointerType === 'touch') return reset()
      pointer = event
      schedule()
    }

    function load() {
      // The original seven designs use dark rects and arcs for their eyes.
      eyes = object.contentDocument?.querySelectorAll('[data-eyes], rect[fill="#151515"], path[stroke="#151515"]') ?? []
      schedule()
    }

    const listeners = new AbortController()
    const options = { signal: listeners.signal }
    object.addEventListener('load', load, options)
    window.addEventListener('pointermove', follow, options)
    document.documentElement.addEventListener('pointerleave', reset, options)
    window.addEventListener('blur', reset, options)
    window.addEventListener('resize', schedule, options)
    window.addEventListener('scroll', schedule, { ...options, capture: true })
    motion.addEventListener('change', reset, options)
    load()
    return () => {
      listeners.abort()
      cancelAnimationFrame(frame)
    }
  }, [src])

  return <object ref={profile} data={src} type="image/svg+xml" role="img"
    aria-label={alt} width={size} height={size} tabIndex={-1} style={{ pointerEvents: 'none' }}>
    <img src={src} alt={alt} width={size} height={size}/>
  </object>
}
