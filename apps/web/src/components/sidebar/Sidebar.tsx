import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAppStore } from "../../store";

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "💬",
  teams: "🔷",
};

export function Sidebar() {
  const { data } = useQuery({ queryKey: ["channels"], queryFn: api.getChannels });
  const { activeChannelFilter, setChannelFilter, setActiveConversation } = useAppStore();

  const channels = data?.channels ?? [];

  return (
    <div className="w-16 flex flex-col items-center bg-gray-950 border-r border-gray-800 py-3 gap-2">
      <button
        title="All channels"
        onClick={() => { setChannelFilter(null); setActiveConversation(null); }}
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all
          ${activeChannelFilter === null ? "bg-indigo-600" : "bg-gray-800 hover:bg-gray-700"}`}
      >
        ✉️
      </button>

      <div className="w-8 h-px bg-gray-800 my-1" />

      {channels.map((ch: any) => (
        <button
          key={ch.id}
          title={ch.name}
          onClick={() => { setChannelFilter(ch.id); setActiveConversation(null); }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all
            ${activeChannelFilter === ch.id ? "bg-indigo-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >
          {CHANNEL_ICONS[ch.type] ?? "📡"}
        </button>
      ))}

      <div className="flex-1" />

      <a
        href="/settings"
        title="Settings"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gray-800 hover:bg-gray-700 transition-all"
      >
        ⚙️
      </a>
    </div>
  );
}
