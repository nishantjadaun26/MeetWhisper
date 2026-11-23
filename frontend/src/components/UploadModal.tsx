import React, { useState, useRef } from 'react';
import { uploadMeetingAudio, subscribeJobProgress } from '../services/api';
import { JobProgress } from '../types/meeting';
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (meetingId: string) => void;
}

const STAGE_ORDER = ['queued', 'normalizing', 'transcribing', 'chunking', 'extracting_graph', 'completed'];

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  normalizing: 'Normalizing audio (16kHz PCM WAV)',
  transcribing: 'Transcribing & labeling speakers',
  chunking: 'Detecting topic boundaries',
  extracting_graph: 'Synthesizing summary & validating graph',
  completed: 'Processing complete',
  failed: 'Processing failed',
};

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      if (!title) {
        setTitle(dropped.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
      }
    }
  };

  const handleStartUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const result = await uploadMeetingAudio(file, title);
      const { meeting_id, job_id } = result;

      subscribeJobProgress(
        job_id,
        (progress) => {
          setJobProgress(progress);
          if (progress.status === 'completed') {
            setTimeout(() => {
              onUploadSuccess(meeting_id);
              onClose();
            }, 1000);
          } else if (progress.status === 'failed') {
            setErrorMessage(progress.error_message || 'Processing failed');
          }
        },
        (err) => {
          console.error('SSE Error', err);
        }
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload media');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade">
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0c0e14] p-6 shadow-2xl animate-slide-up">
        {/* Close Button */}
        {!isUploading && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-zinc-500 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <h2 className="text-sm font-semibold text-zinc-100 mb-1">Upload Recording</h2>
        <p className="text-xs text-zinc-500 mb-5">
          Process audio or video into transcripts, action items & flowcharts.
        </p>

        {!isUploading ? (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-8 text-center transition hover:border-white/[0.25] hover:bg-white/[0.04] cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac,.aac"
                onChange={handleFileChange}
                className="hidden"
              />
              <UploadCloud className="h-8 w-8 text-zinc-400 mb-2" />
              <p className="text-xs font-medium text-zinc-200">
                {file ? file.name : 'Choose file or drag & drop'}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                MP3, WAV, M4A, MP4, WEBM up to 250MB
              </p>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Architecture Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-sky-500/60 focus:outline-none"
              />
            </div>

            {errorMessage && (
              <div className="flex items-center space-x-2 rounded-md border border-red-500/20 bg-red-950/20 p-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={!file}
                className="rounded-md border border-white/[0.15] bg-white/[0.08] px-4 py-1.5 text-xs font-medium text-white hover:bg-white/[0.15] transition active:scale-[0.98] disabled:opacity-40"
              >
                Process
              </button>
            </div>
          </div>
        ) : (
          /* Live Progress SSE Tracker */
          <div className="space-y-4 py-3 animate-fade">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                <span className="text-xs font-medium text-zinc-300">
                  {jobProgress ? STAGE_LABELS[jobProgress.status] || jobProgress.status : 'Initializing...'}
                </span>
              </div>
              <span className="font-mono text-xs text-zinc-400">
                {jobProgress?.progress_percent || 0}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full bg-sky-400 transition-all duration-300 ease-out"
                style={{ width: `${jobProgress?.progress_percent || 0}%` }}
              />
            </div>

            {/* Stage Stepper */}
            <div className="space-y-1.5 pt-2">
              {STAGE_ORDER.slice(1, -1).map((stage) => {
                const isDone =
                  jobProgress &&
                  STAGE_ORDER.indexOf(jobProgress.status) > STAGE_ORDER.indexOf(stage);
                const isCurrent = jobProgress?.status === stage;

                return (
                  <div
                    key={stage}
                    className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition ${
                      isCurrent
                        ? 'text-white font-medium bg-white/[0.04]'
                        : isDone
                        ? 'text-zinc-400'
                        : 'text-zinc-600'
                    }`}
                  >
                    <span>{STAGE_LABELS[stage]}</span>
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-zinc-700" />
                    )}
                  </div>
                );
              })}
            </div>

            {errorMessage && (
              <div className="flex items-center space-x-2 rounded-md border border-red-500/20 bg-red-950/20 p-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
