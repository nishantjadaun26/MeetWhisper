import React, { useState } from 'react';
import { Meeting, SearchResultItem } from '../types/meeting';
import { formatTime } from '../utils/format';
import { searchMeetings } from '../services/api';
import {
  Plus,
  Search,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  meetings: Meeting[];
  selectedMeetingId?: string;
  onSelectMeeting: (id: string) => void;
  onDeleteMeeting: (id: string) => void;
  onNewMeetingClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  onDeleteMeeting,
  onNewMeetingClick,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchMeetings(query);
      setSearchResults(results);
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <aside
      className={`relative flex flex-col border-r border-slate-800 bg-slate-900/90 transition-all duration-300 z-20 ${
        collapsed ? 'w-14' : 'w-72'
      }`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-100 shadow-md"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Header & New Meeting button */}
      <div className="p-3 border-b border-slate-800">
        <button
          onClick={onNewMeetingClick}
          className={`flex w-full items-center justify-center space-x-2 rounded-xl bg-cyan-500 py-2.5 font-medium text-slate-950 transition hover:bg-cyan-400 active:scale-95 shadow-[0_0_15px_rgba(34,211,238,0.3)] ${
            collapsed ? 'px-0' : 'px-4'
          }`}
          title="Upload new audio/video"
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span className="text-xs font-semibold">New Meeting</span>}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-800/80">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search past meetings & topics..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            {isSearching && (
              <span className="text-[10px] text-cyan-400 ml-1 mt-1 block">Searching embeddings...</span>
            )}
          </div>

          {/* Meetings List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {searchResults ? (
              /* Search results mode */
              <div>
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Semantic Results ({searchResults.length})
                </div>
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No matching topics found</div>
                ) : (
                  searchResults.map((res, i) => (
                    <div
                      key={i}
                      onClick={() => onSelectMeeting(res.meeting_id)}
                      className="cursor-pointer rounded-lg border border-slate-800/60 bg-slate-950/40 p-2.5 hover:border-cyan-500/50 hover:bg-slate-800/50 transition mb-1"
                    >
                      <span className="text-xs font-medium text-slate-200 block truncate">
                        {res.topic_title}
                      </span>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{res.summary}</p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-cyan-400 font-mono">
                        <span>{res.meeting_title}</span>
                        <span>{formatTime(res.start_time)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Standard meeting list */
              <div>
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Recordings ({meetings.length})
                </div>
                {meetings.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No recordings yet</div>
                ) : (
                  meetings.map((m) => {
                    const isSelected = m.id === selectedMeetingId;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMeeting(m.id)}
                        className={`group relative flex cursor-pointer items-center justify-between rounded-lg p-2.5 transition border ${
                          isSelected
                            ? 'border-cyan-500/50 bg-cyan-950/20 text-slate-100 shadow-[0_0_10px_rgba(34,211,238,0.1)]'
                            : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate text-xs font-medium text-slate-200">
                            {m.title}
                          </span>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-1">
                            <span className="flex items-center">
                              <Clock className="mr-0.5 h-2.5 w-2.5" />
                              {formatTime(m.duration_seconds)}
                            </span>
                            <span>•</span>
                            <span>{new Date(m.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete meeting "${m.title}"?`)) {
                              onDeleteMeeting(m.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 transition"
                          title="Delete meeting"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
