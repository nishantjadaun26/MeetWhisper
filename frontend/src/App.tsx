import { useState, useEffect, useRef } from 'react';
import {
  fetchMeetings,
  fetchMeetingDetail,
  deleteMeeting,
  getAudioUrl,
  generateArtifact,
  subscribeJobProgress,
  fetchCurrentUser,
  logoutUser,
  getAuthToken
} from './services/api';
import { Meeting, MeetingDetail } from './types/meeting';
import { User } from './types/auth';
import { Sidebar } from './components/Sidebar';
import { AudioPlayer, AudioPlayerHandle } from './components/AudioPlayer';
import { VideoPlayer, VideoPlayerHandle } from './components/VideoPlayer';
import { TranscriptViewer } from './components/TranscriptViewer';
import { StructuredSummary } from './components/StructuredSummary';
import { GraphCanvas } from './components/GraphCanvas';
import { UploadModal } from './components/UploadModal';
import { ExportModal } from './components/ExportModal';
import { AuthModal } from './components/AuthModal';
import { Logo } from './components/Logo';
import { formatTime } from './utils/format';
import {
  Share2,
  Clock,
  Plus,
  Loader2,
  GitBranch,
  FileText,
  Video,
  Music,
  ArrowRight,
  Sun,
  Moon,
  Columns2,
  LogIn,
  LogOut
} from 'lucide-react';

