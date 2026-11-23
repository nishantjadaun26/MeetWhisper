import React, { useState } from 'react';
import { MeetingAnalysis, ActionItem } from '../types/meeting';
import { formatTime } from '../utils/format';
import {
  Clock,
  User,
  Calendar,
  Check,
} from 'lucide-react';

interface StructuredSummaryProps {
  analysis: MeetingAnalysis;
  onSeek: (time: number) => void;
}

export const StructuredSummary: React.FC<StructuredSummaryProps> = ({
  analysis,
  onSeek,
}) => {
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({});

  const toggleTask = (index: number) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-2 animate-slide-up">
      {/* Executive Summary */}
      <section className="rounded-xl border border-white/[0.06] bg-[#0c0e14] p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
          Overview
        </h3>
        <p className="text-xs leading-relaxed text-zinc-300">
          {analysis.executive_summary}
        </p>
      </section>

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
                <p className="text-[11px] text-zinc-500 mt-1">{d.context}</p>
                {d.speaker && (
                  <div className="mt-1.5 flex items-center text-[10px] text-zinc-500 font-mono">
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
              Actions ({analysis.action_items_json.length})
            </h3>
          </div>

          <div className="space-y-1.5">
            {analysis.action_items_json.map((a: ActionItem, idx: number) => {
              const isChecked = !!completedTasks[idx];
              return (
                <div
                  key={idx}
                  onClick={() => onSeek(a.timestamp_start)}
                  className={`group flex items-center justify-between rounded-lg border p-3 transition-all duration-150 cursor-pointer ${
                    isChecked
                      ? 'border-white/[0.03] bg-black/20 opacity-50'
                      : 'border-white/[0.05] bg-[#0c0e14] hover:border-white/[0.12] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTask(idx);
                      }}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked
                          ? 'border-emerald-500/80 bg-emerald-500/20 text-emerald-400'
                          : 'border-white/[0.2] hover:border-white/[0.4]'
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </button>

                    <div className="flex flex-col">
                      <span
                        className={`text-xs transition-all ${
                          isChecked ? 'line-through text-zinc-500' : 'text-zinc-200 group-hover:text-white'
                        }`}
                      >
                        {a.task}
                      </span>
                      <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-zinc-500 font-mono">
                        {a.owner && (
                          <span className="flex items-center">
                            <User className="mr-0.5 h-2.5 w-2.5" />
                            {a.owner}
                          </span>
                        )}
                        {a.deadline && (
                          <span className="flex items-center">
                            <Calendar className="mr-0.5 h-2.5 w-2.5" />
                            {a.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(a.timestamp_start);
                    }}
                    className="flex shrink-0 ml-3 items-center space-x-1 font-mono text-[10px] text-zinc-500 hover:text-sky-400"
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
