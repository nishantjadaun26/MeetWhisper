import os
import shutil
import subprocess
import logging
import re
from typing import Tuple, Generator, Optional

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {
    # Audio
    ".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".wma",
    # Video
    ".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"
}


def is_supported_audio_extension(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in SUPPORTED_EXTENSIONS


def get_ffmpeg_path() -> Optional[str]:
    """Finds ffmpeg from PATH or imageio-ffmpeg bundle."""
    bin_path = shutil.which("ffmpeg")
    if bin_path:
        return bin_path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def get_audio_duration_seconds(file_path: str) -> float:
    """
    Get duration in seconds using ffprobe/ffmpeg or wave parser fallback.
    """
    ffmpeg_bin = get_ffmpeg_path()
    if ffmpeg_bin:
        try:
            proc = subprocess.run(
                [ffmpeg_bin, "-i", file_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", proc.stderr)
            if dur_match:
                h, m, s = dur_match.groups()
                return int(h) * 3600 + int(m) * 60 + float(s)
        except Exception as e:
            logger.warning("ffmpeg duration probe failed: %s", e)

    # Fallback for .wav
    if file_path.lower().endswith(".wav"):
        try:
            import wave
            with wave.open(file_path, "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                if rate > 0:
                    return float(frames / rate)
        except Exception:
            pass

    return 60.0


def normalize_to_wav(input_path: str, output_path: str) -> Tuple[bool, str]:
    """
    Normalizes audio or video to 16 kHz mono 16-bit PCM WAV.
    If the file has an audio stream, extracts and normalizes it.
    If the file is a video without an audio track, synthesizes a 16kHz silent WAV.
    """
    ffmpeg_bin = get_ffmpeg_path()
    if not ffmpeg_bin:
        if input_path.lower().endswith(".wav"):
            shutil.copyfile(input_path, output_path)
            return True, "Direct copy (ffmpeg not found on host)"
        shutil.copyfile(input_path, output_path)
        return True, "Copied file (ffmpeg not found on host)"

    # Probe input for audio stream and duration
    proc = subprocess.run(
        [ffmpeg_bin, "-i", input_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stderr = proc.stderr
    has_audio = "Audio:" in stderr

    dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", stderr)
    duration = 60.0
    if dur_match:
        h, m, s = dur_match.groups()
        duration = max(1.0, int(h) * 3600 + int(m) * 60 + float(s))

    if has_audio:
        cmd = [
            ffmpeg_bin,
            "-y",
            "-i", input_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            output_path
        ]
    else:
        logger.info("File has no audio stream (silent/visual video). Synthesizing silent 16k WAV.")
        cmd = [
            ffmpeg_bin,
            "-y",
            "-f", "lavfi",
            "-i", "anullsrc=r=16000:cl=mono",
            "-t", str(duration),
            "-acodec", "pcm_s16le",
            output_path
        ]

    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            logger.error("ffmpeg conversion error: %s", res.stderr)
            return False, res.stderr
        return True, "Converted successfully"
    except Exception as e:
        logger.error("ffmpeg execution exception: %s", str(e))
        return False, str(e)


def range_requests_response_generator(
    file_path: str, start: int, end: int, chunk_size: int = 128 * 1024
) -> Generator[bytes, None, None]:
    """
    Yields chunks of a file for HTTP Range partial content responses.
    """
    with open(file_path, "rb") as f:
        f.seek(start)
        bytes_to_read = end - start + 1
        while bytes_to_read > 0:
            read_amt = min(chunk_size, bytes_to_read)
            data = f.read(read_amt)
            if not data:
                break
            bytes_to_read -= len(data)
            yield data
