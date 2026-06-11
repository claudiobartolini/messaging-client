import { useState } from 'react'
import { useSocket } from './hooks/useSocket'
import { Sidebar } from './components/sidebar/Sidebar'
import { ConversationList } from './components/conversations/ConversationList'
import { MessageThread } from './components/messages/MessageThread'
import { SettingsPage } from './components/settings/SettingsPage'
import { useAppStore } from './store'

function NamePrompt() {
  const { setOperatorName } = useAppStore()
  const [value, setValue] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = value.trim()
    if (name) setOperatorName(name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-80 space-y-4 shadow-2xl"
      >
        <h2 className="text-white text-lg font-semibold">Welcome</h2>
        <p className="text-gray-400 text-sm">Enter your name so colleagues can see who has claimed a conversation.</p>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
          className="w-full bg-gray-800 text-gray-200 placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition"
        >
          Continue
        </button>
      </form>
    </div>
  )
}

function InboxLayout() {
  useSocket()
  const { operatorName } = useAppStore()
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {!operatorName && <NamePrompt />}
      <Sidebar />
      <ConversationList />
      <MessageThread />
    </div>
  )
}

export default function App() {
  const isSettings = window.location.pathname === '/settings'
  return isSettings ? <SettingsPage /> : <InboxLayout />
}
