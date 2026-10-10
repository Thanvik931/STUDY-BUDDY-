import React, { useState } from 'react';
import { Database, RefreshCw, Check, Trash2, Edit3, Award, Clock, AlertCircle, Sparkles } from 'lucide-react';

export default function MemoryInspector({ memories, onRefresh, studentId }) {
  const [editingMemory, setEditingMemory] = useState(null);
  const [editText, setEditText] = useState('');

  const handleMarkMastered = async (id) => {
    try {
      await fetch(`/api/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'mastered' }),
      });
      onRefresh();
    } catch (err) {
      console.error('Error marking as mastered:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
      });
      onRefresh();
    } catch (err) {
      console.error('Error deleting memory:', err);
    }
  };

  const startEdit = (memory) => {
    setEditingMemory(memory);
    setEditText(memory.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMemory) return;
    try {
      await fetch(`/api/memories/${editingMemory._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editingMemory.status, content: editText }),
      });
      setEditingMemory(null);
      onRefresh();
    } catch (err) {
      console.error('Error updating memory:', err);
    }
  };

  const activeCount = memories.filter((m) => m.status === 'active').length;
  const masteredCount = memories.filter((m) => m.status === 'mastered').length;
  const ttlCount = memories.filter((m) => m.expires_at !== null).length;

  return (
    <div className="w-full lg:w-[480px] bg-slate-900 border-l border-slate-800 p-6 flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Agentic Memory Inspector</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                MongoDB Atlas
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Live persistent documents queried via Vector Search
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          title="Sync with MongoDB"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-3 gap-2 my-4">
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
          <div className="text-xs font-semibold text-slate-400">Active</div>
          <div className="text-base font-bold text-rose-400">{activeCount}</div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
          <div className="text-xs font-semibold text-slate-400">Mastered</div>
          <div className="text-base font-bold text-emerald-400">{masteredCount}</div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
          <div className="text-xs font-semibold text-slate-400">TTL Active</div>
          <div className="text-base font-bold text-amber-400">{ttlCount}</div>
        </div>
      </div>

      {/* Memory Document List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {memories.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No memories formed yet. Submit a quiz question to see memories populate!
          </div>
        ) : (
          memories.map((m) => {
            const isMastered = m.status === 'mastered';
            const isTTL = Boolean(m.expires_at);

            return (
              <div
                key={m._id}
                className={`p-4 rounded-xl border transition-all text-xs ${
                  isMastered
                    ? 'bg-slate-950/40 border-slate-800 opacity-70'
                    : isTTL
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    {isMastered ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-[10px] flex items-center gap-1 border border-emerald-500/30">
                        <Award className="w-3 h-3" /> Mastered
                      </span>
                    ) : isTTL ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-[10px] flex items-center gap-1 border border-amber-500/30 animate-pulse">
                        <Clock className="w-3 h-3" /> TTL Expiry Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold text-[10px] flex items-center gap-1 border border-rose-500/30">
                        <AlertCircle className="w-3 h-3" /> Misconception
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500 font-mono">
                      {m.topic}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono">
                    id: {String(m._id).slice(-4)}
                  </span>
                </div>

                {/* Content */}
                <h4 className="font-semibold text-white text-xs mb-1">
                  {m.title}
                </h4>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {m.content}
                </p>

                {/* TTL Notice */}
                {m.expires_at && (
                  <div className="mt-2 text-[10px] text-amber-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Auto-deletes via MongoDB TTL index</span>
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-2">
                    {!isMastered && (
                      <button
                        onClick={() => handleMarkMastered(m._id)}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Mark Mastered
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(m)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  </div>

                  <button
                    onClick={() => handleDelete(m._id)}
                    title="Delete Memory (GDPR)"
                    className="text-rose-400/70 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Memory Modal */}
      {editingMemory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              Correct Memory Diagnosis
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Edit what Study Buddy remembers about you in MongoDB Atlas:
            </p>
            <textarea
              rows={4}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setEditingMemory(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg"
              >
                Update in MongoDB
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
