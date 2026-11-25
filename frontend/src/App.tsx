import React from 'react'

export default function App() {
  return (
    <div className="flex h-screen w-full flex-col bg-slate-950 text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-6">
        <div className="flex items-center space-x-3">
          <div className="h-4 w-4 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
          <span className="font-semibold tracking-wider text-slate-100">MeetWhisper</span>
          <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-500/20">
            Speech Intelligence
          </span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-6 text-slate-400">
        <p>MeetWhisper Workspace</p>
      </main>
    </div>
  )
}
