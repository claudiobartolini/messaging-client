import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
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
      // Update messages cache
      queryClient.setQueryData(
        ["messages", message.conversationId],
        (old: any[] = []) => [...old, message]
      );
      // Update conversations cache
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // Increment unread if not active conversation
      if (activeConvRef.current !== message.conversationId) {
        incrementUnread(message.conversationId);
      }
    });

    socket.on("conversation:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    return () => {
      socket?.off("message:new");
      socket?.off("conversation:updated");
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
