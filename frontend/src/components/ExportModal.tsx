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
  FileText,
  Code,
  Share2
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center space-x-2">
            <Share2 className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">Export Artifacts</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs & Action buttons */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-2.5">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('markdown')}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'markdown'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Markdown Summary</span>
            </button>
            <button
              onClick={() => setActiveTab('mermaid')}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'mermaid'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>Mermaid Diagram</span>
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'json'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>Raw JSON</span>
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500 hover:text-cyan-300 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-6 bg-slate-950 font-mono text-xs text-slate-300 leading-relaxed selection:bg-cyan-500/30">
          <pre className="whitespace-pre-wrap">{getCurrentContent()}</pre>
        </div>
      </div>
    </div>
  );
};
