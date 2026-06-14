import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import toast from "react-hot-toast";
import { api } from "../../api/client";
import { useAppStore } from "../../store";

const STATUS_CYCLE: Record<string, string> = { open: "pending", pending: "closed", closed: "open" };
const STATUS_LABELS: Record<string, string> = { open: "Open", pending: "Pending", closed: "Closed" };
const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-500/20 text-green-400 hover:bg-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30",
  closed: "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "read") {
    return <span className="text-xs text-blue-400">✓✓</span>;
  }
  if (status === "delivered") {
    return <span className="text-xs text-gray-500">✓✓</span>;
  }
  if (status === "failed") {
    return <span className="text-xs text-red-400">✗</span>;
  }
  return <span className="text-xs text-gray-500">✓</span>;
}

function DateSeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) {
    label = "Today";
  } else if (isYesterday(date)) {
    label = "Yesterday";
  } else {
    label = format(date, "MMMM d, yyyy");
  }
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-gray-800" />
      <span className="text-xs text-gray-600 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

export function MessageThread() {
  const { activeConversationId, suggestions, clearSuggestion } = useAppStore();
  const queryClient = useQueryClient();
  const suggestion = activeConversationId ? (suggestions[activeConversationId] ?? null) : null;
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", activeConversationId],
    queryFn: () => api.getMessages(activeConversationId!),
    enabled: !!activeConversationId,
  });

  // Get conversation metadata — search across all ["conversations", *] cache keys
  const allConvData = queryClient.getQueriesData<any[]>({ queryKey: ["conversations"] });
  const allConversations = allConvData.flatMap(([, data]) => data ?? []);
  const conversation = allConversations.find((c: any) => c.id === activeConversationId);

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.updateConversationStatus(activeConversationId!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    onError: () => toast.error("Could not update status"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <div className="text-center">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-sm">Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  // Build message list with date separators
  const rendered: React.ReactNode[] = [];
  let lastDate: Date | null = null;
  for (const msg of messages as any[]) {
    const msgDate = new Date(msg.sentAt);
    if (!lastDate || !isSameDay(lastDate, msgDate)) {
      rendered.push(<DateSeparator key={`sep-${msg.id}`} date={msgDate} />);
      lastDate = msgDate;
    }
    const isOutbound = msg.direction === "outbound";
    rendered.push(
      <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
        <div className="max-w-sm lg:max-w-md xl:max-w-lg">
          <div
            className={`px-4 py-2 rounded-2xl text-sm leading-relaxed
              ${isOutbound
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-gray-800 text-gray-200 rounded-bl-sm"
              }`}
          >
            {msg.body}
          </div>
          <div className={`flex items-center gap-1 mt-1 ${isOutbound ? "justify-end" : "justify-start"}`}>
            <span className="text-xs text-gray-600">
              {format(new Date(msg.sentAt), "HH:mm")}
            </span>
            {isOutbound && <StatusIcon status={msg.status} />}
          </div>
        </div>
      </div>
    );
  }

  const status: string = conversation?.status ?? "open";
  const nextStatus = STATUS_CYCLE[status] ?? "open";

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Thread header */}
      {conversation && (
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900 flex items-center gap-3">
          {/* Status toggle */}
          <button
            onClick={() => updateStatus.mutate(nextStatus)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition ${STATUS_COLORS[status] ?? STATUS_COLORS.open}`}
            title={`Click to set ${nextStatus}`}
          >
            {STATUS_LABELS[status] ?? status}
          </button>

          {/* Assignee badge (read-only) */}
          {conversation.assignedTo && (
            <span className="text-xs text-gray-400 bg-gray-700/50 px-3 py-1 rounded-full font-medium">
              {conversation.assignedTo}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {isLoading && <p className="text-gray-500 text-sm">Loading messages...</p>}
        {rendered}
        <div ref={bottomRef} />
      </div>

      {/* Sarah suggestion pane (read-only — no insert) */}
      {suggestion && (
        <div className="mx-4 mb-1 rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-indigo-400 mb-1">Sarah suggests</p>
              <p className="text-sm text-gray-300 leading-relaxed">{suggestion}</p>
            </div>
            <button
              onClick={() => activeConversationId && clearSuggestion(activeConversationId)}
              className="shrink-0 text-gray-600 hover:text-gray-400 transition text-lg leading-none mt-0.5"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Read-only notice */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900">
        <p className="text-center text-xs text-gray-600 py-1">
          Read-only — claim conversations from dg_sarah_frontend to reply
        </p>
      </div>
    </div>
  );
}
