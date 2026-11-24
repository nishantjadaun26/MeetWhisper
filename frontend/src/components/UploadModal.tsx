import React, { useState, useRef } from 'react';
import { uploadMeetingAudio, subscribeJobProgress } from '../services/api';
import { JobProgress } from '../types/meeting';
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GitBranch,
  FileText,
  Layers,
  Video,
  Music
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (meetingId: string) => void;
}

const STAGE_ORDER = ['queued', 'normalizing', 'transcribing', 'chunking', 'extracting_graph', 'completed'];

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  normalizing: 'Normalizing media & extracting audio (16kHz PCM WAV)',
  transcribing: 'Transcribing speech & labeling speakers',
  chunking: 'Detecting semantic topic boundaries',
  extracting_graph: 'Synthesizing intelligence & validating graph',
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
  const [outputMode, setOutputMode] = useState<'flowchart' | 'notes' | 'both'>('both');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isVideoFile = (f: File | null) => {
    if (!f) return false;
    return f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(f.name);
  };

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
      const result = await uploadMeetingAudio(file, title, outputMode);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade">
      <div className="relative w-full max-w-md rounded-2xl border border-[#2E2B45] bg-[#09090F] p-6 shadow-2xl animate-slide-up">
        {/* Close Button */}
        {!isUploading && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-[#B3AFCB] hover:text-[#F1EFFA] transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <h2 className="text-base font-semibold text-[#F1EFFA] mb-1">Upload Recording or Video</h2>
        <p className="text-xs text-[#B3AFCB] mb-5">
          Process speech or video into verified summaries, structured notes & validated flowcharts.
        </p>

        {!isUploading ? (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2E2B45] bg-white/[0.02] p-6 text-center transition hover:border-[#C4B5FD] hover:bg-white/[0.04] cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,.webm,.mov,.mkv,.avi,.ogg,.flac,.aac"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center space-x-2 text-[#C4B5FD] mb-2">
                {file ? (
                  isVideoFile(file) ? <Video className="h-6 w-6 text-[#67E8F9]" /> : <Music className="h-6 w-6 text-[#C4B5FD]" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
              </div>
              <p className="text-xs font-medium text-[#F1EFFA] truncate max-w-xs">
                {file ? file.name : 'Choose file or drag & drop'}
              </p>
              <p className="text-[11px] font-mono text-[#B3AFCB] mt-1">
                .mp3 · .wav · .mp4 · .mov · .webm
              </p>
            </div>

            {/* Output Choice Selector */}
            <div>
              <label className="block text-xs font-medium text-[#B3AFCB] mb-1.5 font-mono">
                Choose Output Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOutputMode('notes')}
                  className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition ${
                    outputMode === 'notes'
                      ? 'border-[#67E8F9] bg-[#67E8F9]/10 text-[#F1EFFA]'
                      : 'border-[#2E2B45] bg-white/[0.02] text-[#B3AFCB] hover:border-[#C4B5FD] hover:text-[#F1EFFA]'
                  }`}
                >
                  <FileText className="h-4 w-4 mb-1 text-[#67E8F9]" />
                  <span className="text-[11px] font-semibold">Notes Only</span>
                  <span className="text-[9px] text-[#B3AFCB]">Summary & tasks</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputMode('flowchart')}
                  className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition ${
                    outputMode === 'flowchart'
                      ? 'border-[#C4B5FD] bg-[#C4B5FD]/10 text-[#F1EFFA]'
                      : 'border-[#2E2B45] bg-white/[0.02] text-[#B3AFCB] hover:border-[#C4B5FD] hover:text-[#F1EFFA]'
                  }`}
                >
                  <GitBranch className="h-4 w-4 mb-1 text-[#C4B5FD]" />
                  <span className="text-[11px] font-semibold">Flowchart</span>
                  <span className="text-[9px] text-[#B3AFCB]">Decision graph</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputMode('both')}
                  className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition ${
                    outputMode === 'both'
                      ? 'border-[#C4B5FD] bg-[#C4B5FD]/10 text-[#F1EFFA]'
                      : 'border-[#2E2B45] bg-white/[0.02] text-[#B3AFCB] hover:border-[#C4B5FD] hover:text-[#F1EFFA]'
                  }`}
                >
                  <Layers className="h-4 w-4 mb-1 text-[#C4B5FD]" />
                  <span className="text-[11px] font-semibold">Both</span>
                  <span className="text-[9px] text-[#B3AFCB]">Complete suite</span>
                </button>
              </div>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-xs font-medium text-[#B3AFCB] mb-1 font-mono">
                Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Architecture Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-[#2E2B45] bg-black/40 px-3 py-1.5 text-xs text-[#F1EFFA] placeholder-[#B3AFCB]/40 transition focus:border-[#C4B5FD] focus:outline-none font-mono"
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
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[#B3AFCB] hover:text-[#F1EFFA] transition font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={!file}
                className="btn-gradient !h-9 !px-4 !text-xs disabled:opacity-40"
              >
                Process Recording
              </button>
            </div>
          </div>
        ) : (
          /* Live Progress SSE Tracker */
          <div className="space-y-4 py-3 animate-fade">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#67E8F9]" />
                <span className="text-xs font-medium text-[#F1EFFA]">
                  {jobProgress ? STAGE_LABELS[jobProgress.status] || jobProgress.status : 'Initializing...'}
                </span>
              </div>
              <span className="font-mono text-xs text-[#67E8F9]">
                {jobProgress?.progress_percent || 0}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2E2B45]">
              <div
                className="h-full bg-[#67E8F9] transition-all duration-300 ease-out"
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
                        ? 'text-[#F1EFFA] font-medium bg-white/[0.04]'
                        : isDone
                        ? 'text-[#B3AFCB]'
                        : 'text-[#B3AFCB]/40'
                    }`}
                  >
                    <span>{STAGE_LABELS[stage]}</span>
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#67E8F9]" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3 w-3 animate-spin text-[#C4B5FD]" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-[#2E2B45]" />
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
