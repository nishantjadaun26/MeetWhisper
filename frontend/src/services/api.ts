import { Meeting, MeetingDetail, JobProgress, SearchResultItem } from '../types/meeting';
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'mw-auth-token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Registration failed');
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Invalid email or password');
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    clearAuthToken();
    throw new Error('Session expired');
  }
  return res.json();
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } finally {
    clearAuthToken();
  }
}

export async function fetchMeetings(): Promise<Meeting[]> {
  const res = await fetch(`${API_BASE}/api/meetings`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch meetings');
  return res.json();
}

export async function fetchMeetingDetail(id: string): Promise<MeetingDetail> {
  const res = await fetch(`${API_BASE}/api/meetings/${id}`, {
    headers: authHeaders(),
  });
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
    headers: authHeaders(),
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
    headers: authHeaders({ 'Content-Type': 'application/json' }),
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
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete meeting');
}

export async function searchMeetings(query: string): Promise<SearchResultItem[]> {
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(),
  });
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
