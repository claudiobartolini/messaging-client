import { create } from "zustand";
import type { Message } from "@messaging/shared";

interface AppState {
  activeConversationId: string | null;
  activeChannelFilter: string | null;
  unreadCounts: Record<string, number>;
  optimisticMessages: Record<string, Message[]>;
  suggestions: Record<string, string>;

  setActiveConversation: (id: string | null) => void;
  setChannelFilter: (channelId: string | null) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
  addOptimisticMessage: (conversationId: string, message: Message) => void;
  clearOptimisticMessages: (conversationId: string) => void;
  setSuggestion: (conversationId: string, suggestion: string) => void;
  clearSuggestion: (conversationId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeConversationId: null,
  activeChannelFilter: null,
  unreadCounts: {},
  optimisticMessages: {},
  suggestions: {},

  setActiveConversation: (id) => set({ activeConversationId: id }),
  setChannelFilter: (channelId) => set({ activeChannelFilter: channelId }),

  incrementUnread: (conversationId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [conversationId]: (s.unreadCounts[conversationId] ?? 0) + 1,
      },
    })),

  clearUnread: (conversationId) =>
    set((s) => {
      const { [conversationId]: _, ...rest } = s.unreadCounts;
      return { unreadCounts: rest };
    }),

  addOptimisticMessage: (conversationId, message) =>
    set((s) => ({
      optimisticMessages: {
        ...s.optimisticMessages,
        [conversationId]: [...(s.optimisticMessages[conversationId] ?? []), message],
      },
    })),

  clearOptimisticMessages: (conversationId) =>
    set((s) => {
      const { [conversationId]: _, ...rest } = s.optimisticMessages;
      return { optimisticMessages: rest };
    }),

  setSuggestion: (conversationId, suggestion) =>
    set((s) => ({ suggestions: { ...s.suggestions, [conversationId]: suggestion } })),

  clearSuggestion: (conversationId) =>
    set((s) => {
      const { [conversationId]: _, ...rest } = s.suggestions;
      return { suggestions: rest };
    }),
}));
