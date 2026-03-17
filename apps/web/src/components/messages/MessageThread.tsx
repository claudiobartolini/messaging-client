import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { api } from "../../api/client";
import { useAppStore } from "../../store";

export function MessageThread() {
  const { activeConversationId } = useAppStore();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", activeConversationId],
    queryFn: () => api.getMessages(activeConversationId!),
    enabled: !!activeConversationId,
  });

  const send = useMutation({
    mutationFn: (body: string) => api.sendMessage(activeConversationId!, body),
    onMutate: async (body) => {
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
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {isLoading && <p className="text-gray-500 text-sm">Loading messages...</p>}

        {messages.map((msg: any) => {
          const isOutbound = msg.direction === "outbound";
          return (
            <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-sm lg:max-w-md xl:max-w-lg`}>
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
                  {isOutbound && (
                    <span className="text-xs text-gray-600">
                      {msg.status === "read" ? "✓✓" : msg.status === "delivered" ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900">
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
      </div>
    </div>
  );
}
