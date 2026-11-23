import { useState, useEffect, useRef } from 'react';
import {
  fetchMeetings,
  fetchMeetingDetail,
  deleteMeeting,
  getAudioUrl
} from './services/api';
import { Meeting, MeetingDetail } from './types/meeting';
import { Sidebar } from './components/Sidebar';
import { AudioPlayer, AudioPlayerHandle } from './components/AudioPlayer';
import { TranscriptViewer } from './components/TranscriptViewer';
import { StructuredSummary } from './components/StructuredSummary';
import { GraphCanvas } from './components/GraphCanvas';
import { UploadModal } from './components/UploadModal';
import { ExportModal } from './components/ExportModal';
import { formatTime } from './utils/format';
import {
  Share2,
  GitBranch,
  FileText,
  Clock,
  Sparkles,
  Loader2,
  Inbox
} from 'lucide-react';

export default function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | undefined>();
  const [currentMeeting, setCurrentMeeting] = useState<MeetingDetail | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'summary' | 'graph'>('graph');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const audioPlayerRef = useRef<AudioPlayerHandle>(null);

  // Load meetings
  const loadMeetings = async (selectId?: string) => {
    try {
      const list = await fetchMeetings();
      setMeetings(list);
      if (list.length > 0) {
        const toSelect = selectId || list[0].id;
        setSelectedMeetingId(toSelect);
        loadMeetingDetail(toSelect);
      } else {
        setCurrentMeeting(null);
      }
    } catch (e) {
      console.error('Failed to load meetings', e);
    }
  };

  const loadMeetingDetail = async (id: string) => {
    setIsLoading(true);
    try {
      const detail = await fetchMeetingDetail(id);
      setCurrentMeeting(detail);
      setSelectedMeetingId(id);
    } catch (e) {
      console.error('Failed to load meeting detail', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(time);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    try {
      await deleteMeeting(id);
      const remaining = meetings.filter((m) => m.id !== id);
      setMeetings(remaining);
      if (selectedMeetingId === id) {
        if (remaining.length > 0) {
          setSelectedMeetingId(remaining[0].id);
          loadMeetingDetail(remaining[0].id);
        } else {
          setSelectedMeetingId(undefined);
          setCurrentMeeting(null);
        }
      }
    } catch (e) {
      console.error('Failed to delete meeting', e);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        meetings={meetings}
        selectedMeetingId={selectedMeetingId}
        onSelectMeeting={(id) => loadMeetingDetail(id)}
        onDeleteMeeting={handleDeleteMeeting}
        onNewMeetingClick={() => setIsUploadOpen(true)}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* App Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 backdrop-blur">
          <div className="flex items-center space-x-3">
            <div className="h-3.5 w-3.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
            <span className="font-semibold tracking-wider text-slate-100 text-sm">
              MeetWhisper
            </span>
            <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400 border border-cyan-500/20">
              Speech Intelligence
            </span>
          </div>

          {currentMeeting && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <span className="font-medium text-slate-100 max-w-[260px] truncate">
                  {currentMeeting.title}
                </span>
                <span className="flex items-center rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                  <Clock className="mr-1 h-3 w-3 text-cyan-400" />
                  {formatTime(currentMeeting.duration_seconds)}
                </span>
              </div>

              {/* Export Button */}
              <button
                onClick={() => setIsExportOpen(true)}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500 hover:text-cyan-400 active:scale-95"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Export</span>
              </button>
            </div>
          )}
        </header>

        {/* Split-pane Workspace */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center space-x-2 text-cyan-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm font-medium">Loading meeting analysis...</span>
          </div>
        ) : currentMeeting ? (
          <div className="flex flex-1 overflow-hidden p-4 gap-4">
            {/* Left Pane: Audio Waveform & Speaker Transcript */}
            <div className="flex w-5/12 flex-col space-y-4 overflow-hidden">
              {/* WaveSurfer Player */}
              <AudioPlayer
                ref={audioPlayerRef}
                audioUrl={getAudioUrl(currentMeeting.id)}
                duration={currentMeeting.duration_seconds}
                onTimeUpdate={(time) => setCurrentTime(time)}
              />

              {/* Diarized Transcript Viewer */}
              <div className="flex-1 overflow-hidden">
                <TranscriptViewer
                  segments={currentMeeting.transcript_segments || []}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </div>
            </div>

            {/* Right Pane: Tabbed Structured Intelligence & Interactive Flowchart */}
            <div className="flex w-7/12 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
              {/* Right Pane Tab Bar */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab('graph')}
                    className={`flex items-center space-x-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                      activeTab === 'graph'
                        ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                        : 'border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>Interactive Flowchart</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center space-x-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                      activeTab === 'summary'
                        ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                        : 'border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Structured Intelligence</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Click any node or bullet to seek audio
                </div>
              </div>

              {/* Active Tab View */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'graph' ? (
                  currentMeeting.analysis?.graph_json ? (
                    <GraphCanvas
                      graph={currentMeeting.analysis.graph_json}
                      graphType={currentMeeting.analysis.graph_type}
                      onSeek={handleSeek}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      No visual graph generated for this meeting.
                    </div>
                  )
                ) : currentMeeting.analysis ? (
                  <StructuredSummary
                    analysis={currentMeeting.analysis}
                    onSeek={handleSeek}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">
                    No structured intelligence extracted yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty Workspace State */
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 text-cyan-400 mb-4 shadow-xl">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">No Meeting Selected</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              Upload an audio or video file to generate speaker-diarized transcripts, structured summaries, and interactive flowcharts.
            </p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center space-x-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)] active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              <span>Upload New Recording</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={(newId) => loadMeetings(newId)}
      />

      {/* Export Modal */}
      {currentMeeting && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          meeting={currentMeeting}
        />
      )}
    </div>
  );
}
