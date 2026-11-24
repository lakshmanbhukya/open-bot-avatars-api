'use client'

import dynamic from 'next/dynamic'

const Studio = dynamic(() => import('./studio/App').then(module => module.App), {
  ssr: false,
  loading: () => <div className="studio-loading" role="status">Loading OpenBot Avatars API...</div>
})

export default function Home() {
  return <Studio />
}
