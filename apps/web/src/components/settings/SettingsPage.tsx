import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["channels"], queryFn: api.getChannels });

  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [form, setForm] = useState<Record<string, string>>({ name: "" });

  const availableTypes = data?.availableTypes ?? [];
  const channels = data?.channels ?? [];
  const selectedTypeDef = availableTypes.find((t: any) => t.type === selectedType);

  const addChannel = useMutation({
    mutationFn: () => api.createChannel({ type: selectedType, name: form.name, config: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setShowAdd(false);
      setForm({ name: "" });
      setSelectedType("");
    },
  });

  const deleteChannel = useMutation({
    mutationFn: (id: string) => api.deleteChannel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });

  const toggleChannel = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateChannel(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">Channel Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Configure messaging channels</p>
          </div>
          <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300">← Back to inbox</a>
        </div>

        {/* Existing channels */}
        <div className="space-y-3 mb-6">
          {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}
          {channels.map((ch: any) => (
            <div key={ch.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">{ch.name}</span>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{ch.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ch.isActive ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                    {ch.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleChannel.mutate({ id: ch.id, isActive: !ch.isActive })}
                  className="text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
                >
                  {ch.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => deleteChannel.mutate(ch.id)}
                  className="text-xs text-red-400 hover:text-red-300 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add channel */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium transition"
          >
            + Add Channel
          </button>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">Add a new channel</h3>

            {/* Channel type picker */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Channel type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select type...</option>
                {availableTypes.map((t: any) => (
                  <option key={t.type} value={t.type}>{t.type}</option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Display name</label>
              <input
                type="text"
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. My WhatsApp"
                className="w-full bg-gray-800 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Dynamic config fields */}
            {selectedTypeDef?.fields.map((field: any) => (
              <div key={field.name}>
                <label className="block text-xs text-gray-400 mb-1.5">
                  {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <input
                  type={field.type === "password" ? "password" : "text"}
                  value={form[field.name] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  className="w-full bg-gray-800 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => addChannel.mutate()}
                disabled={!selectedType || !form.name || addChannel.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium transition"
              >
                {addChannel.isPending ? "Adding..." : "Add Channel"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setSelectedType(""); setForm({ name: "" }); }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