export default function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | undefined>();
  const [currentMeeting, setCurrentMeeting] = useState<MeetingDetail | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [studioLayout, setStudioLayout] = useState<'notes' | 'flowchart' | 'split'>('notes');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [pendingUploadAfterAuth, setPendingUploadAfterAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState(false);
  const [mediaViewMode, setMediaViewMode] = useState<'video' | 'waveform'>('video');
  const [viewMode, setViewMode] = useState<'home' | 'studio'>('home');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('mw-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('mw-theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Interactive output selector state on landing
  const [selectedOutputTab, setSelectedOutputTab] = useState<'summary' | 'notes' | 'flowchart'>('summary');

  // Interactive verify demo state on landing
  const [demoActiveIndex, setDemoActiveIndex] = useState(1);
  const [demoTime, setDemoTime] = useState('18:24');
  const [demoSpeaker, setDemoSpeaker] = useState('[SPEAKER_A]');
  const [demoText, setDemoText] = useState(
    'Agreed. Let\'s make an explicit decision: we will standardize on PostgreSQL 16 with pgvector for our vector embeddings.'
  );
  const [demoFlash, setDemoFlash] = useState(false);

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
      if (selectId) {
        setSelectedMeetingId(selectId);
        await loadMeetingDetail(selectId);
        setViewMode('studio');
      } else if (list.length > 0 && !selectedMeetingId) {
        setSelectedMeetingId(list[0].id);
        await loadMeetingDetail(list[0].id);
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
    const initAuthAndData = async () => {
      if (getAuthToken()) {
        try {
          const user = await fetchCurrentUser();
          setCurrentUser(user);
        } catch {
          setCurrentUser(null);
        }
      }
      await loadMeetings();
    };
    initAuthAndData();
  }, []);

  const openAuthModal = (mode: 'login' | 'register' = 'login', reason: string | null = null) => {
    setAuthMode(mode);
    setAuthPromptReason(reason);
    setIsAuthOpen(true);
  };

  const handleUploadTrigger = () => {
    if (!currentUser) {
      setPendingUploadAfterAuth(true);
      openAuthModal('login', 'Sign in or create an account to upload and save your recordings.');
      return;
    }
    setIsUploadOpen(true);
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setSelectedMeetingId(undefined);
    setCurrentMeeting(null);
    setViewMode('home');
    await loadMeetings();
  };

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

    const segmentCount = currentMeeting.transcript_segments?.length || 0;
    if (segmentCount === 0) {
      if (mode === 'flowchart') {
        alert('Not enough content for a flowchart in this recording.');
      } else {
        alert('Not enough content to generate notes in this recording.');
      }
      return;
    }

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
              setStudioLayout((prev) => (prev === 'split' ? 'split' : 'flowchart'));
            } else {
              setStudioLayout((prev) => (prev === 'split' ? 'split' : 'notes'));
            }
          } else if (progress.status === 'failed') {
            setIsGeneratingArtifact(false);
            const err = progress.error_message || 'Unknown error';
            if (err.toLowerCase().includes('not enough content')) {
              alert('Not enough content for a flowchart in this recording.');
            } else {
              alert(`Generation failed: ${err}`);
            }
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
          setViewMode('home');
        }
      }
    } catch (e) {
      console.error('Failed to delete meeting', e);
    }
  };

  const openMeetingInStudio = (id: string) => {
    setSelectedMeetingId(id);
    loadMeetingDetail(id);
    setViewMode('studio');
  };

  const handleVerifyDemoClick = (index: number, time: string, speaker: string, text: string) => {
    setDemoActiveIndex(index);
    setDemoTime(time);
    setDemoSpeaker(speaker);
    setDemoText(text);
    setDemoFlash(true);
    setTimeout(() => setDemoFlash(false), 250);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] text-[var(--text-primary)] font-sans antialiased selection:bg-[var(--accent-cyan)]/20 selection:text-[var(--accent-cyan)]">
      {/* =====================================================================
          STICKY TOP NAVIGATION
          ===================================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <button
            onClick={() => setViewMode('home')}
            className="flex items-center hover:opacity-90 transition cursor-pointer"
          >
            <Logo isDark={theme === 'dark'} size="md" />
          </button>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-7 text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">
            <a
              href="#features"
              onClick={() => {
                if (viewMode !== 'home') setViewMode('home');
              }}
              className="hover:text-[var(--text-primary)] transition"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => {
                if (viewMode !== 'home') setViewMode('home');
              }}
              className="hover:text-[var(--text-primary)] transition"
            >
              How it works
            </a>
            <a
              href="#privacy"
              onClick={() => {
                if (viewMode !== 'home') setViewMode('home');
              }}
              className="hover:text-[var(--text-primary)] transition"
            >
              Privacy
            </a>
            <a
              href="https://github.com/nishantjadaun26/MeetWhisper"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text-primary)] transition"
            >
              GitHub
            </a>
          </nav>

          {/* Nav Right Actions */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-violet)] transition cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#FDE047] transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-[#6366F1] transition-transform hover:-rotate-12" />
              )}
            </button>

            {meetings.length > 0 && (
              <button
                onClick={() => setViewMode(viewMode === 'studio' ? 'home' : 'studio')}
                className="hidden sm:inline-flex items-center space-x-1.5 rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] px-3 py-1.5 text-xs font-mono text-[var(--accent-violet)] hover:border-[var(--accent-violet)] hover:bg-[var(--card-hover-bg)] transition whitespace-nowrap"
              >
                {viewMode === 'studio' ? (
                  <span>View Overview</span>
                ) : (
                  <>
                    <span>Studio Session</span>
                    <span className="rounded bg-[var(--accent-violet)]/10 px-1 text-[10px] text-[var(--accent-cyan)]">
                      {meetings.length}
                    </span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleUploadTrigger}
              className="btn-gradient !h-9 !px-4 !text-xs !rounded-lg"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              <span>Upload Recording</span>
            </button>

            {currentUser ? (
              <div className="flex items-center space-x-2 rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] pl-2 pr-1.5 py-1">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-violet)]/20 font-mono text-[10px] font-bold text-[var(--accent-violet)]"
                  title={currentUser.email}
                >
                  {currentUser.full_name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <span className="hidden md:inline text-xs font-medium text-[var(--text-primary)] max-w-[110px] truncate">
                  {currentUser.full_name.split(' ')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="rounded p-1 text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--card-hover-bg)] transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => openAuthModal('login', null)}
                className="flex h-9 items-center space-x-1.5 rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] px-3 text-xs font-mono text-[var(--text-primary)] hover:border-[var(--accent-violet)] hover:bg-[var(--card-hover-bg)] transition whitespace-nowrap cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          VIEW: STUDIO WORKSPACE
          ===================================================================== */}
      {viewMode === 'studio' && (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
          {/* Sidebar */}
          <Sidebar
            meetings={meetings}
            selectedMeetingId={selectedMeetingId}
            onSelectMeeting={(id) => loadMeetingDetail(id)}
            onDeleteMeeting={handleDeleteMeeting}
            onNewMeetingClick={handleUploadTrigger}
            onGoHome={() => setViewMode('home')}
          />

          {/* Main Studio Area */}
          <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
            {/* Minimal Sub-header */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-4 bg-[var(--bg)]">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setViewMode('home')}
                  className="font-mono text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-violet)] transition flex items-center space-x-1"
                >
                  <span>← Overview</span>
                </button>

                {currentMeeting && (
                  <div className="flex items-center space-x-2 text-xs border-l border-[var(--border)] pl-3">
                    {isVideo ? (
                      <span className="flex items-center space-x-1 rounded bg-[var(--accent-cyan)]/10 px-1.5 py-0.5 text-[10px] text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/20 font-mono">
                        <Video className="h-2.5 w-2.5" />
                        <span>Video</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 rounded bg-[var(--accent-violet)]/10 px-1.5 py-0.5 text-[10px] text-[var(--accent-violet)] border border-[var(--accent-violet)]/20 font-mono">
                        <Music className="h-2.5 w-2.5" />
                        <span>Audio</span>
                      </span>
                    )}
                    <span className="font-medium text-[var(--text-primary)] max-w-[280px] truncate">
                      {currentMeeting.title}
                    </span>
                    <span className="flex items-center rounded bg-[var(--card-hover-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)] border border-[var(--border)]">
                      <Clock className="mr-1 h-2.5 w-2.5 text-[var(--text-secondary)]" />
                      {formatTime(currentMeeting.duration_seconds)}
                    </span>
                  </div>
                )}
              </div>

              {currentMeeting && (
                <div className="flex items-center space-x-2.5">
                  {/* Studio Layout Mode Switcher */}
                  <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] p-0.5 text-[11px] font-mono">
                    <button
                      onClick={() => setStudioLayout('notes')}
                      className={`flex items-center space-x-1.5 rounded-md px-2.5 py-1 transition whitespace-nowrap ${
                        studioLayout === 'notes'
                          ? 'bg-[var(--card-hover-bg)] text-[var(--text-primary)] font-medium shadow-sm border border-[var(--accent-cyan)]/40'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                      }`}
                    >
                      <FileText className="h-3 w-3 text-[var(--accent-cyan)]" />
                      <span>Notes & Media</span>
                    </button>
                    <button
                      onClick={() => setStudioLayout('flowchart')}
                      className={`flex items-center space-x-1.5 rounded-md px-2.5 py-1 transition whitespace-nowrap ${
                        studioLayout === 'flowchart'
                          ? 'bg-[var(--card-hover-bg)] text-[var(--text-primary)] font-medium shadow-sm border border-[var(--accent-violet)]/40'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                      }`}
                    >
                      <GitBranch className="h-3 w-3 text-[var(--accent-violet)]" />
                      <span>Flowchart</span>
                    </button>
                    <button
                      onClick={() => setStudioLayout('split')}
                      className={`flex items-center space-x-1.5 rounded-md px-2.5 py-1 transition whitespace-nowrap ${
                        studioLayout === 'split'
                          ? 'bg-[var(--card-hover-bg)] text-[var(--text-primary)] font-medium shadow-sm border border-[var(--accent-violet)]/40'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                      }`}
                    >
                      <Columns2 className="h-3 w-3 text-[var(--accent-violet)]" />
                      <span>Split View</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setIsExportOpen(true)}
                    className="flex items-center space-x-1.5 rounded-md border border-[var(--border)] bg-[var(--subtle-fill)] px-2.5 py-1 text-xs font-mono text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-primary)] transition"
                  >
                    <Share2 className="h-3 w-3" />
                    <span>Export</span>
                  </button>
                </div>
              )}
            </div>

            {/* Studio Body */}
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center space-x-2 text-[var(--text-secondary)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-cyan)]" />
                <span className="text-xs font-mono">Loading session intelligence...</span>
              </div>
            ) : currentMeeting ? (
              studioLayout === 'flowchart' ? (
                /* FULL-SCREEN FLOWCHART ONLY */
                <div key="studio-flowchart-full" className="flex flex-1 overflow-hidden p-3 animate-fade">
                  <div className="h-full w-full">
                    <GraphCanvas
                      graph={currentMeeting.analysis?.graph_json || { nodes: [], edges: [] }}
                      graphType={currentMeeting.analysis?.graph_type}
                      hasContent={(currentMeeting.transcript_segments?.length || 0) > 0}
                      onSeek={(time) => {
                        setCurrentTime(time);
                        setStudioLayout('notes');
                        setTimeout(() => handleSeek(time), 120);
                      }}
                      onGenerateFlowchart={() => handleGenerateArtifact('flowchart')}
                      isGenerating={isGeneratingArtifact}
                    />
                  </div>
                </div>
              ) : studioLayout === 'split' ? (
                /* SPLIT SCREEN: FLOWCHART + NOTES SIMULTANEOUSLY */
                <div key="studio-split" className="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden p-3 gap-3 animate-fade">
                  {/* Left Half: Flowchart */}
                  <div className="h-full min-h-[360px] w-full overflow-hidden">
                    <GraphCanvas
                      graph={currentMeeting.analysis?.graph_json || { nodes: [], edges: [] }}
                      graphType={currentMeeting.analysis?.graph_type}
                      hasContent={(currentMeeting.transcript_segments?.length || 0) > 0}
                      onSeek={(time) => {
                        setCurrentTime(time);
                        setStudioLayout('notes');
                        setTimeout(() => handleSeek(time), 120);
                      }}
                      onGenerateFlowchart={() => handleGenerateArtifact('flowchart')}
                      isGenerating={isGeneratingArtifact}
                    />
                  </div>

                  {/* Right Half: Structured Notes */}
                  <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5 mb-3">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          Summary & Actions
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                        Click timestamps to verify in media
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto flex flex-col">
                      {currentMeeting.analysis ? (
                        <StructuredSummary
                          analysis={currentMeeting.analysis}
                          onSeek={(time) => {
                            setCurrentTime(time);
                            setStudioLayout('notes');
                            setTimeout(() => handleSeek(time), 120);
                          }}
                          onGenerateNotes={() => handleGenerateArtifact('notes')}
                          isGenerating={isGeneratingArtifact}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-8 text-center text-xs text-[var(--text-secondary)]/50">
                          No analysis available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD VIEW: MEDIA + TRANSCRIPT (LEFT) & NOTES (RIGHT) */
                <div key="studio-notes" className="flex flex-1 overflow-hidden p-3 gap-3 animate-fade">
                  {/* Left Pane: Media Player (Video or Waveform) & Speaker Transcript */}
                  <div className="flex w-5/12 flex-col space-y-3 overflow-hidden">
                    {isVideo ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">
                            Media Stream
                          </span>
                          <div className="flex items-center rounded-md border border-[var(--border)] bg-[var(--input-bg)] p-0.5 text-[10px] font-mono">
                            <button
                              onClick={() => setMediaViewMode('video')}
                              className={`rounded px-2 py-0.5 transition ${
                                mediaViewMode === 'video'
                                  ? 'bg-[var(--card-hover-bg)] text-[var(--text-primary)]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Video Player
                            </button>
                            <button
                              onClick={() => setMediaViewMode('waveform')}
                              className={`rounded px-2 py-0.5 transition ${
                                mediaViewMode === 'waveform'
                                  ? 'bg-[var(--card-hover-bg)] text-[var(--text-primary)]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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

                  {/* Right Pane: Structured Notes (Summary & Actions) */}
                  <div className="flex w-7/12 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5 mb-3">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          Summary & Actions
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="hidden xl:inline text-[10px] text-[var(--text-secondary)] font-mono">
                          Click timestamps to verify audio/video
                        </span>
                        <button
                          onClick={() => setStudioLayout('flowchart')}
                          className="flex items-center space-x-1 rounded-md border border-[var(--border)] bg-[var(--subtle-fill)] px-2.5 py-1 text-[11px] font-mono text-[var(--accent-violet)] hover:border-[var(--accent-violet)] hover:bg-[var(--card-hover-bg)] transition"
                        >
                          <GitBranch className="h-3 w-3" />
                          <span>Open Flowchart</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto flex flex-col">
                      {currentMeeting.analysis ? (
                        <StructuredSummary
                          analysis={currentMeeting.analysis}
                          onSeek={handleSeek}
                          onGenerateNotes={() => handleGenerateArtifact('notes')}
                          isGenerating={isGeneratingArtifact}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-8 text-center text-xs text-[var(--text-secondary)]/50">
                          No analysis available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center animate-fade">
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">No Recording Selected</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-xs mb-5">
                  Upload an audio or video file to extract transcripts, action items, and interactive flowcharts.
                </p>
                <button
                  onClick={handleUploadTrigger}
                  className="btn-gradient !h-9 !px-4 !text-xs !rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>Upload Recording</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW: MARKETING SINGLE-PAGE (Default / Home / Overview)
          ===================================================================== */}
      {viewMode === 'home' && (
        <main className="w-full">
          {/* HERO WITH BACKGROUND GRID & GLOWS */}
          <div className="hero-glow-bg border-b border-[var(--border)] relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                {/* Hero Left Content */}
                <div className="lg:col-span-6 flex flex-col items-start">
                  <div className="inline-flex items-center space-x-2 rounded-full border border-[var(--accent-cyan)]/35 bg-[var(--accent-cyan)]/[0.06] px-3.5 py-1.5 text-xs font-mono font-medium text-[var(--accent-cyan)] mb-6">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-cyan)]" />
                    <span>Audio + Video supported</span>
                  </div>

                  <h1 className="text-[34px] sm:text-[46px] font-bold leading-[1.1] tracking-[-1px] text-[var(--text-primary)] mb-5">
                    Don't just summarize meetings. <span className="gradient-text">Verify them.</span>
                  </h1>

                  <p className="text-base leading-relaxed text-[var(--text-secondary)] max-w-[520px] mb-8">
                    Upload any recording and get action items, decision flowcharts or mind maps. Every point is linked to the exact moment it was said.
                  </p>

                  <div className="flex flex-wrap items-center gap-3.5 w-full">
                    <button
                      onClick={handleUploadTrigger}
                      className="btn-gradient"
                    >
                      Try MeetWhisper
                    </button>
                    <button
                      onClick={handleUploadTrigger}
                      className="btn-mono-box cursor-pointer"
                    >
                      Upload .mp3 · .wav · .mp4 · .mov
                    </button>
                  </div>
                </div>

                {/* Hero Right Visual Mockup (Pure HTML/CSS) */}
                <div className="lg:col-span-6 w-full">
                  <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5 shadow-2xl transition hover:border-[var(--accent-violet)]">
                    {/* Mockup Waveform Player */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--subtle-fill)] p-3 sm:p-4 mb-4">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-2.5">
                        <span className="text-[var(--accent-cyan)] flex items-center space-x-1.5">
                          <Video className="h-3 w-3" />
                          <span>[RECORDING_FILENAME.mp4]</span>
                        </span>
                        <span className="text-[var(--text-secondary)]">[12:04 / 48:15]</span>
                      </div>

                      {/* Fake Waveform */}
                      <div className="relative flex h-9 items-center gap-1">
                        {[35, 65, 90, 40, 75, 50, 85, 30, 70, 95, 45, 60, 80, 40, 65, 90, 35, 75, 50, 40].map((h, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-sm ${i < 10 ? 'bg-[var(--accent-cyan)]' : 'bg-[#2E2B45]'}`}
                            style={{ height: `${h}%` }}
                          />
                        ))}
                        <div className="absolute left-[48%] top-0 bottom-0 w-0.5 bg-[var(--accent-violet)] shadow-[0_0_8px_rgba(196,181,253,0.8)]" />
                      </div>
                    </div>

                    {/* 3 Synced Mockup Panels */}
                    <div className="space-y-3">
                      {/* Panel 1: Bullets / Action Item */}
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] p-3">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                          <span>Structured Extraction</span>
                          <span className="text-[var(--accent-cyan)]">[12:04]</span>
                        </div>
                        <div className="flex items-start space-x-2 text-xs text-[var(--text-primary)]">
                          <span className="font-mono text-[10px] text-[var(--accent-violet)] bg-[var(--accent-violet)]/10 border border-[var(--accent-violet)]/30 px-1.5 py-0.5 rounded">
                            Action
                          </span>
                          <span>Action item: [OWNER] to [TASK] by [DATE]</span>
                        </div>
                      </div>

                      {/* Panel 2: Mini Flowchart */}
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] p-3">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                          <span>Decision Flow</span>
                          <span className="text-[var(--accent-cyan)]">[VERIFIED]</span>
                        </div>
                        <div className="flex items-center space-x-2 overflow-x-auto text-[11px] font-mono">
                          <div className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text-primary)]">
                            [Problem]
                          </div>
                          <span className="text-[var(--text-secondary)]">→</span>
                          <div className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text-primary)]">
                            [Options]
                          </div>
                          <span className="text-[var(--text-secondary)]">→</span>
                          <div className="rounded border border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 px-2 py-1 text-[var(--accent-cyan)] font-medium">
                            [Decision]
                          </div>
                        </div>
                      </div>

                      {/* Panel 3: Synced Transcript Line */}
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] p-3">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                          <span>Grounded Transcript</span>
                          <span className="text-[var(--accent-cyan)]">[12:04]</span>
                        </div>
                        <div className="rounded-r border-l-2 border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/[0.05] p-2 text-xs text-[var(--text-primary)] leading-relaxed">
                          <span className="font-mono font-semibold text-[var(--accent-cyan)] mr-1.5">
                            [SPEAKER_A]:
                          </span>
                          "Agreed. Let's make an explicit decision: [OWNER] will standardize the architecture and finalize models by [DATE]."
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE RECORDINGS SHELF (If any uploaded) */}
          {meetings.length > 0 && (
            <div className="border-b border-[var(--border)] bg-[var(--bg)] py-8">
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="font-mono text-xs text-[var(--accent-cyan)] uppercase tracking-wider">
                      Your Sessions
                    </span>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                      Active Recordings in Workspace
                    </h3>
                  </div>
                  <button
                    onClick={() => setViewMode('studio')}
                    className="flex items-center space-x-1 font-mono text-xs text-[var(--accent-violet)] hover:underline"
                  >
                    <span>Open Full Studio</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {meetings.map((m) => {
                    const isVid = m.mime_type?.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(m.filename);
                    return (
                      <div
                        key={m.id}
                        onClick={() => openMeetingInStudio(m.id)}
                        className="group flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-3.5 hover:border-[var(--accent-violet)] hover:bg-[var(--card-hover-bg)] transition cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {isVid ? (
                            <Video className="h-4 w-4 text-[var(--accent-cyan)] shrink-0" />
                          ) : (
                            <Music className="h-4 w-4 text-[var(--accent-violet)] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-[var(--text-primary)] block truncate group-hover:text-[var(--accent-cyan)] transition">
                              {m.title}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                              {formatTime(m.duration_seconds)} · {isVid ? 'Video' : 'Audio'}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono text-[11px] text-[var(--accent-violet)] opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                          Inspect →
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: CHOOSE YOUR OUTPUT */}
          <section className="py-20 border-b border-[var(--border)]" id="outputs">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="max-w-2xl mb-10">
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--accent-cyan)] mb-2 block">
                  Outputs
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
                  Choose your output
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Don't settle for one-size-fits-all text blobs. Select the exact structured format tailored for your cognitive workflow.
                </p>
              </div>

              {/* Segmented Selector */}
              <div className="flex max-w-md rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-1 gap-1 mb-6 font-mono text-xs">
                <button
                  onClick={() => setSelectedOutputTab('summary')}
                  className={`flex-1 rounded-lg py-2.5 transition text-center font-semibold ${
                    selectedOutputTab === 'summary'
                      ? 'border border-[var(--accent-violet)] bg-[var(--card-hover-bg)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setSelectedOutputTab('notes')}
                  className={`flex-1 rounded-lg py-2.5 transition text-center font-semibold ${
                    selectedOutputTab === 'notes'
                      ? 'border border-[var(--accent-violet)] bg-[var(--card-hover-bg)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Notes
                </button>
                <button
                  onClick={() => setSelectedOutputTab('flowchart')}
                  className={`flex-1 rounded-lg py-2.5 transition text-center font-semibold ${
                    selectedOutputTab === 'flowchart'
                      ? 'border border-[var(--accent-violet)] bg-[var(--card-hover-bg)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Flowchart / Mind Map
                </button>
              </div>

              {/* Preview Cards */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6 sm:p-8 transition hover:border-[var(--accent-violet)]">
                {selectedOutputTab === 'summary' && (
                  <div className="animate-fade">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">Executive Overview</h3>
                      <span className="font-mono text-[11px] text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 px-2 py-0.5 rounded">
                        [EXECUTIVE_SUMMARY]
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                      The engineering team evaluated the architectural migration from legacy monolithic storage to a scalable event mesh. Key benchmarks confirmed PostgreSQL with pgvector provides superior developer velocity and satisfies strict 12ms p99 latency targets. Disaster recovery procedures and failover automation were prioritized for staging launch.
                    </p>
                    <div className="flex flex-wrap gap-4 font-mono text-xs text-[var(--accent-cyan)]">
                      <span>• 3 Key Decisions</span>
                      <span>• 2 Action Items</span>
                      <span>• 1 Open Question</span>
                    </div>
                  </div>
                )}

                {selectedOutputTab === 'notes' && (
                  <div className="animate-fade">
                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--border)]">
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">Structured Meeting Notes</h3>
                      <span className="font-mono text-[11px] text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 px-2 py-0.5 rounded">
                        [STRUCTURED_NOTES]
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Decisions */}
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                        <h4 className="font-mono text-[11px] uppercase tracking-wider text-[var(--accent-violet)] mb-2.5">
                          Decisions Made
                        </h4>
                        <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                          <li className="flex justify-between items-start gap-2">
                            <span><strong className="text-[var(--text-primary)]">Standardize architecture:</strong> Adopt PostgreSQL 16 with pgvector for vector embeddings.</span>
                            <span className="font-mono text-[10px] text-[var(--accent-cyan)] shrink-0">[18:24]</span>
                          </li>
                        </ul>
                      </div>

                      {/* Action Items */}
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                        <h4 className="font-mono text-[11px] uppercase tracking-wider text-[var(--accent-violet)] mb-2.5">
                          Action Items
                        </h4>
                        <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                          <li className="flex justify-between items-start gap-2">
                            <span><strong className="text-[var(--text-primary)]">[Marcus (DevOps)]:</strong> Configure automated WAL shipping to S3 and document failover drill.</span>
                            <span className="font-mono text-[10px] text-[var(--accent-cyan)] shrink-0">[36:50]</span>
                          </li>
                        </ul>
                      </div>

                      {/* Questions */}
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                        <h4 className="font-mono text-[11px] uppercase tracking-wider text-[var(--accent-violet)] mb-2.5">
                          Open Questions
                        </h4>
                        <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                          <li className="flex justify-between items-start gap-2">
                            <span>What is our disaster recovery RPO for the streaming replication replicas in us-west-2?</span>
                            <span className="font-mono text-[10px] text-[var(--accent-cyan)] shrink-0">[25:30]</span>
                          </li>
                        </ul>
                      </div>

                      {/* Topic Segments */}
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                        <h4 className="font-mono text-[11px] uppercase tracking-wider text-[var(--accent-violet)] mb-2.5">
                          Topic Segments
                        </h4>
                        <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                          <li className="flex justify-between items-start gap-2">
                            <span>01. Architecture & Storage Benchmark Review</span>
                            <span className="font-mono text-[10px] text-[var(--accent-cyan)] shrink-0">[00:00 - 25:00]</span>
                          </li>
                          <li className="flex justify-between items-start gap-2">
                            <span>02. Disaster Recovery & Failover Logistics</span>
                            <span className="font-mono text-[10px] text-[var(--accent-cyan)] shrink-0">[25:30 - 66:00]</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {selectedOutputTab === 'flowchart' && (
                  <div className="animate-fade">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">Decision Flowchart & Concept Mind Map</h3>
                      <span className="font-mono text-[11px] text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 px-2 py-0.5 rounded">
                        [VALIDATED_GRAPH]
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-5">
                      Decision Flowchart for meetings and debates (problem → options → trade-offs → decision), and Concept Mind Maps for lectures, speeches, and podcasts:
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-xs font-mono">
                        <span className="text-[10px] uppercase text-[var(--accent-violet)] block">Problem</span>
                        <span className="text-[var(--text-primary)] font-medium">[Storage scalability bottleneck]</span>
                      </div>
                      <span className="font-mono text-xs text-[var(--text-secondary)]">leads to →</span>
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-xs font-mono">
                        <span className="text-[10px] uppercase text-[var(--accent-violet)] block">Options</span>
                        <span className="text-[var(--text-primary)] font-medium">[Compare Option A vs Option B]</span>
                      </div>
                      <span className="font-mono text-xs text-[var(--text-secondary)]">evaluates →</span>
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-xs font-mono">
                        <span className="text-[10px] uppercase text-[var(--accent-violet)] block">Trade-offs</span>
                        <span className="text-[var(--text-primary)] font-medium">[12ms p99 vs Operational overhead]</span>
                      </div>
                      <span className="font-mono text-xs text-[var(--text-secondary)]">justifies →</span>
                      <div className="rounded-lg border border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 p-3 text-xs font-mono">
                        <span className="text-[10px] uppercase text-[var(--accent-cyan)] block font-semibold">Decision</span>
                        <span className="text-[var(--accent-cyan)] font-medium">[Standardize on Option A]</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 2: CLICK TO VERIFY (Interactive Demo) */}
          <section className="py-20 border-b border-[var(--border)]">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5">
                  <span className="font-mono text-xs uppercase tracking-wider text-[var(--accent-cyan)] mb-2 block">
                    Zero Hallucinations
                  </span>
                  <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
                    Click to verify
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                    Every bullet, action item and diagram node is strictly tied to its <span className="font-mono text-[var(--accent-cyan)]">[mm:ss]</span> timestamp and speaker label.
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Never wonder whether the AI hallucinated an agreement. Clicking any extracted point jumps the audio or video directly to that exact second and lights up the speaker-diarized transcript line for instant verification.
                  </p>
                </div>

                {/* Interactive Demo Box */}
                <div className="lg:col-span-7 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 sm:p-6 transition hover:border-[var(--accent-violet)]">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border)] text-xs font-mono">
                    <span className="text-[var(--text-secondary)]">Audio/Video scrub position:</span>
                    <span className="text-[var(--accent-cyan)] font-semibold">[{demoTime}]</span>
                  </div>

                  <span className="font-mono text-[11px] text-[var(--text-secondary)] mb-2 block">
                    Click an extracted point to seek & highlight:
                  </span>

                  <div className="space-y-2.5 mb-5">
                    <button
                      onClick={() => handleVerifyDemoClick(
                        1,
                        '18:24',
                        '[Alex (Tech Lead)]',
                        'Agreed. Let\'s make an explicit decision: we will standardize on PostgreSQL 16 with pgvector for our vector embeddings.'
                      )}
                      className={`w-full flex items-center justify-between rounded-lg border p-3 text-left text-xs transition cursor-pointer ${
                        demoActiveIndex === 1
                          ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--accent-violet)]'
                      }`}
                    >
                      <span>Decision: [Standardize on PostgreSQL 16 with pgvector]</span>
                      <span className="font-mono text-[var(--accent-cyan)] shrink-0 ml-2">[18:24]</span>
                    </button>

                    <button
                      onClick={() => handleVerifyDemoClick(
                        2,
                        '36:50',
                        '[Marcus (DevOps)]',
                        'For action items, I will configure the automated WAL shipping to S3 and document the failover drill by this Thursday.'
                      )}
                      className={`w-full flex items-center justify-between rounded-lg border p-3 text-left text-xs transition cursor-pointer ${
                        demoActiveIndex === 2
                          ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--accent-violet)]'
                      }`}
                    >
                      <span>Action: [Marcus] to configure WAL shipping to S3 bucket</span>
                      <span className="font-mono text-[var(--accent-cyan)] shrink-0 ml-2">[36:50]</span>
                    </button>

                    <button
                      onClick={() => handleVerifyDemoClick(
                        3,
                        '25:30',
                        '[Marcus (DevOps)]',
                        'I have an open question: what is our disaster recovery RPO for the streaming replication replicas in us-west-2?'
                      )}
                      className={`w-full flex items-center justify-between rounded-lg border p-3 text-left text-xs transition cursor-pointer ${
                        demoActiveIndex === 3
                          ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--accent-violet)]'
                      }`}
                    >
                      <span>Question: [Disaster recovery RPO in target region?]</span>
                      <span className="font-mono text-[var(--accent-cyan)] shrink-0 ml-2">[25:30]</span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                    <span className="font-mono text-[10px] uppercase text-[var(--text-secondary)] block mb-1.5">
                      Grounded Transcript Line:
                    </span>
                    <div
                      className={`rounded-r border-l-2 border-[var(--accent-cyan)] p-2.5 text-xs text-[var(--text-primary)] leading-relaxed transition-all duration-200 ${
                        demoFlash ? 'bg-[var(--accent-cyan)]/20' : 'bg-[var(--accent-cyan)]/[0.05]'
                      }`}
                    >
                      <span className="font-mono font-semibold text-[var(--accent-cyan)] mr-1.5">
                        {demoSpeaker}:
                      </span>
                      "{demoText}"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: HOW IT WORKS */}
          <section className="py-20 border-b border-[var(--border)]" id="how-it-works">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="max-w-2xl mb-12">
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--accent-cyan)] mb-2 block">
                  Pipeline
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
                  How it works
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Three precise stages turn raw audio or video files into validated intelligence without human bottleneck.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-7 transition hover:border-[var(--accent-violet)] hover:-translate-y-1">
                  <span className="font-mono text-2xl font-semibold text-[var(--accent-violet)] mb-4 block">
                    01
                  </span>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
                    Upload audio or video
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Drop in your recording in <span className="font-mono text-[var(--accent-cyan)]">.mp3, .wav, .mp4, .webm,</span> or <span className="font-mono text-[var(--accent-cyan)]">.mov</span>. The pipeline normalizes audio to 16kHz mono WAV for high-fidelity speech recognition.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-7 transition hover:border-[var(--accent-violet)] hover:-translate-y-1">
                  <span className="font-mono text-2xl font-semibold text-[var(--accent-violet)] mb-4 block">
                    02
                  </span>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
                    Speaker-aware transcription and topic segmentation
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Faster-Whisper transcribes words with word-level timestamps. Semantic embeddings detect natural topical transitions before feeding structured context to the AI extraction step.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-7 transition hover:border-[var(--accent-violet)] hover:-translate-y-1">
                  <span className="font-mono text-2xl font-semibold text-[var(--accent-violet)] mb-4 block">
                    03
                  </span>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
                    Get your chosen output with timestamp links
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Receive your verified summary notes or validated interactive flowchart. Every item is clickable and directly tied to the exact second in the audio or video recording.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: BUILT DIFFERENT */}
          <section className="py-20 border-b border-[var(--border)]" id="features">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="max-w-2xl mb-12">
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--accent-cyan)] mb-2 block">
                  Architecture
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
                  Built different
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Engineered from the ground up for rigor, acoustic precision, and graph validity.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-7 transition hover:border-[var(--accent-violet)] hover:-translate-y-1">
                  <div className="h-11 w-11 rounded-xl bg-[var(--accent-violet)]/10 border border-[var(--border)] flex items-center justify-center text-[var(--accent-violet)] mb-5">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2v20M17 5v14M7 5v14M2 9v6M22 9v6" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
                    Real speech ML, not just an LLM wrapper
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Speaker-diarized transcription, plus semantic topic segmentation before the AI extraction step ensures contextual fidelity and preserves speaker attribution.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-7 transition hover:border-[var(--accent-violet)] hover:-translate-y-1">
                  <div className="h-11 w-11 rounded-xl bg-[var(--accent-violet)]/10 border border-[var(--border)] flex items-center justify-center text-[var(--accent-violet)] mb-5">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="6" height="6" rx="1" />
                      <rect x="15" y="3" width="6" height="6" rx="1" />
                      <rect x="9" y="15" width="6" height="6" rx="1" />
                      <path d="M6 9v3a3 3 0 0 0 3 3h3" />
                      <path d="M18 9v3a3 3 0 0 1-3 3h-3" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
                    Diagrams that never break
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Flowcharts are checked by an automated deterministic graph validator before they are shown. Dangling references and disconnected cycles are repaired automatically.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-7 transition hover:border-[var(--accent-violet)] hover:-translate-y-1">
                  <div className="h-11 w-11 rounded-xl bg-[var(--accent-violet)]/10 border border-[var(--border)] flex items-center justify-center text-[var(--accent-violet)] mb-5">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
                    Search across all your past meetings and lectures
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    pgvector semantic embeddings allow natural-language querying across your entire repository of conversations, retrieving the exact timestamped discussion in milliseconds.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: PRIVACY & FLEXIBILITY */}
          <section className="py-20 border-b border-[var(--border)]" id="privacy">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-6">
                  <span className="font-mono text-xs uppercase tracking-wider text-[var(--accent-cyan)] mb-2 block">
                    Security & Control
                  </span>
                  <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
                    Privacy and flexibility
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                    Choose cloud mode or local-first mode, where everything runs on your own machine, switchable by setting.
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Keep sensitive executive sessions, intellectual property, and proprietary recordings entirely on-premise with local whisper inference and self-hosted models.
                  </p>
                </div>

                <div className="lg:col-span-6">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 font-mono text-xs text-[var(--text-primary)] leading-relaxed hover:border-[var(--accent-violet)] transition">
                    <span className="text-[var(--text-secondary)]/60"># MeetWhisper Local-First Privacy Configuration</span><br />
                    <span className="text-[var(--accent-cyan)]">MODE</span>=<span className="text-[var(--accent-violet)]">local</span><br />
                    <span className="text-[var(--accent-cyan)]">TRANSCRIBER_ENGINE</span>=<span className="text-[var(--accent-violet)]">faster_whisper</span><br />
                    <span className="text-[var(--accent-cyan)]">WHISPER_DEVICE</span>=<span className="text-[var(--accent-violet)]">cpu</span><br />
                    <span className="text-[var(--accent-cyan)]">LLM_PROVIDER</span>=<span className="text-[var(--accent-violet)]">ollama</span><br />
                    <span className="text-[var(--accent-cyan)]">OLLAMA_MODEL</span>=<span className="text-[var(--accent-violet)]">llama3.2</span><br />
                    <span className="text-[var(--accent-cyan)]">DATABASE_URL</span>=<span className="text-[var(--accent-violet)]">sqlite+aiosqlite:///local.db</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6: MADE FOR */}
          <section className="py-20 border-b border-[var(--border)]">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="max-w-2xl mb-8">
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--accent-cyan)] mb-2 block">
                  Versatility
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
                  Made for
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Engineered for fast-paced knowledge work across conversations and educational recordings.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {[
                  'Standups and sprint planning',
                  'Architecture reviews',
                  'College lectures',
                  'Interviews',
                  'Podcasts',
                  'Research discussions'
                ].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 font-mono text-xs text-[var(--text-primary)] hover:border-[var(--accent-violet)] hover:text-[var(--accent-violet)] hover:bg-[var(--card-hover-bg)] transition"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 7: FINAL CALL TO ACTION */}
          <section className="py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] px-6 py-16 sm:px-12 text-center flex flex-col items-center hover:border-[var(--accent-violet)] transition">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] max-w-xl mb-4">
                  Don't trust the AI blindly. Verify every insight.
                </h2>
                <p className="text-sm text-[var(--text-secondary)] max-w-md mb-8">
                  Upload any audio or video recording and inspect timestamp-grounded summaries, action items, and validated decision flowcharts.
                </p>
                <button
                  onClick={handleUploadTrigger}
                  className="btn-gradient"
                >
                  Try MeetWhisper
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 8: FOOTER */}
          <footer className="border-t border-[var(--border)] bg-[var(--bg)] py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[var(--text-secondary)]">
              <Logo isDark={theme === 'dark'} size="sm" showTagline={true} />
              <ul className="flex items-center space-x-6">
                <li><a href="#features" className="hover:text-[var(--text-primary)] transition">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-[var(--text-primary)] transition">How it works</a></li>
                <li><a href="#privacy" className="hover:text-[var(--text-primary)] transition">Privacy</a></li>
                <li>
                  <a
                    href="https://github.com/nishantjadaun26/MeetWhisper"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--text-primary)] transition"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
              <div>
                [VERIFIED_SPEECH_INTELLIGENCE]
              </div>
            </div>
          </footer>
        </main>
      )}

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

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        isDark={theme === 'dark'}
        promptReason={authPromptReason}
        onClose={() => {
          setIsAuthOpen(false);
          setPendingUploadAfterAuth(false);
        }}
        onAuthSuccess={async (user) => {
          setCurrentUser(user);
          await loadMeetings();
          if (pendingUploadAfterAuth) {
            setPendingUploadAfterAuth(false);
            setIsUploadOpen(true);
          }
        }}
      />
    </div>
  );
}
