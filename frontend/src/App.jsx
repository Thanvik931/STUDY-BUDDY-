import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import QuizWorkspace from './components/QuizWorkspace';
import MemoryInspector from './components/MemoryInspector';

export default function App() {
  const [studentId, setStudentId] = useState('student_rahul');
  const [memories, setMemories] = useState([]);
  const [dbStatus, setDbStatus] = useState('loading');

  const fetchMemories = async () => {
    try {
      const res = await fetch(`/api/memories?student_id=${studentId}`);
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (err) {
      console.error('Error fetching memories:', err);
    }
  };

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setDbStatus(data.database);
    } catch (err) {
      setDbStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
    fetchMemories();
  }, [studentId]);

  const handleActivateCramMode = async (durationMinutes, focusTopic) => {
    try {
      await fetch('/api/cram-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          duration_minutes: durationMinutes,
          focus_topic: focusTopic,
        }),
      });
      fetchMemories();
    } catch (err) {
      console.error('Error activating cram mode:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        studentId={studentId}
        setStudentId={setStudentId}
        onActivateCramMode={handleActivateCramMode}
        dbStatus={dbStatus}
      />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Quiz & Adaptive Learning */}
        <QuizWorkspace
          studentId={studentId}
          onMemoryFormed={fetchMemories}
        />

        {/* Right Panel: MongoDB Agentic Memory Inspector */}
        <MemoryInspector
          memories={memories}
          onRefresh={fetchMemories}
          studentId={studentId}
        />
      </main>
    </div>
  );
}
