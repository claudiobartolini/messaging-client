import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";

type Channel = {
  id: string;
  type: string;
  name: string;
  config: Record<string, string>;
  isActive: boolean;
  createdAt: string;
};

type ConfigField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
};

type AvailableType = {
  type: string;
  fields: ConfigField[];
};

const inputCls =
  "w-full bg-gray-800 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500";
const labelCls = "block text-xs text-gray-400 mb-1.5";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["channels"], queryFn: api.getChannels });

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [addForm, setAddForm] = useState<Record<string, string>>({ name: "" });

  // Edit state
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Copy webhook URL feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const availableTypes: AvailableType[] = data?.availableTypes ?? [];
  const channels: Channel[] = data?.channels ?? [];
  const selectedTypeDef = availableTypes.find((t) => t.type === selectedType);
  const editingTypeDef = availableTypes.find((t) => t.type === editingChannel?.type);

  const addChannel = useMutation({
    mutationFn: () =>
      api.createChannel({ type: selectedType, name: addForm.name, config: addForm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setShowAdd(false);
      setAddForm({ name: "" });
      setSelectedType("");
    },
  });

  const updateChannel = useMutation({
    mutationFn: () => {
      const { name, ...config } = editForm;
      return api.updateChannel(editingChannel!.id, { name, config });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setEditingChannel(null);
      setEditForm({});
    },
  });

  const deleteChannel = useMutation({
    mutationFn: (id: string) => api.deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setDeletingId(null);
    },
  });

  const toggleChannel = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateChannel(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });

  function startEdit(ch: Channel) {
    setEditingChannel(ch);
    setEditForm({ name: ch.name, ...ch.config });
    setShowAdd(false);
    setDeletingId(null);
  }

  function cancelEdit() {
    setEditingChannel(null);
    setEditForm({});
  }

  function copyWebhookUrl(ch: Channel) {
    const url = `${window.location.origin}/webhooks/${ch.type}`;
    navigator.clipboard.writeText(url);
    setCopiedId(ch.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">Channel Management</h1>
            <p className="text-sm text-gray-500 mt-1">Add, configure, and manage messaging channels</p>
          </div>
          <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
            ← Back to inbox
          </a>
        </div>

        {/* Channel list */}
        <div className="space-y-3 mb-6">
          {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}
          {!isLoading && channels.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-8">No channels yet. Add one below.</p>
          )}

          {channels.map((ch) => (
            <div
              key={ch.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {/* Channel row */}
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200">{ch.name}</span>
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                      {ch.type}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        ch.isActive
                          ? "bg-green-900/50 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {ch.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 font-mono truncate">
                      {window.location.origin}/webhooks/{ch.type}
                    </span>
                    <button
                      onClick={() => copyWebhookUrl(ch)}
                      className="text-xs text-gray-500 hover:text-indigo-400 transition shrink-0"
                    >
                      {copiedId === ch.id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      editingChannel?.id === ch.id ? cancelEdit() : startEdit(ch)
                    }
                    className={`text-xs px-3 py-1.5 rounded-lg transition ${
                      editingChannel?.id === ch.id
                        ? "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30"
                        : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                    }`}
                  >
                    {editingChannel?.id === ch.id ? "Close" : "Edit"}
                  </button>
                  <button
                    onClick={() => toggleChannel.mutate({ id: ch.id, isActive: !ch.isActive })}
                    className="text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
                  >
                    {ch.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => setDeletingId(deletingId === ch.id ? null : ch.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition ${
                      deletingId === ch.id
                        ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                        : "bg-gray-800 text-red-400 hover:text-red-300 hover:bg-gray-700"
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Inline delete confirmation */}
              {deletingId === ch.id && (
                <div className="border-t border-gray-800 bg-red-950/20 px-4 py-3 flex items-center justify-between gap-4">
                  <p className="text-xs text-red-300">
                    Delete <span className="font-semibold">{ch.name}</span>? All conversations and
                    messages will be permanently removed.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => deleteChannel.mutate(ch.id)}
                      disabled={deleteChannel.isPending}
                      className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      {deleteChannel.isPending ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Inline edit form */}
              {editingChannel?.id === ch.id && (
                <div className="border-t border-gray-800 p-4 space-y-4">
                  <p className="text-xs text-gray-500">Edit channel configuration</p>

                  <div>
                    <label className={labelCls}>Display name</label>
                    <input
                      type="text"
                      value={editForm.name ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputCls}
                    />
                  </div>

                  {editingTypeDef?.fields.map((field) => (
                    <div key={field.name}>
                      <label className={labelCls}>
                        {field.label}
                        {field.required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      <input
                        type={field.type === "password" ? "password" : "text"}
                        value={editForm[field.name] ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, [field.name]: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                  ))}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => updateChannel.mutate()}
                      disabled={!editForm.name || updateChannel.isPending}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium transition"
                    >
                      {updateChannel.isPending ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add channel */}
        {!showAdd ? (
          <button
            onClick={() => {
              setShowAdd(true);
              setEditingChannel(null);
              setDeletingId(null);
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium transition"
          >
            + Add Channel
          </button>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">Add a new channel</h3>

            <div>
              <label className={labelCls}>Channel type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select type…</option>
                {availableTypes.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Display name</label>
              <input
                type="text"
                value={addForm.name ?? ""}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. My WhatsApp"
                className={inputCls}
              />
            </div>

            {selectedTypeDef?.fields.map((field) => (
              <div key={field.name}>
                <label className={labelCls}>
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <input
                  type={field.type === "password" ? "password" : "text"}
                  value={addForm[field.name] ?? ""}
                  onChange={(e) => setAddForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  className={inputCls}
                />
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => addChannel.mutate()}
                disabled={!selectedType || !addForm.name || addChannel.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium transition"
              >
                {addChannel.isPending ? "Adding…" : "Add Channel"}
              </button>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setSelectedType("");
                  setAddForm({ name: "" });
                }}
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
