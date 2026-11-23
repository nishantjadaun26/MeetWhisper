import React, { useState } from 'react';
import { Meeting, SearchResultItem } from '../types/meeting';
import { formatTime } from '../utils/format';
import { searchMeetings } from '../services/api';
import {
  Plus,
  Search,
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
      className={`relative flex flex-col border-r border-white/[0.06] bg-[#0c0e14] transition-all duration-300 ease-in-out z-20 select-none ${
        collapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-4 flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.1] bg-[#141824] text-zinc-400 hover:text-white transition shadow-sm"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* New Meeting action */}
      <div className="p-3 border-b border-white/[0.04]">
        <button
          onClick={onNewMeetingClick}
          className={`flex w-full items-center justify-center space-x-2 rounded-lg border border-white/[0.1] bg-white/[0.03] py-2 text-xs font-medium text-zinc-200 transition-all duration-200 hover:bg-white/[0.08] hover:border-white/[0.2] active:scale-[0.98] ${
            collapsed ? 'px-0' : 'px-3'
          }`}
          title="Upload new recording"
        >
          <Plus className="h-3.5 w-3.5 text-zinc-300" />
          {!collapsed && <span>New Session</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-1 flex-col overflow-hidden animate-fade">
          {/* Search Bar */}
          <div className="p-3 border-b border-white/[0.04]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-white/[0.06] bg-black/30 pl-8 pr-2.5 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-sky-500/60 focus:bg-black/50 focus:outline-none"
              />
            </div>
            {isSearching && (
              <span className="text-[10px] text-zinc-500 mt-1 block px-1">Searching...</span>
            )}
          </div>

          {/* Recordings List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {searchResults ? (
              <div>
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Matches ({searchResults.length})
                </div>
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-600">No results found</div>
                ) : (
                  searchResults.map((res, i) => (
                    <div
                      key={i}
                      onClick={() => onSelectMeeting(res.meeting_id)}
                      className="group cursor-pointer rounded-md p-2 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">
                        {res.topic_title}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate mt-0.5">{res.summary}</div>
                      <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-zinc-500">
                        <span className="truncate">{res.meeting_title}</span>
                        <span>{formatTime(res.start_time)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div>
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Recordings
                </div>
                {meetings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-600">No recordings</div>
                ) : (
                  meetings.map((m) => {
                    const isSelected = m.id === selectedMeetingId;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMeeting(m.id)}
                        className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 transition-all duration-150 ${
                          isSelected
                            ? 'bg-white/[0.08] text-white font-medium'
                            : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-1">
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              isSelected ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-zinc-600'
                            }`}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs">{m.title}</span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {formatTime(m.duration_seconds)}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete recording "${m.title}"?`)) {
                              onDeleteMeeting(m.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
