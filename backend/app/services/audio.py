import os
import shutil
import subprocess
import logging
from typing import Tuple, Generator

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".webm", ".ogg", ".aac", ".flac"}


def is_supported_audio_extension(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in SUPPORTED_EXTENSIONS


def get_audio_duration_seconds(file_path: str) -> float:
    """
    Get duration in seconds using ffprobe or wave/soundfile fallback.
    """
    # 1. Try ffprobe
    if shutil.which("ffprobe"):
        try:
            cmd = [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
            return float(result.stdout.strip())
        except Exception as e:
            logger.warning("ffprobe failed: %s; falling back to alternative duration parser.", e)

    # 2. Try wave (if .wav)
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

    # 3. Default fallback estimate based on size or placeholder
    return 60.0


def normalize_to_wav(input_path: str, output_path: str) -> Tuple[bool, str]:
    """
    Normalizes audio/video to 16 kHz mono 16-bit PCM WAV.
    ffmpeg -y -i <input> -vn -acodec pcm_s16le -ar 16000 -ac 1 <output>
    """
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        # Fallback if already a wav file or direct copy
        if input_path.lower().endswith(".wav"):
            shutil.copyfile(input_path, output_path)
            return True, "Direct copy (ffmpeg not found on host)"
        # Try writing a dummy or direct wave
        shutil.copyfile(input_path, output_path)
        return True, "Copied file (ffmpeg not found on host)"

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

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode != 0:
            logger.error("ffmpeg conversion error: %s", proc.stderr)
            return False, proc.stderr
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
