import { Meeting, MeetingDetail, JobProgress, SearchResultItem } from '../types/meeting';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchMeetings(): Promise<Meeting[]> {
  const res = await fetch(`${API_BASE}/api/meetings`);
  if (!res.ok) throw new Error('Failed to fetch meetings');
  return res.json();
}

export async function fetchMeetingDetail(id: string): Promise<MeetingDetail> {
  const res = await fetch(`${API_BASE}/api/meetings/${id}`);
  if (!res.ok) throw new Error('Failed to fetch meeting details');
  return res.json();
}

export async function uploadMeetingAudio(
  file: File,
  title?: string,
  outputMode: 'flowchart' | 'notes' | 'both' = 'both'
): Promise<{ meeting_id: string; job_id: string; output_mode: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) {
    formData.append('title', title);
  }
  formData.append('output_mode', outputMode);

  const res = await fetch(`${API_BASE}/api/meetings/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Upload failed');
  }

  return res.json();
}

export async function generateArtifact(
  meetingId: string,
  mode: 'flowchart' | 'notes' | 'both'
): Promise<{ job_id: string; meeting_id: string; mode: string }> {
  const res = await fetch(`${API_BASE}/api/meetings/${meetingId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to trigger artifact generation');
  }

  return res.json();
}

export async function deleteMeeting(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/meetings/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete meeting');
}

export async function searchMeetings(query: string): Promise<SearchResultItem[]> {
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search');
  const data = await res.json();
  return data.results || [];
}

export function getAudioUrl(meetingId: string): string {
  return `${API_BASE}/api/meetings/${meetingId}/audio`;
}

export function subscribeJobProgress(
  jobId: string,
  onProgress: (progress: JobProgress) => void,
  onError?: (err: any) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/api/jobs/${jobId}/stream`);

  eventSource.addEventListener('progress', (event) => {
    try {
      const data: JobProgress = JSON.parse(event.data);
      onProgress(data);
      if (data.status === 'completed' || data.status === 'failed') {
        eventSource.close();
      }
    } catch (e) {
      console.error('Failed to parse SSE event data', e);
    }
  });

  eventSource.onerror = (err) => {
    console.error('SSE connection error:', err);
    if (onError) onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
