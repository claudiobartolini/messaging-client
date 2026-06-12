import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import { useAppStore } from "../../store";

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "💬",
  teams: "🔷",
};

export function Sidebar() {
  const { data } = useQuery({ queryKey: ["channels"], queryFn: api.getChannels });
  const { activeChannelFilter, setChannelFilter, setActiveConversation, operatorName, setOperatorName } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const initials = operatorName
    ? operatorName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

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

      {/* Operator identity */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={() => { setNameValue(operatorName); setEditing(true); }}
          title={operatorName || "Set your name"}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold bg-indigo-700 hover:bg-indigo-600 text-white transition-all"
        >
          {initials}
        </button>
        {editing && (
          <div className="absolute bottom-12 left-0 z-50 bg-gray-900 border border-gray-700 rounded-xl p-3 w-48 shadow-2xl">
            <p className="text-xs text-gray-400 mb-2">Change your name</p>
            <input
              autoFocus
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setOperatorName(nameValue.trim()); setEditing(false); }
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setOperatorName(nameValue.trim()); setEditing(false); }}
                disabled={!nameValue.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-1 text-xs font-medium transition"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg py-1 text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

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
