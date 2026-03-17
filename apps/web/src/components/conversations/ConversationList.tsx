import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api } from "../../api/client";
import { useAppStore } from "../../store";

export function ConversationList() {
  const { activeChannelFilter, activeConversationId, setActiveConversation, clearUnread, unreadCounts } = useAppStore();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", activeChannelFilter],
    queryFn: () => api.getConversations(activeChannelFilter ?? undefined),
    refetchInterval: 10000,
  });

  function handleSelect(conv: any) {
    setActiveConversation(conv.id);
    clearUnread(conv.id);
  }

  return (
    <div className="w-72 flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Conversations</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-gray-500 text-sm">Loading...</div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="p-4 text-gray-500 text-sm">
            No conversations yet. Configure a channel and start receiving messages.
          </div>
        )}

        {conversations.map((conv: any) => {
          const contact = conv.contact as any;
          const unread = unreadCounts[conv.id] ?? conv.unreadCount ?? 0;
          const isActive = conv.id === activeConversationId;

          return (
            <button
              key={conv.id}
              onClick={() => handleSelect(conv)}
              className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors
                ${isActive ? "bg-indigo-600/20 border-l-2 border-l-indigo-500" : "hover:bg-gray-800/50"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-200 truncate">
                  {contact?.name ?? contact?.id ?? "Unknown"}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {unread > 0 && (
                    <span className="bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 shrink-0">{conv.channel?.name}</span>
                {conv.lastMessageBody && (
                  <>
                    <span className="text-xs text-gray-600">·</span>
                    <p className="text-xs text-gray-500 truncate">{conv.lastMessageBody}</p>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
