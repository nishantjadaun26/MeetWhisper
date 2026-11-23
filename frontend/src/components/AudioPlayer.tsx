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
        waveColor: '#334155', // slate-700
        progressColor: '#22d3ee', // cyan-400
        cursorColor: '#06b6d4',
        cursorWidth: 2,
        height: 64,
        barWidth: 3,
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
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
        {/* Waveform area */}
        <div className="relative mb-3 w-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-xs text-cyan-400">
              <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              Loading waveform...
            </div>
          )}
          <div ref={containerRef} className="cursor-pointer" />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Play / Pause button */}
            <button
              onClick={togglePlayPause}
              disabled={isLoading}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 text-slate-950 transition-all hover:bg-cyan-400 hover:shadow-[0_0_16px_rgba(34,211,238,0.5)] active:scale-95 disabled:opacity-50"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>

            {/* Skip buttons */}
            <button
              onClick={() => handleSkip(-5)}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title="Skip back 5s"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleSkip(5)}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title="Skip forward 5s"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Timestamp counter */}
            <div className="font-mono text-xs text-slate-300">
              <span className="text-cyan-400 font-medium">{formatTime(currentTime)}</span>
              <span className="mx-1 text-slate-600">/</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Playback speed toggle */}
            <button
              onClick={handleRateChange}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
              title="Change playback speed"
            >
              {playbackRate}x
            </button>

            {/* Volume slider */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-slate-400 hover:text-slate-200"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);
