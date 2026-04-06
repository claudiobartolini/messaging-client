import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAppStore } from "../store";

let socket: Socket | null = null;

export function useSocket() {
  const queryClient = useQueryClient();
  const { activeConversationId, incrementUnread } = useAppStore();
  const activeConvRef = useRef(activeConversationId);
  activeConvRef.current = activeConversationId;

  useEffect(() => {
    if (!socket) {
      socket = io({ path: "/socket.io" });
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
