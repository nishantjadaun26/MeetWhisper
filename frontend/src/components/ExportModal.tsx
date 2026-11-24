import React, { useState } from 'react';
import { MeetingDetail } from '../types/meeting';
import { X, Copy, Check, Download } from 'lucide-react';

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

  const generateMarkdown = (): string => {
    const analysis = meeting.analysis;
    let md = `# ${meeting.title}\n\n`;
    md += `*File: ${meeting.filename} | Duration: ${Math.round(meeting.duration_seconds)}s*\n\n`;

    if (analysis?.executive_summary) {
      md += `## Executive Summary\n${analysis.executive_summary}\n\n`;
    }

    if (analysis?.decisions_json && analysis.decisions_json.length > 0) {
      md += `## Decisions Made\n`;
      analysis.decisions_json.forEach((d) => {
        md += `- **${d.statement}** (${d.timestamp_start}s - ${d.timestamp_end}s)\n  ${d.context}\n`;
      });
      md += `\n`;
    }

    if (analysis?.action_items_json && analysis.action_items_json.length > 0) {
      md += `## Action Items\n`;
      analysis.action_items_json.forEach((a) => {
        md += `- [ ] **${a.task}** (Owner: ${a.owner || 'Unassigned'}, Due: ${a.deadline || 'None'}) [${a.timestamp_start}s]\n`;
      });
      md += `\n`;
    }

    if (analysis?.open_questions_json && analysis.open_questions_json.length > 0) {
      md += `## Open Questions\n`;
      analysis.open_questions_json.forEach((q) => {
        md += `- ${q.question} (Raised by: ${q.raised_by || 'Unknown'}) [${q.timestamp_start}s]\n`;
      });
      md += `\n`;
    }

    return md;
  };

  const generateMermaid = (): string => {
    const graph = meeting.analysis?.graph_json;
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return `flowchart LR\n  node_1["${meeting.title}"]`;
    }

    let mm = `flowchart LR\n`;
    graph.nodes.forEach((n) => {
      const cleanLabel = n.label.replace(/"/g, "'");
      mm += `  ${n.id}["${cleanLabel}"]\n`;
    });
    graph.edges.forEach((e) => {
      const lbl = e.label ? `|"${e.label}"|` : '';
      mm += `  ${e.source} -->${lbl} ${e.target}\n`;
    });
    return mm;
  };

  const generateJSON = (): string => {
    return JSON.stringify(meeting, null, 2);
  };

  const getContent = () => {
    switch (activeTab) {
      case 'markdown':
        return generateMarkdown();
      case 'mermaid':
        return generateMermaid();
      case 'json':
        return generateJSON();
    }
  };

  const content = getContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extensions = { markdown: 'md', mermaid: 'mmd', json: 'json' };
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.toLowerCase().replace(/\s+/g, '_')}_export.${extensions[activeTab]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade">
      <div className="relative flex h-[580px] w-full max-w-2xl flex-col rounded-2xl border border-[#2E2B45] bg-[#09090F] p-6 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2E2B45]">
          <div>
            <h2 className="text-base font-semibold text-[#F1EFFA]">Export Session Intelligence</h2>
            <p className="text-xs text-[#B3AFCB]">
              Copy or download verified notes, Mermaid flowcharts, or raw JSON.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#B3AFCB] hover:text-[#F1EFFA] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center justify-between py-3">
          <div className="flex space-x-1 rounded-lg border border-[#2E2B45] bg-black/40 p-1">
            <button
              onClick={() => setActiveTab('markdown')}
              className={`rounded-md px-3 py-1 font-mono text-xs transition ${
                activeTab === 'markdown'
                  ? 'bg-white/[0.1] text-[#F1EFFA] font-medium border border-[#C4B5FD]/40'
                  : 'text-[#B3AFCB] hover:text-[#F1EFFA]'
              }`}
            >
              Markdown (.md)
            </button>
            <button
              onClick={() => setActiveTab('mermaid')}
              className={`rounded-md px-3 py-1 font-mono text-xs transition ${
                activeTab === 'mermaid'
                  ? 'bg-white/[0.1] text-[#F1EFFA] font-medium border border-[#C4B5FD]/40'
                  : 'text-[#B3AFCB] hover:text-[#F1EFFA]'
              }`}
            >
              Mermaid (.mmd)
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`rounded-md px-3 py-1 font-mono text-xs transition ${
                activeTab === 'json'
                  ? 'bg-white/[0.1] text-[#F1EFFA] font-medium border border-[#C4B5FD]/40'
                  : 'text-[#B3AFCB] hover:text-[#F1EFFA]'
              }`}
            >
              Raw JSON
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 rounded-md border border-[#2E2B45] bg-white/[0.03] px-3 py-1 text-xs text-[#F1EFFA] hover:bg-white/[0.08] transition font-mono"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#67E8F9]" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="btn-gradient !h-8 !px-3 !text-xs !rounded-md"
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Code Content Box */}
        <div className="flex-1 overflow-hidden rounded-xl border border-[#2E2B45] bg-black/60 p-4">
          <textarea
            readOnly
            value={content}
            className="h-full w-full resize-none bg-transparent font-mono text-xs text-[#B3AFCB] focus:outline-none selection:bg-[#67E8F9]/20 selection:text-[#67E8F9]"
          />
        </div>
      </div>
    </div>
  );
};
