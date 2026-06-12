import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAppStore } from "../store";
import { api } from "../api/client";

let socket: Socket | null = null;

// Request browser notification permission once
if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

export function useSocket() {
  const queryClient = useQueryClient();
  const { activeConversationId, incrementUnread, operatorName } = useAppStore();
  const activeConvRef = useRef(activeConversationId);
  const operatorNameRef = useRef(operatorName);
  activeConvRef.current = activeConversationId;
  operatorNameRef.current = operatorName;

  useEffect(() => {
    if (!socket) {
      socket = io(import.meta.env.VITE_API_URL ?? "", { path: "/socket.io" });
    }

    socket.on("message:new", (message: any) => {
      // Deduplicate — skip if already in cache (e.g. optimistic-swapped)
      queryClient.setQueryData(
        ["messages", message.conversationId],
        (old: any[] = []) => {
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        }
      );
      // Update conversations cache
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // Increment unread if not active conversation
      if (activeConvRef.current !== message.conversationId) {
        incrementUnread(message.conversationId);
      }

      // Notify operator of new unclaimed inbound messages
      if (message.direction === "inbound" && activeConvRef.current !== message.conversationId) {
        // getQueriesData matches all ["conversations", *] keys regardless of channel filter
        const allConvData = queryClient.getQueriesData<any[]>({ queryKey: ["conversations"] });
        const allConversations = allConvData.flatMap(([, data]) => data ?? []);
        const conv = allConversations.find((c: any) => c.id === message.conversationId);
        if (!conv?.assignedTo) {
          console.log("[notify] firing notification for", message.conversationId, "perm:", Notification.permission);
          const contactName = (conv?.contact as any)?.name ?? (conv?.contact as any)?.id ?? "Unknown";
          const channelName = conv?.channel?.name ?? conv?.channel?.type ?? "";
          const notifBody = `${message.body ?? "New message"} — via ${channelName}`;

          const convId = conv?.id ?? message.conversationId;

          if (Notification.permission === "granted") {
            const n = new Notification(`New message from ${contactName}`, {
              body: notifBody,
              tag: convId,
            });
            n.onclick = () => {
              window.focus();
              if (operatorNameRef.current) {
                api.claimConversation(convId, operatorNameRef.current).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["conversations"] });
                  useAppStore.getState().setActiveConversation(convId);
                }).catch(() => {});
              } else {
                useAppStore.getState().setActiveConversation(convId);
              }
              n.close();
            };
          } else {
            toast(
              (t) => (
                <span>
                  <strong>{contactName}</strong>: {message.body ?? "New message"}
                  {operatorNameRef.current && (
                    <button
                      className="ml-2 text-indigo-400 underline text-xs"
                      onClick={() => {
                        api.claimConversation(convId, operatorNameRef.current).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["conversations"] });
                          useAppStore.getState().setActiveConversation(convId);
                        }).catch(() => {});
                        toast.dismiss(t.id);
                      }}
                    >
                      Claim
                    </button>
                  )}
                </span>
              ),
              { duration: 8000 }
            );
          }
        }
      }
    });

    socket.on("message:updated", (message: any) => {
      queryClient.setQueryData(
        ["messages", message.conversationId],
        (old: any[] = []) =>
          old.map((m) => (m.id === message.id ? message : m))
      );
    });

    socket.on("conversation:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    socket.on("suggestion:new", (payload: { conversationId: string; suggestion: string }) => {
      useAppStore.getState().setSuggestion(payload.conversationId, payload.suggestion);
    });

    socket.on("disconnect", () => {
      toast.error("Disconnected from server", { id: "socket-disconnect" });
    });

    socket.on("connect", () => {
      toast.dismiss("socket-disconnect");
    });

    return () => {
      socket?.off("message:new");
      socket?.off("message:updated");
      socket?.off("conversation:updated");
      socket?.off("suggestion:new");
      socket?.off("disconnect");
      socket?.off("connect");
    };
  }, [queryClient, incrementUnread]);

  useEffect(() => {
    if (!socket || !activeConversationId) return;
    socket.emit("join:conversation", activeConversationId);
    return () => {
      socket?.emit("leave:conversation", activeConversationId);
    };
  }, [activeConversationId]);

  return socket;
}
