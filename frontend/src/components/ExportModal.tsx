import React, { useState } from 'react';
import { MeetingDetail } from '../types/meeting';
import {
  generateMarkdown,
  generateMermaid,
  downloadTextFile
} from '../utils/format';
import {
  Download,
  Copy,
  Check,
  X,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: MeetingDetail;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  meeting,
}) => {
  const [activeTab, setActiveTab] = useState<'markdown' | 'mermaid' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const markdownContent = generateMarkdown(meeting);
  const mermaidContent = generateMermaid(meeting);
  const jsonContent = JSON.stringify(meeting, null, 2);

  const getCurrentContent = () => {
    if (activeTab === 'markdown') return markdownContent;
    if (activeTab === 'mermaid') return mermaidContent;
    return jsonContent;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const slug = meeting.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (activeTab === 'markdown') {
      downloadTextFile(`${slug}_summary.md`, markdownContent, 'text/markdown');
    } else if (activeTab === 'mermaid') {
      downloadTextFile(`${slug}_diagram.mmd`, mermaidContent, 'text/plain');
    } else {
      downloadTextFile(`${slug}_data.json`, jsonContent, 'application/json');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade">
      <div className="relative flex h-[78vh] w-full max-w-2xl flex-col rounded-2xl border border-white/[0.08] bg-[#0c0e14] shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-zinc-100">Export Artifacts</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Minimal Tabs */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-black/30 px-5 py-2">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('markdown')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeTab === 'markdown'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Markdown
            </button>
            <button
              onClick={() => setActiveTab('mermaid')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeTab === 'mermaid'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Mermaid
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeTab === 'json'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              JSON
            </button>
          </div>

          <div className="flex space-x-1.5">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 rounded-md border border-white/[0.08] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/[0.05] transition"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1 rounded-md border border-white/[0.15] bg-white/[0.08] px-3 py-1 text-xs font-medium text-white hover:bg-white/[0.15] transition"
            >
              <Download className="h-3 w-3" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-5 bg-[#08090d] font-mono text-[11px] text-zinc-300 leading-relaxed selection:bg-white/[0.15]">
          <pre className="whitespace-pre-wrap">{getCurrentContent()}</pre>
        </div>
      </div>
    </div>
  );
};
