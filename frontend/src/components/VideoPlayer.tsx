import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Maximize2
} from 'lucide-react';
import { formatTime } from '../utils/format';

interface VideoPlayerProps {
  videoUrl: string;
  duration?: number;
  onTimeUpdate?: (currentTime: number) => void;
}

export interface VideoPlayerHandle {
  seekTo: (timeInSeconds: number) => void;
  play: () => void;
  pause: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ videoUrl, duration: initialDuration = 0, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(initialDuration);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (timeInSeconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = timeInSeconds;
          videoRef.current.play().catch(() => {});
        }
      },
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
    }));

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }, [videoUrl]);

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        const d = videoRef.current.duration;
        if (!isNaN(d) && d > 0) {
          setDuration(d);
        }
      }
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        if (onTimeUpdate) {
          onTimeUpdate(time);
        }
      }
    };

    const togglePlayPause = () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextTime = parseFloat(e.target.value);
      if (videoRef.current) {
        videoRef.current.currentTime = nextTime;
        setCurrentTime(nextTime);
        if (onTimeUpdate) {
          onTimeUpdate(nextTime);
        }
      }
    };

    const handleSkip = (seconds: number) => {
      if (videoRef.current) {
        const nextTime = Math.min(duration, Math.max(0, currentTime + seconds));
        videoRef.current.currentTime = nextTime;
        setCurrentTime(nextTime);
        if (onTimeUpdate) {
          onTimeUpdate(nextTime);
        }
      }
    };

    const handleSpeedChange = () => {
      const speeds = [1, 1.25, 1.5, 2];
      const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
      const nextSpeed = speeds[nextIdx];
      setPlaybackRate(nextSpeed);
      if (videoRef.current) {
        videoRef.current.playbackRate = nextSpeed;
      }
    };

    const toggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);
      if (videoRef.current) {
        videoRef.current.volume = newVol;
        if (newVol > 0 && isMuted) {
          videoRef.current.muted = false;
          setIsMuted(false);
        }
      }
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div
        ref={containerRef}
        className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0e14]"
      >
        {/* Video Canvas */}
        <div
          className="relative aspect-video w-full cursor-pointer bg-black flex items-center justify-center overflow-hidden"
          onClick={togglePlayPause}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className="h-full w-full object-contain"
            playsInline
          />

          {/* Quick Play/Pause Overlay indicator on hover or pause */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-white/20">
                <Play className="ml-0.5 h-5 w-5 fill-white" />
              </div>
            </div>
          )}
        </div>

        {/* Video Controls Bar */}
        <div className="flex flex-col space-y-2 p-3 bg-[#0c0e14]">
          {/* Progress Slider */}
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-sky-400 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #38bdf8 ${progressPercent}%, rgba(255,255,255,0.08) ${progressPercent}%)`,
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            {/* Playback Transport Buttons */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleSkip(-5)}
                title="Rewind 5s"
                className="rounded p-1 text-zinc-400 hover:text-white transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={togglePlayPause}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.08] text-white hover:bg-white/[0.15] transition active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="ml-0.5 h-3.5 w-3.5 fill-white" />
                )}
              </button>

              <button
                onClick={() => handleSkip(5)}
                title="Forward 5s"
                className="rounded p-1 text-zinc-400 hover:text-white transition"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>

              {/* Time Indicator */}
              <div className="ml-2 font-mono text-[11px] text-zinc-400">
                <span className="text-zinc-200">{formatTime(currentTime)}</span>
                <span className="text-zinc-600 mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls: Speed, Volume, Fullscreen */}
            <div className="flex items-center space-x-3">
              {/* Playback Speed Pill */}
              <button
                onClick={handleSpeedChange}
                className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 hover:text-white hover:border-white/[0.12] transition"
              >
                {playbackRate}x
              </button>

              {/* Volume Slider & Toggle */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={toggleMute}
                  className="rounded p-1 text-zinc-400 hover:text-white transition"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-14 cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-sky-400 focus:outline-none"
                />
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
                className="rounded p-1 text-zinc-400 hover:text-white transition"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
