import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "MeetWhisper API"


@pytest.mark.asyncio
async def test_upload_invalid_file_extension(client: AsyncClient):
    files = {"file": ("document.pdf", b"%PDF-1.4 dummy", "application/pdf")}
    resp = await client.post("/api/meetings/upload", files=files)
    assert resp.status_code == 400
    assert "Unsupported file format" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_meeting_lifecycle_and_audio_streaming(client: AsyncClient):
    # 1. Upload valid dummy WAV audio
    dummy_wav = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    files = {"file": ("test_recording.wav", io.BytesIO(dummy_wav), "audio/wav")}
    data = {"title": "Sprint 42 Architecture Standup"}

    upload_resp = await client.post("/api/meetings/upload", files=files, data=data)
    assert upload_resp.status_code == 201
    upload_data = upload_resp.json()
    meeting_id = upload_data["meeting_id"]
    job_id = upload_data["job_id"]
    assert upload_data["title"] == "Sprint 42 Architecture Standup"

    # 2. Query Meetings List
    list_resp = await client.get("/api/meetings")
    assert list_resp.status_code == 200
    meetings = list_resp.json()
    assert len(meetings) >= 1
    assert any(m["id"] == meeting_id for m in meetings)

    # 3. Query Meeting Detail
    detail_resp = await client.get(f"/api/meetings/{meeting_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == meeting_id
    assert detail["title"] == "Sprint 42 Architecture Standup"

    # 4. Query Job Status
    job_resp = await client.get(f"/api/jobs/{job_id}")
    assert job_resp.status_code == 200
    job = job_resp.json()
    assert job["id"] == job_id
    assert job["meeting_id"] == meeting_id

    # 5. Stream Audio - Full (200 OK)
    audio_full_resp = await client.get(f"/api/meetings/{meeting_id}/audio")
    assert audio_full_resp.status_code == 200
    assert "Accept-Ranges" in audio_full_resp.headers
    assert len(audio_full_resp.content) == len(dummy_wav)

    # 6. Stream Audio - Partial Range Request (206 Partial Content)
    headers = {"Range": "bytes=0-15"}
    audio_range_resp = await client.get(f"/api/meetings/{meeting_id}/audio", headers=headers)
    assert audio_range_resp.status_code == 206
    assert audio_range_resp.headers["Content-Range"].startswith("bytes 0-15/")
    assert len(audio_range_resp.content) == 16

    # 7. Search Endpoint
    search_resp = await client.get("/api/search?q=Architecture")
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert search_data["query"] == "Architecture"

    # 8. Delete Meeting
    del_resp = await client.delete(f"/api/meetings/{meeting_id}")
    assert del_resp.status_code == 204

    # 9. Verify 404 after deletion
    detail_after_del = await client.get(f"/api/meetings/{meeting_id}")
    assert detail_after_del.status_code == 404
