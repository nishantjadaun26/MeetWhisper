import React, { useState, useRef } from 'react';
import { uploadMeetingAudio, subscribeJobProgress } from '../services/api';
import { JobProgress } from '../types/meeting';
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (meetingId: string) => void;
}

const STAGE_ORDER = ['queued', 'normalizing', 'transcribing', 'chunking', 'extracting_graph', 'completed'];

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued in background queue',
  normalizing: '16kHz Audio Normalization via ffmpeg',
  transcribing: 'Speech Recognition & Speaker Diarization',
  chunking: 'Semantic Topic Segmentation',
  extracting_graph: 'Schema Extraction & Graph Validation',
  completed: 'Processing Complete',
  failed: 'Processing Failed',
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

      // Start SSE listener
      subscribeJobProgress(
        job_id,
        (progress) => {
          setJobProgress(progress);
          if (progress.status === 'completed') {
            setTimeout(() => {
              onUploadSuccess(meeting_id);
              onClose();
            }, 1200);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* Close Button */}
        {!isUploading && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center space-x-2 text-cyan-400 mb-1">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-base font-semibold text-slate-100">Upload Recording</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          Process audio or video into diarized transcripts, structured summaries & interactive flowcharts.
        </p>

        {!isUploading ? (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/50 p-8 text-center transition hover:border-cyan-500 hover:bg-slate-900/50 cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac,.aac"
                onChange={handleFileChange}
                className="hidden"
              />
              <UploadCloud className="h-10 w-10 text-cyan-400 mb-2" />
              <p className="text-sm font-medium text-slate-200">
                {file ? file.name : 'Click to select or drag & drop audio/video'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                MP3, WAV, M4A, MP4, WEBM up to 250MB
              </p>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Meeting Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Infrastructure Architecture Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {errorMessage && (
              <div className="flex items-center space-x-2 rounded-lg border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={!file}
                className="flex items-center space-x-2 rounded-lg bg-cyan-500 px-5 py-2 text-xs font-medium text-slate-950 transition hover:bg-cyan-400 active:scale-95 disabled:opacity-40 disabled:hover:bg-cyan-500"
              >
                <span>Start Processing</span>
              </button>
            </div>
          </div>
        ) : (
          /* Live Progress SSE Tracker */
          <div className="space-y-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                <span className="text-xs font-medium text-slate-200">
                  {jobProgress ? STAGE_LABELS[jobProgress.status] || jobProgress.status : 'Initiating pipeline...'}
                </span>
              </div>
              <span className="font-mono text-xs font-semibold text-cyan-400">
                {jobProgress?.progress_percent || 0}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${jobProgress?.progress_percent || 0}%` }}
              />
            </div>

            {/* Stage Stepper */}
            <div className="space-y-2 pt-2">
              {STAGE_ORDER.slice(1, -1).map((stage) => {
                const isDone =
                  jobProgress &&
                  STAGE_ORDER.indexOf(jobProgress.status) > STAGE_ORDER.indexOf(stage);
                const isCurrent = jobProgress?.status === stage;

                return (
                  <div
                    key={stage}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs transition border ${
                      isCurrent
                        ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300'
                        : isDone
                        ? 'border-emerald-900/30 bg-emerald-950/10 text-emerald-400'
                        : 'border-transparent text-slate-500'
                    }`}
                  >
                    <span>{STAGE_LABELS[stage]}</span>
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                    )}
                  </div>
                );
              })}
            </div>

            {errorMessage && (
              <div className="flex items-center space-x-2 rounded-lg border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-400">
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
