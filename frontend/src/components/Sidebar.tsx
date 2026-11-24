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
  Video,
  Music,
  Home
} from 'lucide-react';

interface SidebarProps {
  meetings: Meeting[];
  selectedMeetingId?: string;
  onSelectMeeting: (id: string) => void;
  onDeleteMeeting: (id: string) => void;
  onNewMeetingClick: () => void;
  onGoHome?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  onDeleteMeeting,
  onNewMeetingClick,
  onGoHome,
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
      className={`relative flex flex-col border-r border-[#2E2B45] bg-[#09090F] transition-all duration-300 ease-in-out z-20 select-none ${
        collapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-4 flex h-5 w-5 items-center justify-center rounded-full border border-[#2E2B45] bg-[#09090F] text-[#B3AFCB] hover:text-[#F1EFFA] transition shadow-sm z-30"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* Header / Home & New Meeting */}
      <div className="p-3 border-b border-[#2E2B45] space-y-2">
        {onGoHome && !collapsed && (
          <button
            onClick={onGoHome}
            className="flex w-full items-center space-x-2 rounded-lg border border-[#2E2B45] bg-white/[0.02] px-3 py-1.5 text-xs font-mono text-[#B3AFCB] hover:text-[#C4B5FD] hover:border-[#C4B5FD]/40 transition"
          >
            <Home className="h-3.5 w-3.5 text-[#C4B5FD]" />
            <span>Overview & Home</span>
          </button>
        )}

        <button
          onClick={onNewMeetingClick}
          className={`flex w-full items-center justify-center space-x-2 rounded-lg border border-[#2E2B45] bg-white/[0.03] py-2 text-xs font-medium text-[#F1EFFA] transition-all duration-200 hover:bg-white/[0.08] hover:border-[#C4B5FD] active:scale-[0.98] ${
            collapsed ? 'px-0' : 'px-3'
          }`}
          title="Upload new recording"
        >
          <Plus className="h-3.5 w-3.5 text-[#C4B5FD]" />
          {!collapsed && <span>New Session</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-1 flex-col overflow-hidden animate-fade">
          {/* Search Bar */}
          <div className="p-3 border-b border-[#2E2B45]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#B3AFCB]/50" />
              <input
                type="text"
                placeholder="Search recordings..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-[#2E2B45] bg-black/40 pl-8 pr-2.5 text-xs text-[#F1EFFA] placeholder-[#B3AFCB]/40 transition focus:border-[#C4B5FD] focus:outline-none font-mono"
              />
            </div>
            {isSearching && (
              <span className="text-[10px] text-[#B3AFCB]/60 mt-1 block px-1 font-mono">Searching...</span>
            )}
          </div>

          {/* Recordings List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {searchResults ? (
              <div>
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[#B3AFCB]/60">
                  Matches ({searchResults.length})
                </div>
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#B3AFCB]/50">No results found</div>
                ) : (
                  searchResults.map((res, i) => (
                    <div
                      key={i}
                      onClick={() => onSelectMeeting(res.meeting_id)}
                      className="group cursor-pointer rounded-md p-2 hover:bg-white/[0.04] transition-colors border border-transparent hover:border-[#2E2B45]"
                    >
                      <div className="text-xs font-medium text-[#F1EFFA] truncate">
                        {res.topic_title}
                      </div>
                      <div className="text-[11px] text-[#B3AFCB] truncate mt-0.5">{res.summary}</div>
                      <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-[#B3AFCB]/60">
                        <span className="truncate">{res.meeting_title}</span>
                        <span>{formatTime(res.start_time)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div>
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[#B3AFCB]/60">
                  Recordings ({meetings.length})
                </div>
                {meetings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#B3AFCB]/50">No recordings uploaded</div>
                ) : (
                  meetings.map((m) => {
                    const isSelected = m.id === selectedMeetingId;
                    const isVid = m.mime_type?.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(m.filename);
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMeeting(m.id)}
                        className={`group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition cursor-pointer border ${
                          isSelected
                            ? 'bg-white/[0.05] text-[#F1EFFA] font-medium border-[#C4B5FD]/50'
                            : 'border-transparent text-[#B3AFCB] hover:bg-white/[0.03] hover:text-[#F1EFFA]'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0 pr-2">
                          {isVid ? (
                            <Video className="h-3.5 w-3.5 shrink-0 text-[#67E8F9]" />
                          ) : (
                            <Music className="h-3.5 w-3.5 shrink-0 text-[#C4B5FD]" />
                          )}
                          <div className="min-w-0">
                            <span className="truncate block font-medium">{m.title}</span>
                            <span className="text-[10px] font-mono text-[#B3AFCB]/60">
                              {formatTime(m.duration_seconds)}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteMeeting(m.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#B3AFCB]/60 hover:text-red-400 transition"
                          title="Delete session"
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
