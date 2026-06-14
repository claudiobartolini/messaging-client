import { useSocket } from './hooks/useSocket'
import { Sidebar } from './components/sidebar/Sidebar'
import { ConversationList } from './components/conversations/ConversationList'
import { MessageThread } from './components/messages/MessageThread'
import { SettingsPage } from './components/settings/SettingsPage'

function InboxLayout() {
  useSocket()
  return (
    <div className="flex h-screen w-full overflow-hidden">
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
