import React, { useState, useEffect, useRef } from 'react';
import { TranscriptSegment } from '../types/meeting';
import { formatTime } from '../utils/format';
import { Search, Clock, ArrowDown } from 'lucide-react';

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
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
    filterText
      ? s.text.toLowerCase().includes(filterText.toLowerCase()) ||
        s.speaker.toLowerCase().includes(filterText.toLowerCase())
      : true
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0e14]">
      {/* Header & Search */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Transcript
          </span>
          <span className="font-mono text-[11px] text-zinc-600">
            ({segments.length})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Find in transcript..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-7 w-36 rounded-md border border-white/[0.06] bg-black/40 pl-8 pr-2.5 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-sky-500/60 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center space-x-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
              autoScroll
                ? 'bg-white/[0.08] text-zinc-200'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Auto-scroll with playback"
          >
            <ArrowDown className="h-3 w-3" />
            <span>Follow</span>
          </button>
        </div>
      </div>

      {/* Segments list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredSegments.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-zinc-600">
            No matching segments
          </div>
        ) : (
          filteredSegments.map((segment, idx) => {
            const isActive = idx === activeSegmentIndex;

            return (
              <div
                key={segment.id || idx}
                ref={isActive ? activeSegmentRef : null}
                onClick={() => onSeek(segment.start_time)}
                className={`group relative cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200 ${
                  isActive
                    ? 'border-l-2 border-sky-400 bg-white/[0.04] pl-3.5 shadow-sm'
                    : 'border-l-2 border-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-300">
                    {segment.speaker}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(segment.start_time);
                    }}
                    className="flex items-center space-x-1 font-mono text-[10px] text-zinc-500 opacity-80 transition hover:text-sky-400 group-hover:opacity-100"
                    title="Seek audio"
                  >
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatTime(segment.start_time)}</span>
                  </button>
                </div>

                <p
                  className={`text-xs leading-relaxed transition-colors ${
                    isActive ? 'text-zinc-100 font-normal' : 'text-zinc-400'
                  }`}
                >
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
