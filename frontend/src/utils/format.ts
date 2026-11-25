import { MeetingDetail } from '../types/meeting';

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
  const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  return `${formattedMins}:${formattedSecs}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function generateMarkdown(meeting: MeetingDetail): string {
  const analysis = meeting.analysis;
  let md = `# ${meeting.title}\n\n`;
  md += `**Duration:** ${formatTime(meeting.duration_seconds)} | **Processed At:** ${new Date(meeting.created_at).toLocaleString()}\n\n`;

  if (analysis) {
    md += `## Executive Summary\n\n${analysis.executive_summary}\n\n`;

    if (analysis.decisions_json && analysis.decisions_json.length > 0) {
      md += `## Key Decisions\n\n`;
      analysis.decisions_json.forEach((d) => {
        md += `- **${d.statement}** (${formatTime(d.timestamp_start)} - ${formatTime(d.timestamp_end)})\n`;
        md += `  *Context:* ${d.context}\n`;
        if (d.speaker) md += `  *Decided by:* ${d.speaker}\n`;
      });
      md += `\n`;
    }

    if (analysis.action_items_json && analysis.action_items_json.length > 0) {
      md += `## Action Items\n\n`;
      analysis.action_items_json.forEach((a) => {
        const owner = a.owner ? ` [@${a.owner}]` : '';
        const deadline = a.deadline ? ` (Due: ${a.deadline})` : '';
        md += `- [ ] **${a.task}**${owner}${deadline} — *[${formatTime(a.timestamp_start)}]*\n`;
      });
      md += `\n`;
    }

    if (analysis.open_questions_json && analysis.open_questions_json.length > 0) {
      md += `## Open Questions & Risks\n\n`;
      analysis.open_questions_json.forEach((q) => {
        const raised = q.raised_by ? ` (Raised by: ${q.raised_by})` : '';
        md += `- ❓ **${q.question}**${raised} — *[${formatTime(q.timestamp_start)}]*\n`;
      });
      md += `\n`;
    }
  }

  if (meeting.transcript_segments && meeting.transcript_segments.length > 0) {
    md += `## Diarized Transcript\n\n`;
    meeting.transcript_segments.forEach((seg) => {
      md += `**[${formatTime(seg.start_time)} - ${formatTime(seg.end_time)}] ${seg.speaker}:**\n`;
      md += `> ${seg.text}\n\n`;
    });
  }

  return md;
}

export function generateMermaid(meeting: MeetingDetail): string {
  const graph = meeting.analysis?.graph_json;
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return 'graph TD\n  empty["No graph data available"]';
  }

  const isMindmap = meeting.analysis?.graph_type === 'mindmap';
  let mmd = isMindmap ? 'mindmap\n  root((Meeting Topics))\n' : 'flowchart LR\n';

  if (!isMindmap) {
    // Styling classes
    mmd += '  classDef decision fill:#065f46,stroke:#10b981,stroke-width:2px,color:#fff;\n';
    mmd += '  classDef action fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px,color:#fff;\n';
    mmd += '  classDef question fill:#78350f,stroke:#f59e0b,stroke-width:2px,color:#fff;\n';
    mmd += '  classDef insight fill:#581c87,stroke:#a855f7,stroke-width:2px,color:#fff;\n';
    mmd += '  classDef root fill:#0f172a,stroke:#22d3ee,stroke-width:2px,color:#fff;\n';
    mmd += '  classDef topic fill:#1e293b,stroke:#64748b,stroke-width:1px,color:#fff;\n\n';

    graph.nodes.forEach((node) => {
      const cleanLabel = node.label.replace(/["\n]/g, ' ');
      const timeStr = `[${formatTime(node.timestamp_start)}]`;
      const shape = node.node_type === 'decision' ? `{"${cleanLabel} ${timeStr}"}` : `["${cleanLabel} ${timeStr}"]`;
      mmd += `  ${node.id}${shape}:::${node.node_type || 'topic'}\n`;
    });

    mmd += '\n';
    graph.edges.forEach((edge) => {
      if (edge.label) {
        mmd += `  ${edge.source} -->|"${edge.label}"| ${edge.target}\n`;
      } else {
        mmd += `  ${edge.source} --> ${edge.target}\n`;
      }
    });
  } else {
    graph.nodes.forEach((node) => {
      const cleanLabel = node.label.replace(/["\n]/g, ' ');
      mmd += `    ${cleanLabel}\n`;
    });
  }

  return mmd;
}

export function downloadTextFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
