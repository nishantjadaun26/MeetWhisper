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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-bg)]">
      {/* Header & Search */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
            Transcript
          </span>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]/50">
            ({segments.length})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--text-secondary)]/40" />
            <input
              type="text"
              placeholder="Find in transcript..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-7 w-36 rounded-md border border-[var(--border)] bg-[var(--input-bg)] pl-8 pr-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 transition focus:w-48 focus:border-[var(--accent-violet)] focus:outline-none font-mono"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center space-x-1 rounded-md px-2 py-1 text-[11px] font-mono transition border ${
              autoScroll
                ? 'border-[var(--accent-violet)]/40 bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]'
                : 'border-[var(--border)] text-[var(--text-secondary)]/60 hover:text-[var(--text-secondary)]'
            }`}
            title="Auto-scroll to current speaker"
          >
            <ArrowDown className="h-3 w-3" />
            <span>Follow</span>
          </button>
        </div>
      </div>

      {/* Segments List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredSegments.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-secondary)]/50">
            {segments.length === 0 ? 'No speech detected in this recording' : 'No matching results'}
          </div>
        ) : (
          filteredSegments.map((segment) => {
            const isActive =
              currentTime >= segment.start_time && currentTime <= segment.end_time;

            return (
              <div
                key={segment.id}
                ref={isActive ? activeSegmentRef : null}
                onClick={() => onSeek(segment.start_time)}
                className={`group cursor-pointer rounded-lg border p-3 transition-all duration-150 ${
                  isActive
                    ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/[0.08] shadow-sm'
                    : 'border-[var(--border)]/70 bg-[var(--card-bg)] hover:border-[var(--accent-violet)]/70 hover:bg-[var(--card-hover-bg)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-semibold ${
                        isActive ? 'text-[var(--accent-cyan)]' : 'text-[var(--accent-violet)]'
                      }`}
                    >
                      {segment.speaker}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(segment.start_time);
                    }}
                    className={`flex items-center space-x-1 font-mono text-[10px] transition ${
                      isActive ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)]/60 group-hover:text-[var(--accent-cyan)]'
                    }`}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatTime(segment.start_time)}</span>
                  </button>
                </div>

                <p
                  className={`text-xs leading-relaxed transition ${
                    isActive ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'
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
