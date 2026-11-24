'use client'

import { useState } from 'react'

export default function Home() {
  const [seed, setSeed] = useState('hello-bot')
  const [message, setMessage] = useState('')
  const url = '/api/avatar?seed=' + seed + '&v=2'

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href)
      setMessage('Profile URL copied.')
    } catch {
      setMessage('Copy the link under “Keep this bot” to save its profile URL.')
    }
  }

  async function downloadPng() {
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 512
      canvas.getContext('2d').drawImage(image, 0, 0, 512, 512)
      const link = document.createElement('a')
      link.download = 'bot-' + seed + '.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      setMessage('PNG download failed. Try again or download the SVG.')
    }
  }

  return <main>
    <header><span aria-hidden="true">◉</span> Open Bot Avatars</header>
    <section>
      <div className="intro">
        <h1>A fresh bot<br/>in one request.</h1>
        <p>Give your app a random bot avatar. Use the endpoint as an image source, or keep a favorite with a seed.</p>
        <a className="endpoint" href="/api/avatar"><b>GET</b> /api/avatar <span aria-hidden="true">↗</span></a>
      </div>
      <div className="studio">
        <div className="preview"><img src={url} width="256" height="256" alt="Bot avatar preview"/></div>
        <div className="actions">
          <button onClick={() => { setSeed(crypto.randomUUID()); setMessage('') }}>Shuffle bot</button>
          <button onClick={copyUrl}>Copy profile URL</button>
          <button onClick={downloadPng}>Download PNG</button>
          <a href={url} download={'bot-' + seed + '.svg'}>Download SVG</a>
        </div>
        <p className="status" role="status">{message}</p>
      </div>
    </section>
    <footer><div><strong>Keep this bot</strong><p>Use this URL for the same avatar on every visit.</p></div><a href={url}><code>{url}</code></a></footer>
  </main>
}
