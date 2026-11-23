import React, { useState } from 'react';
import { MeetingAnalysis } from '../types/meeting';
import { formatTime } from '../utils/format';
import {
  Clock,
  User,
  Calendar,
  Check,
  FileText,
  Loader2
} from 'lucide-react';

interface StructuredSummaryProps {
  analysis: MeetingAnalysis;
  onSeek: (time: number) => void;
  onGenerateNotes?: () => void;
  isGenerating?: boolean;
}

export const StructuredSummary: React.FC<StructuredSummaryProps> = ({
  analysis,
  onSeek,
  onGenerateNotes,
  isGenerating,
}) => {
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({});

  const toggleTask = (index: number) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const hasNotes = Boolean(
    (analysis.executive_summary && analysis.executive_summary.trim().length > 0) ||
    (analysis.decisions_json && analysis.decisions_json.length > 0)
  );

  if (!hasNotes) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-fade">
        <div className="h-10 w-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 mb-3">
          <FileText className="h-5 w-5 text-sky-400" />
        </div>
        <h3 className="text-xs font-semibold text-zinc-200 mb-1">Notes & Summary Not Generated</h3>
        <p className="text-[11px] text-zinc-500 max-w-xs mb-4">
          You chose Flowchart Only during upload. You can generate executive summary, decisions, and action items on demand.
        </p>
        {onGenerateNotes && (
          <button
            onClick={onGenerateNotes}
            disabled={isGenerating}
            className="flex items-center space-x-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 transition active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            <span>{isGenerating ? 'Generating Notes...' : 'Generate Notes & Summary'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-2 animate-slide-up">
      {/* Executive Summary */}
      {analysis.executive_summary && (
        <section className="rounded-xl border border-white/[0.06] bg-[#0c0e14] p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Overview
          </h3>
          <p className="text-xs leading-relaxed text-zinc-300">
            {analysis.executive_summary}
          </p>
        </section>
      )}

      {/* Decisions */}
      {analysis.decisions_json && analysis.decisions_json.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Decisions ({analysis.decisions_json.length})
            </h3>
          </div>

          <div className="space-y-1.5">
            {analysis.decisions_json.map((d, idx) => (
              <div
                key={idx}
                onClick={() => onSeek(d.timestamp_start)}
                className="group cursor-pointer rounded-lg border border-white/[0.05] bg-[#0c0e14] p-3 transition-all duration-150 hover:border-white/[0.12] hover:bg-white/[0.02]"
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-zinc-200 group-hover:text-white transition">
                    {d.statement}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(d.timestamp_start);
                    }}
                    className="flex shrink-0 ml-3 items-center space-x-1 font-mono text-[10px] text-zinc-500 hover:text-sky-400"
                    title="Seek audio"
                  >
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatTime(d.timestamp_start)}</span>
                  </button>
                </div>

                <p className="mt-1 text-[11px] text-zinc-400">
                  {d.context}
                </p>

                {d.speaker && (
                  <div className="mt-2 flex items-center text-[10px] text-zinc-500 font-mono">
                    <User className="mr-1 h-2.5 w-2.5" />
                    <span>{d.speaker}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action Items */}
      {analysis.action_items_json && analysis.action_items_json.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Action Items ({analysis.action_items_json.length})
            </h3>
          </div>

          <div className="space-y-1.5">
            {analysis.action_items_json.map((a, idx) => {
              const isChecked = completedTasks[idx] || false;
              return (
                <div
                  key={idx}
                  className={`group flex items-start space-x-3 rounded-lg border border-white/[0.05] bg-[#0c0e14] p-3 transition-all duration-150 hover:border-white/[0.12] hover:bg-white/[0.02] ${
                    isChecked ? 'opacity-50' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleTask(idx)}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      isChecked
                        ? 'border-sky-500 bg-sky-500 text-black'
                        : 'border-zinc-700 bg-white/[0.02] hover:border-zinc-500'
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium transition ${
                        isChecked ? 'line-through text-zinc-500' : 'text-zinc-200'
                      }`}
                    >
                      {a.task}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[10px] text-zinc-500">
                      {a.owner && (
                        <div className="flex items-center">
                          <User className="mr-1 h-2.5 w-2.5" />
                          <span>{a.owner}</span>
                        </div>
                      )}
                      {a.deadline && (
                        <div className="flex items-center text-amber-500/80">
                          <Calendar className="mr-1 h-2.5 w-2.5" />
                          <span>{a.deadline}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onSeek(a.timestamp_start)}
                    className="flex shrink-0 items-center space-x-1 font-mono text-[10px] text-zinc-500 hover:text-sky-400"
                    title="Seek audio"
                  >
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatTime(a.timestamp_start)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Open Questions */}
      {analysis.open_questions_json && analysis.open_questions_json.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Questions ({analysis.open_questions_json.length})
            </h3>
          </div>

          <div className="space-y-1.5">
            {analysis.open_questions_json.map((q, idx) => (
              <div
                key={idx}
                onClick={() => onSeek(q.timestamp_start)}
                className="group flex items-start justify-between rounded-lg border border-white/[0.05] bg-[#0c0e14] p-3 transition-all duration-150 hover:border-white/[0.12] hover:bg-white/[0.02] cursor-pointer"
              >
                <div>
                  <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
                    {q.question}
                  </span>
                  {q.raised_by && (
                    <div className="mt-1 flex items-center text-[10px] text-zinc-500 font-mono">
                      <User className="mr-1 h-2.5 w-2.5" />
                      <span>{q.raised_by}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(q.timestamp_start);
                  }}
                  className="flex shrink-0 ml-3 items-center space-x-1 font-mono text-[10px] text-zinc-500 hover:text-sky-400"
                  title="Seek audio"
                >
                  <Clock className="h-2.5 w-2.5" />
                  <span>{formatTime(q.timestamp_start)}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
