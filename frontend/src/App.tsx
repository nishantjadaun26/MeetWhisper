import { useState, useEffect, useRef } from 'react';
import {
  fetchMeetings,
  fetchMeetingDetail,
  deleteMeeting,
  getAudioUrl,
  generateArtifact,
  subscribeJobProgress
} from './services/api';
import { Meeting, MeetingDetail } from './types/meeting';
import { Sidebar } from './components/Sidebar';
import { AudioPlayer, AudioPlayerHandle } from './components/AudioPlayer';
import { VideoPlayer, VideoPlayerHandle } from './components/VideoPlayer';
import { TranscriptViewer } from './components/TranscriptViewer';
import { StructuredSummary } from './components/StructuredSummary';
import { GraphCanvas } from './components/GraphCanvas';
import { UploadModal } from './components/UploadModal';
import { ExportModal } from './components/ExportModal';
import { formatTime } from './utils/format';
import {
  Share2,
  Clock,
  Plus,
  Loader2,
  GitBranch,
  FileText,
  Video,
  Music
} from 'lucide-react';

export default function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | undefined>();
  const [currentMeeting, setCurrentMeeting] = useState<MeetingDetail | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'graph' | 'summary'>('graph');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState(false);
  const [mediaViewMode, setMediaViewMode] = useState<'video' | 'waveform'>('video');

  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const isVideo = Boolean(
    currentMeeting &&
    (currentMeeting.mime_type?.startsWith('video/') ||
      /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(currentMeeting.filename))
  );

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
    if (isVideo && mediaViewMode === 'video' && videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(time);
    } else if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(time);
    }
  };

  const handleGenerateArtifact = async (mode: 'flowchart' | 'notes') => {
    if (!currentMeeting) return;
    setIsGeneratingArtifact(true);

    try {
      const { job_id } = await generateArtifact(currentMeeting.id, mode);
      subscribeJobProgress(
        job_id,
        async (progress) => {
          if (progress.status === 'completed') {
            setIsGeneratingArtifact(false);
            await loadMeetingDetail(currentMeeting.id);
            if (mode === 'flowchart') {
              setActiveTab('graph');
            } else {
              setActiveTab('summary');
            }
          } else if (progress.status === 'failed') {
            setIsGeneratingArtifact(false);
            alert(`Generation failed: ${progress.error_message || 'Unknown error'}`);
          }
        },
        () => {
          setIsGeneratingArtifact(false);
        }
      );
    } catch (e: any) {
      setIsGeneratingArtifact(false);
      alert(e.message || 'Failed to start generation');
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
    <div className="flex h-screen w-full bg-[#08090d] text-zinc-100 overflow-hidden font-sans select-none">
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
        {/* Minimal App Header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c0e14] px-5">
          <div className="flex items-center space-x-3">
            <span className="font-semibold tracking-tight text-zinc-100 text-xs uppercase font-mono">
              MeetWhisper
            </span>
          </div>

          {currentMeeting && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-xs">
                {isVideo ? (
                  <span className="flex items-center space-x-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400 border border-sky-500/20 font-mono">
                    <Video className="h-2.5 w-2.5" />
                    <span>Video</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20 font-mono">
                    <Music className="h-2.5 w-2.5" />
                    <span>Audio</span>
                  </span>
                )}
                <span className="font-medium text-zinc-200 max-w-[280px] truncate">
                  {currentMeeting.title}
                </span>
                <span className="flex items-center rounded bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-zinc-400 border border-white/[0.04]">
                  <Clock className="mr-1 h-2.5 w-2.5 text-zinc-500" />
                  {formatTime(currentMeeting.duration_seconds)}
                </span>
              </div>

              {/* Export Button */}
              <button
                onClick={() => setIsExportOpen(true)}
                className="flex items-center space-x-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white transition"
              >
                <Share2 className="h-3 w-3" />
                <span>Export</span>
              </button>
            </div>
          )}
        </header>

        {/* Workspace Body */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center space-x-2 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            <span className="text-xs font-medium">Loading session...</span>
          </div>
        ) : currentMeeting ? (
          <div className="flex flex-1 overflow-hidden p-3 gap-3">
            {/* Left Pane: Media Player (Video or Waveform) & Speaker Transcript */}
            <div className="flex w-5/12 flex-col space-y-3 overflow-hidden">
              {isVideo ? (
                <div className="space-y-2">
                  {/* View Mode Toggle when Video */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      Media Stream
                    </span>
                    <div className="flex items-center rounded-md border border-white/[0.06] bg-black/40 p-0.5 text-[10px]">
                      <button
                        onClick={() => setMediaViewMode('video')}
                        className={`rounded px-2 py-0.5 transition ${
                          mediaViewMode === 'video'
                            ? 'bg-white/[0.1] text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Video Player
                      </button>
                      <button
                        onClick={() => setMediaViewMode('waveform')}
                        className={`rounded px-2 py-0.5 transition ${
                          mediaViewMode === 'waveform'
                            ? 'bg-white/[0.1] text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Audio Waveform
                      </button>
                    </div>
                  </div>

                  {mediaViewMode === 'video' ? (
                    <VideoPlayer
                      ref={videoPlayerRef}
                      videoUrl={getAudioUrl(currentMeeting.id)}
                      duration={currentMeeting.duration_seconds}
                      onTimeUpdate={(time) => setCurrentTime(time)}
                    />
                  ) : (
                    <AudioPlayer
                      ref={audioPlayerRef}
                      audioUrl={getAudioUrl(currentMeeting.id)}
                      duration={currentMeeting.duration_seconds}
                      onTimeUpdate={(time) => setCurrentTime(time)}
                    />
                  )}
                </div>
              ) : (
                <AudioPlayer
                  ref={audioPlayerRef}
                  audioUrl={getAudioUrl(currentMeeting.id)}
                  duration={currentMeeting.duration_seconds}
                  onTimeUpdate={(time) => setCurrentTime(time)}
                />
              )}

              <div className="flex-1 overflow-hidden">
                <TranscriptViewer
                  segments={currentMeeting.transcript_segments || []}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </div>
            </div>

            {/* Right Pane: Tabbed Structured Intelligence & Interactive Flowchart */}
            <div className="flex w-7/12 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0e14] p-3.5">
              {/* Minimal Sliding Tab Selector */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5 mb-3">
                <div className="relative flex items-center bg-black/40 p-1 rounded-lg border border-white/[0.04]">
                  {/* Sliding highlight indicator */}
                  <div
                    className={`absolute top-1 bottom-1 w-[130px] rounded-md bg-white/[0.08] transition-all duration-200 ease-out ${
                      activeTab === 'graph' ? 'left-1' : 'left-[135px]'
                    }`}
                  />
                  <button
                    onClick={() => setActiveTab('graph')}
                    className={`relative z-10 flex w-[130px] items-center justify-center space-x-1.5 py-1 text-xs font-medium transition-colors ${
                      activeTab === 'graph' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <GitBranch className="h-3 w-3" />
                    <span>Visual Graph</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`relative z-10 flex w-[130px] items-center justify-center space-x-1.5 py-1 text-xs font-medium transition-colors ${
                      activeTab === 'summary' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <FileText className="h-3 w-3" />
                    <span>Summary & Actions</span>
                  </button>
                </div>

                <div className="text-[10px] text-zinc-500 font-mono">
                  Click timestamps to seek
                </div>
              </div>

              {/* Tab Content with smooth slide animation */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'graph' ? (
                  <div key="graph" className="h-full w-full animate-slide-right">
                    <GraphCanvas
                      graph={currentMeeting.analysis?.graph_json || { nodes: [], edges: [] }}
                      graphType={currentMeeting.analysis?.graph_type}
                      onSeek={handleSeek}
                      onGenerateFlowchart={() => handleGenerateArtifact('flowchart')}
                      isGenerating={isGeneratingArtifact}
                    />
                  </div>
                ) : currentMeeting.analysis ? (
                  <div key="summary" className="h-full w-full animate-slide-left">
                    <StructuredSummary
                      analysis={currentMeeting.analysis}
                      onSeek={handleSeek}
                      onGenerateNotes={() => handleGenerateArtifact('notes')}
                      isGenerating={isGeneratingArtifact}
                    />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center text-xs text-zinc-600">
                    No analysis available
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Clean Minimal Empty State */
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center animate-fade">
            <h3 className="text-sm font-medium text-zinc-200 mb-1">No Recording Selected</h3>
            <p className="text-xs text-zinc-500 max-w-xs mb-5">
              Upload an audio or video file to extract transcripts, action items, and interactive flowcharts.
            </p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.1] hover:border-white/[0.2] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Upload Recording</span>
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
