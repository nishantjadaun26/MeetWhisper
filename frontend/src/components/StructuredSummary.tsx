import React, { useState } from 'react';
import { MeetingAnalysis, ActionItem } from '../types/meeting';
import { formatTime } from '../utils/format';
import {
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers,
  Calendar,
  User,
  CheckSquare,
  Square
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
    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
      {/* Executive Summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-lg backdrop-blur">
        <div className="flex items-center space-x-2 mb-2 text-cyan-400">
          <Sparkles className="h-4 w-4" />
          <h3 className="font-semibold text-xs tracking-wider uppercase text-cyan-400">
            Executive Summary
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-slate-300 font-normal">
          {analysis.executive_summary}
        </p>
      </div>

      {/* Decisions */}
      {analysis.decisions_json && analysis.decisions_json.length > 0 && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4 shadow-lg">
          <div className="flex items-center space-x-2 mb-3 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <h3 className="font-semibold text-xs tracking-wider uppercase text-emerald-400">
              Key Decisions ({analysis.decisions_json.length})
            </h3>
          </div>
          <div className="space-y-2.5">
            {analysis.decisions_json.map((d, idx) => (
              <div
                key={idx}
                onClick={() => onSeek(d.timestamp_start)}
                className="group flex flex-col justify-between rounded-lg border border-emerald-900/30 bg-slate-900/70 p-3 transition hover:border-emerald-500/50 hover:bg-slate-900 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <span className="font-medium text-xs text-slate-100 group-hover:text-emerald-300 transition">
                    {d.statement}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(d.timestamp_start);
                    }}
                    className="flex shrink-0 ml-2 items-center space-x-1 rounded bg-emerald-950/60 px-1.5 py-0.5 font-mono text-[11px] text-emerald-400 border border-emerald-800/40 hover:bg-emerald-500/20"
                    title="Click to seek audio"
                  >
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatTime(d.timestamp_start)}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 italic">{d.context}</p>
                {d.speaker && (
                  <div className="mt-2 flex items-center text-[10px] text-slate-500">
                    <User className="mr-1 h-3 w-3" />
                    <span>Decided by {d.speaker}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {analysis.action_items_json && analysis.action_items_json.length > 0 && (
        <div className="rounded-xl border border-blue-900/40 bg-blue-950/10 p-4 shadow-lg">
          <div className="flex items-center space-x-2 mb-3 text-blue-400">
            <CheckSquare className="h-4 w-4" />
            <h3 className="font-semibold text-xs tracking-wider uppercase text-blue-400">
              Action Items ({analysis.action_items_json.length})
            </h3>
          </div>
          <div className="space-y-2">
            {analysis.action_items_json.map((a: ActionItem, idx: number) => {
              const isChecked = !!completedTasks[idx];
              return (
                <div
                  key={idx}
                  onClick={() => onSeek(a.timestamp_start)}
                  className={`group flex items-center justify-between rounded-lg border p-3 transition cursor-pointer ${
                    isChecked
                      ? 'border-slate-800 bg-slate-900/30 opacity-60'
                      : 'border-blue-900/30 bg-slate-900/70 hover:border-blue-500/50 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTask(idx);
                      }}
                      className="text-slate-400 hover:text-cyan-400"
                    >
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex flex-col">
                      <span
                        className={`text-xs ${
                          isChecked ? 'line-through text-slate-500' : 'text-slate-200 group-hover:text-blue-300'
                        }`}
                      >
                        {a.task}
                      </span>
                      <div className="flex items-center space-x-2 mt-1">
                        {a.owner && (
                          <span className="flex items-center text-[10px] text-blue-400">
                            <User className="mr-0.5 h-2.5 w-2.5" />
                            {a.owner}
                          </span>
                        )}
                        {a.deadline && (
                          <span className="flex items-center text-[10px] text-slate-400">
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
                    className="flex shrink-0 ml-2 items-center space-x-1 rounded bg-blue-950/60 px-1.5 py-0.5 font-mono text-[11px] text-blue-400 border border-blue-800/40 hover:bg-blue-500/20"
                    title="Click to seek audio"
                  >
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatTime(a.timestamp_start)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Open Questions */}
      {analysis.open_questions_json && analysis.open_questions_json.length > 0 && (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4 shadow-lg">
          <div className="flex items-center space-x-2 mb-3 text-amber-400">
            <HelpCircle className="h-4 w-4" />
            <h3 className="font-semibold text-xs tracking-wider uppercase text-amber-400">
              Open Questions ({analysis.open_questions_json.length})
            </h3>
          </div>
          <div className="space-y-2">
            {analysis.open_questions_json.map((q, idx) => (
              <div
                key={idx}
                onClick={() => onSeek(q.timestamp_start)}
                className="group flex items-start justify-between rounded-lg border border-amber-900/30 bg-slate-900/70 p-3 transition hover:border-amber-500/50 hover:bg-slate-900 cursor-pointer"
              >
                <div>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-amber-300">
                    {q.question}
                  </span>
                  {q.raised_by && (
                    <div className="mt-1 flex items-center text-[10px] text-slate-400">
                      <User className="mr-1 h-2.5 w-2.5" />
                      <span>Raised by {q.raised_by}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(q.timestamp_start);
                  }}
                  className="flex shrink-0 ml-2 items-center space-x-1 rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-[11px] text-amber-400 border border-amber-800/40 hover:bg-amber-500/20"
                  title="Click to seek audio"
                >
                  <Clock className="h-2.5 w-2.5" />
                  <span>{formatTime(q.timestamp_start)}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic Segments */}
      {analysis.topics_json && analysis.topics_json.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-lg">
          <div className="flex items-center space-x-2 mb-3 text-slate-300">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h3 className="font-semibold text-xs tracking-wider uppercase text-slate-300">
              Discussion Topics
            </h3>
          </div>
          <div className="space-y-2">
            {analysis.topics_json.map((t, idx) => (
              <div
                key={idx}
                onClick={() => onSeek(t.timestamp_start)}
                className="group flex items-start justify-between rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 transition hover:border-slate-700 hover:bg-slate-850 cursor-pointer"
              >
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 group-hover:text-cyan-400">
                    {t.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.summary}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(t.timestamp_start);
                  }}
                  className="flex shrink-0 ml-2 items-center space-x-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-400 hover:text-cyan-300"
                  title="Click to seek audio"
                >
                  <Clock className="h-2.5 w-2.5" />
                  <span>{formatTime(t.timestamp_start)}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
