import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { api } from "../../api/client";
import { useAppStore } from "../../store";

const STATUS_FILTERS = ["all", "open", "pending", "closed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-500",
  pending: "bg-yellow-500",
  closed: "bg-gray-500",
};

export function ConversationList() {
  const { activeChannelFilter, activeConversationId, setActiveConversation, clearUnread, unreadCounts, operatorName } = useAppStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", activeChannelFilter],
    queryFn: () => api.getConversations(activeChannelFilter ?? undefined),
    refetchInterval: 10000,
  });

  const filtered = conversations.filter((conv: any) => {
    if (statusFilter !== "all" && conv.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const contact = conv.contact as any;
    const name = (contact?.name ?? contact?.id ?? "").toLowerCase();
    return name.includes(search.trim().toLowerCase());
  });

  function handleSelect(conv: any) {
    setActiveConversation(conv.id);
    clearUnread(conv.id);
  }

  function handleClaim(e: React.MouseEvent, convId: string) {
    e.stopPropagation();
    api.claimConversation(convId, operatorName).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
  }

  function handleRelease(e: React.MouseEvent, convId: string) {
    e.stopPropagation();
    api.releaseConversation(convId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
  }

  return (
    <div className="w-72 flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 space-y-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Conversations</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-gray-800 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`flex-1 text-xs py-1 rounded-lg capitalize transition
                ${statusFilter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="p-4 text-gray-500 text-sm">Loading...</div>}

        {!isLoading && filtered.length === 0 && (
          <div className="p-4 text-gray-500 text-sm">
            {search.trim() ? "No matches found." : "No conversations yet."}
          </div>
        )}

        {filtered.map((conv: any) => {
          const contact = conv.contact as any;
          const unread = unreadCounts[conv.id] ?? conv.unreadCount ?? 0;
          const isActive = conv.id === activeConversationId;
          const status: string = conv.status ?? "open";
          const isMine = conv.assignedTo === operatorName;
          const isOther = !!conv.assignedTo && !isMine;

          return (
            <button
              key={conv.id}
              onClick={() => handleSelect(conv)}
              className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors
                ${isActive ? "bg-indigo-600/20 border-l-2 border-l-indigo-500" : "hover:bg-gray-800/50"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[status] ?? "bg-gray-500"}`} />
                  <span className="text-sm font-medium text-gray-200 truncate">
                    {contact?.name ?? contact?.id ?? "Unknown"}
                  </span>
                </div>
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

              {/* Claim / Release / Assignee row */}
              <div className="mt-1.5 flex items-center gap-2">
                {!conv.assignedTo && operatorName && (
                  <button
                    onClick={(e) => handleClaim(e, conv.id)}
                    className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 transition font-medium"
                  >
                    Claim
                  </button>
                )}
                {isMine && (
                  <>
                    <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-medium">
                      You
                    </span>
                    <button
                      onClick={(e) => handleRelease(e, conv.id)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition"
                    >
                      Release
                    </button>
                  </>
                )}
                {isOther && (
                  <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded-full">
                    {conv.assignedTo}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
