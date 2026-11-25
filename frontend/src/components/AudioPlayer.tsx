import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw } from 'lucide-react';
import { formatTime } from '../utils/format';

interface AudioPlayerProps {
  audioUrl: string;
  duration?: number;
  onTimeUpdate?: (currentTime: number) => void;
}

export interface AudioPlayerHandle {
  seekTo: (timeInSeconds: number) => void;
  play: () => void;
  pause: () => void;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  ({ audioUrl, duration: initialDuration = 0, onTimeUpdate }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(initialDuration);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useImperativeHandle(ref, () => ({
      seekTo: (timeInSeconds: number) => {
        if (wavesurferRef.current && totalDuration > 0) {
          const progress = Math.min(1, Math.max(0, timeInSeconds / totalDuration));
          wavesurferRef.current.seekTo(progress);
          wavesurferRef.current.play();
        }
      },
      play: () => wavesurferRef.current?.play(),
      pause: () => wavesurferRef.current?.pause(),
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      setIsLoading(true);

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: 'rgba(167, 139, 250, 0.3)',
        progressColor: '#67E8F9',
        cursorColor: '#C4B5FD',
        cursorWidth: 1.5,
        height: 48,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        url: audioUrl,
      });

      wavesurferRef.current = ws;

      ws.on('ready', () => {
        setIsLoading(false);
        const dur = ws.getDuration();
        if (dur > 0) setTotalDuration(dur);
      });

      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));

      ws.on('timeupdate', (time) => {
        setCurrentTime(time);
        if (onTimeUpdate) {
          onTimeUpdate(time);
        }
      });

      ws.on('finish', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      return () => {
        ws.destroy();
      };
    }, [audioUrl]);

    const togglePlayPause = () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.playPause();
      }
    };

    const handleSkip = (seconds: number) => {
      if (wavesurferRef.current && totalDuration > 0) {
        const nextTime = Math.min(totalDuration, Math.max(0, currentTime + seconds));
        wavesurferRef.current.seekTo(nextTime / totalDuration);
      }
    };

    const handleRateChange = () => {
      const rates = [1, 1.25, 1.5, 2, 0.75];
      const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
      setPlaybackRate(nextRate);
      wavesurferRef.current?.setPlaybackRate(nextRate);
    };

    const toggleMute = () => {
      if (wavesurferRef.current) {
        if (isMuted) {
          wavesurferRef.current.setVolume(volume);
          setIsMuted(false);
        } else {
          wavesurferRef.current.setVolume(0);
          setIsMuted(true);
        }
      }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setVolume(val);
      setIsMuted(val === 0);
      wavesurferRef.current?.setVolume(val);
    };

    return (
      <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] p-3.5 transition-all">
        {/* Waveform area */}
        <div className="relative mb-2.5 w-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--panel-bg)]/80 text-[11px] text-[var(--text-secondary)] font-mono">
              Loading waveform...
            </div>
          )}
          <div ref={containerRef} className="cursor-pointer" />
        </div>

        {/* Minimal Controls Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2.5">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlayPause}
              disabled={isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-violet)] text-[var(--bg)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />}
            </button>

            {/* Skip Buttons */}
            <button
              onClick={() => handleSkip(-5)}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              title="Back 5s"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleSkip(5)}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              title="Forward 5s"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>

            {/* Timers */}
            <div className="font-mono text-[11px] text-[var(--text-secondary)] pl-1">
              <span className="text-[var(--text-primary)]">{formatTime(currentTime)}</span>
              <span className="mx-1 text-[var(--border)]">/</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Speed toggle */}
            <button
              onClick={handleRateChange}
              className="rounded border border-[var(--border)] px-2 py-0.5 font-mono text-[11px] text-[var(--accent-violet)] hover:border-[var(--accent-violet)] hover:text-[var(--text-primary)] transition"
              title="Playback speed"
            >
              {playbackRate}x
            </button>

            {/* Volume */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={toggleMute}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="h-1 w-14 cursor-pointer appearance-none rounded-lg bg-[var(--border)] accent-[var(--accent-cyan)]"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);
