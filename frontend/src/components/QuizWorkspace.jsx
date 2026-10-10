import React, { useState } from 'react';
import { Sparkles, HelpCircle, CheckCircle, XCircle, ArrowRight, BookOpen, AlertTriangle } from 'lucide-react';

export default function QuizWorkspace({ studentId, onMemoryFormed }) {
  const [topic, setTopic] = useState('Python Loops');
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [sessionCount, setSessionCount] = useState(1);

  const fetchAdaptiveQuiz = async () => {
    setLoading(true);
    setEvaluation(null);
    setSelectedOption(null);
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, topic }),
      });
      const data = await res.json();
      setQuiz(data);
    } catch (err) {
      console.error('Error fetching quiz:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!quiz || !selectedOption) return;
    setLoading(true);
    try {
      const res = await fetch('/api/quiz/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          topic,
          question_text: quiz.question,
          student_answer: selectedOption,
          correct_answer: quiz.correct_answer,
          concept_tested: quiz.concept_tested,
        }),
      });
      const result = await res.json();
      setEvaluation(result);
      if (result.new_memory_formed) {
        onMemoryFormed();
      }
    } catch (err) {
      console.error('Error evaluating answer:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextSession = () => {
    setSessionCount((prev) => prev + 1);
    fetchAdaptiveQuiz();
  };

  return (
    <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto">
      {/* Session & Topic Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Session #{sessionCount}
              </span>
              <h2 className="text-lg font-bold text-white">Interactive Learning Workspace</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a concept and generate a tailored diagnostic question.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="bg-slate-950 text-white text-xs font-medium rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="Python Loops">Python Loops & Indexing</option>
              <option value="Python Strings & Slicing">Python Strings & Slicing</option>
              <option value="Functions & Arguments">Functions & Scope</option>
              <option value="Lists & Dictionaries">Lists & Data Structures</option>
            </select>

            <button
              onClick={fetchAdaptiveQuiz}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? 'Synthesizing...' : 'Generate Adaptive Quiz'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Quiz Area */}
      {quiz ? (
        <div className="space-y-5">
          {/* In-Context Memory Recall Notice */}
          {quiz.memories_used && quiz.memories_used.length > 0 && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex items-start space-x-3 text-xs animate-fadeIn">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-emerald-300">
                  Visible Behavior Adaptation (MongoDB Vector Recall)
                </h4>
                <p className="text-slate-300 mt-1">
                  The AI retrieved your past memories from MongoDB Atlas and adapted this question:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {quiz.memories_used.map((m, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded bg-slate-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono"
                    >
                      🎯 {m.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Question Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Topic: {quiz.concept_tested}
              </span>
              {quiz.targeted_weakness && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {quiz.targeted_weakness}
                </span>
              )}
            </div>

            <h3 className="text-base font-semibold text-white mb-6 leading-relaxed">
              {quiz.question}
            </h3>

            {/* Options List */}
            <div className="space-y-3">
              {quiz.options.map((option, idx) => {
                const isSelected = selectedOption === option;
                return (
                  <button
                    key={idx}
                    disabled={evaluation !== null}
                    onClick={() => setSelectedOption(option)}
                    className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <span>{option}</span>
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500 text-slate-950 font-bold'
                          : 'border-slate-700'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Submit Action */}
            {!evaluation && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={submitAnswer}
                  disabled={!selectedOption || loading}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  {loading ? 'Evaluating...' : 'Submit Answer'}
                </button>
              </div>
            )}
          </div>

          {/* Feedback & Result Card */}
          {evaluation && (
            <div
              className={`rounded-2xl p-6 border transition-all animate-fadeIn ${
                evaluation.is_correct
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="flex items-start space-x-3">
                {evaluation.is_correct ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <div className="flex-1">
                  <h4 className="text-base font-bold text-white">
                    {evaluation.is_correct ? 'Correct! Excellent reasoning.' : 'Incorrect Answer'}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {evaluation.explanation}
                  </p>

                  {/* Highlight New Memory Formed in MongoDB */}
                  {evaluation.new_memory_formed && (
                    <div className="mt-4 p-3 bg-slate-900 border border-rose-500/30 rounded-xl">
                      <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>New Misconception Diagnosed & Stored in MongoDB!</span>
                      </div>
                      <p className="text-xs text-slate-200 mt-1 font-mono">
                        "{evaluation.new_memory_formed.content}"
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        👉 Look at the Memory Inspector on the right: this memory was just written to your MongoDB Atlas cluster!
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={nextSession}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-white text-slate-950 hover:bg-slate-200 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <span>Simulate Session #{sessionCount + 1} (Test Adaptation)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <BookOpen className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-bold text-white">Ready for your practice session?</h3>
            <p className="text-xs text-slate-400 mt-1">
              Click <strong>"Generate Adaptive Quiz"</strong> above. Study Buddy will inspect your MongoDB memories and create a problem specifically targeted to your strengths and weaknesses.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
