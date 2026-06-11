import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
  const { activeConversationId, operatorName } = useAppStore();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", activeConversationId],
    queryFn: () => api.getMessages(activeConversationId!),
    enabled: !!activeConversationId,
  });

  // Get conversation metadata from list cache
  const conversations: any[] = queryClient.getQueryData(["conversations"]) ?? [];
  const conversation = conversations.find((c: any) => c.id === activeConversationId);
  const isMine = conversation?.assignedTo === operatorName;
  const isClaimedByOther = !!conversation?.assignedTo && !isMine;
  const isLocked = isClaimedByOther;

  const claim = useMutation({
    mutationFn: () => api.claimConversation(activeConversationId!, operatorName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    onError: () => toast.error("Could not claim conversation"),
  });

  const release = useMutation({
    mutationFn: () => api.releaseConversation(activeConversationId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    onError: () => toast.error("Could not release conversation"),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.updateConversationStatus(activeConversationId!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    onError: () => toast.error("Could not update status"),
  });

  const send = useMutation({
    mutationFn: (body: string) => api.sendMessage(activeConversationId!, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ["messages", activeConversationId] });
      const previous = queryClient.getQueryData(["messages", activeConversationId]);
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        conversationId: activeConversationId,
        direction: "outbound",
        body,
        status: "sent",
        sentAt: new Date().toISOString(),
      };
      queryClient.setQueryData(
        ["messages", activeConversationId],
        (old: any[] = []) => [...old, optimistic]
      );
      return { previous, optimisticId: optimistic.id };
    },
    onSuccess: (savedMessage: any, _vars, context) => {
      queryClient.setQueryData(
        ["messages", activeConversationId],
        (old: any[] = []) => {
          const without = old.filter(
            (m) => m.id !== context?.optimisticId && m.id !== savedMessage.id
          );
          return [...without, savedMessage];
        }
      );
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(["messages", activeConversationId], context?.previous);
      toast.error("Failed to send message");
    },
    onSettled: () => {
      // intentionally empty — onSuccess already set correct data
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const body = input.trim();
    if (!body || !activeConversationId) return;
    setInput("");
    send.mutate(body);
  }

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

          {/* Claim / assignee */}
          {!conversation.assignedTo && (
            <button
              onClick={() => claim.mutate()}
              disabled={!operatorName || claim.isPending}
              className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
            >
              Claim
            </button>
          )}
          {isMine && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full font-medium">
                Claimed by you
              </span>
              <button
                onClick={() => release.mutate()}
                disabled={release.isPending}
                className="text-xs text-gray-500 hover:text-gray-300 transition"
              >
                Release
              </button>
            </div>
          )}
          {isClaimedByOther && (
            <span className="text-xs text-gray-400 bg-gray-700/50 px-3 py-1 rounded-full font-medium">
              Claimed by {conversation.assignedTo}
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

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900">
        {isLocked ? (
          <p className="text-center text-xs text-gray-600 py-1">
            Claimed by {conversation?.assignedTo} — you cannot reply
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 text-gray-200 placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || send.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
