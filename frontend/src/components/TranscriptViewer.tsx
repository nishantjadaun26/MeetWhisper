import React, { useState, useEffect, useRef } from 'react';
import { TranscriptSegment } from '../types/meeting';
import { formatTime } from '../utils/format';
import { Search, Clock, User, ArrowDown } from 'lucide-react';

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
}

const SPEAKER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'speaker 1': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'speaker 2': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'speaker 3': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  'speaker 4': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  default: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
};

function getSpeakerColor(speaker: string) {
  const normalized = speaker.toLowerCase().trim();
  for (const key of Object.keys(SPEAKER_COLORS)) {
    if (normalized.includes(key)) return SPEAKER_COLORS[key];
  }
  return SPEAKER_COLORS.default;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  segments,
  currentTime,
  onSeek,
}) => {
  const [filterText, setFilterText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active segment detection
  const activeSegmentIndex = segments.findIndex(
    (s) => currentTime >= s.start_time && currentTime <= s.end_time
  );

  useEffect(() => {
    if (autoScroll && activeSegmentRef.current && containerRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeSegmentIndex, autoScroll]);

  const filteredSegments = segments.filter((s) =>
    filterText ? s.text.toLowerCase().includes(filterText.toLowerCase()) || s.speaker.toLowerCase().includes(filterText.toLowerCase()) : true
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur">
      {/* Header & Search */}
      <div className="flex items-center justify-between border-b border-slate-800/80 p-3">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-sm text-slate-200">Diarized Transcript</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400 font-mono">
            {segments.length} segments
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search transcript..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 w-44 rounded-lg border border-slate-700 bg-slate-800/80 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center space-x-1 rounded-lg px-2 py-1 text-xs transition border ${
              autoScroll
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:text-slate-200'
            }`}
            title="Auto-scroll to current speaker"
          >
            <ArrowDown className="h-3 w-3" />
            <span className="text-[11px]">Follow</span>
          </button>
        </div>
      </div>

      {/* Segments list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredSegments.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-slate-500">
            No matching transcript segments
          </div>
        ) : (
          filteredSegments.map((segment, idx) => {
            const isActive = idx === activeSegmentIndex;
            const speakerColor = getSpeakerColor(segment.speaker);

            return (
              <div
                key={segment.id || idx}
                ref={isActive ? activeSegmentRef : null}
                onClick={() => onSeek(segment.start_time)}
                className={`group relative cursor-pointer rounded-lg border p-3 transition-all ${
                  isActive
                    ? 'border-cyan-500/60 bg-cyan-950/20 shadow-[0_0_12px_rgba(34,211,238,0.15)] ring-1 ring-cyan-500/30'
                    : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  {/* Speaker badge */}
                  <div className="flex items-center space-x-2">
                    <span
                      className={`flex items-center space-x-1 rounded-md px-2 py-0.5 text-xs font-medium border ${speakerColor.bg} ${speakerColor.text} ${speakerColor.border}`}
                    >
                      <User className="h-3 w-3" />
                      <span>{segment.speaker}</span>
                    </span>
                  </div>

                  {/* Timestamp badge */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(segment.start_time);
                    }}
                    className="flex items-center space-x-1 rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[11px] text-slate-400 transition hover:bg-cyan-500/20 hover:text-cyan-300"
                    title="Click to seek audio"
                  >
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatTime(segment.start_time)}</span>
                  </button>
                </div>

                {/* Text */}
                <p className={`text-xs leading-relaxed ${isActive ? 'text-slate-100 font-medium' : 'text-slate-300'}`}>
                  {segment.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
