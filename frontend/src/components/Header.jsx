import React, { useState } from 'react';
import { Brain, Database, Zap, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Header({ studentId, setStudentId, onActivateCramMode, dbStatus }) {
  const [showCramModal, setShowCramModal] = useState(false);
  const [cramDuration, setCramDuration] = useState(1); // 1 minute for fast live demo!
  const [cramTopic, setCramTopic] = useState('Python Loops');

  const handleCramSubmit = (e) => {
    e.preventDefault();
    onActivateCramMode(cramDuration, cramTopic);
    setShowCramModal(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Brain className="w-6 h-6 text-slate-950 font-bold" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Study Buddy</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Track 1: Agentic Memory
            </span>
          </div>
          <p className="text-xs text-slate-400">Adaptive AI Companion with MongoDB Atlas Persistent Memory</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* MongoDB Connection Status Badge */}
        <div className="flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300">Database:</span>
          <span className="font-semibold text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {dbStatus === 'mongodb_atlas' ? 'MongoDB Atlas (Connected)' : 'MongoDB Atlas Engine'}
          </span>
        </div>

        {/* Active Student Selector */}
        <div className="flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <span className="text-slate-400">Student:</span>
          <select 
            value={studentId} 
            onChange={(e) => setStudentId(e.target.value)}
            className="bg-slate-900 text-white font-medium rounded px-2 py-0.5 border border-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="student_rahul">Rahul (Python Beginner)</option>
            <option value="student_priya">Priya (Data Structures)</option>
          </select>
        </div>

        {/* Cram Mode Trigger (TTL Demo) */}
        <button
          onClick={() => setShowCramModal(true)}
          className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer shadow-sm"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>⚡ Toggle Cram Mode (TTL Expiry)</span>
        </button>
      </div>

      {/* Cram Mode Modal */}
      {showCramModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Activate Exam Cram Mode</h3>
                <p className="text-xs text-slate-400">Demonstrating MongoDB TTL Auto-Expiry</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Creates a temporary, intensive review memory with a strict expiration timestamp. 
              <strong> MongoDB's native TTL index </strong> will automatically purge this memory once time elapses!
            </p>

            <form onSubmit={handleCramSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Focus Subject</label>
                <input
                  type="text"
                  value={cramTopic}
                  onChange={(e) => setCramTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Duration (MongoDB TTL Auto-Purge)</label>
                <select
                  value={cramDuration}
                  onChange={(e) => setCramDuration(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  <option value={1}>1 Minute (Fast Live Demo Expiry)</option>
                  <option value={5}>5 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCramModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-all"
                >
                  Save to MongoDB with TTL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
