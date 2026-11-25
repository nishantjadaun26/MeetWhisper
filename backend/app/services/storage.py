import os
import shutil
import uuid
from typing import Tuple
from fastapi import UploadFile
from app.config import get_settings

settings = get_settings()


class StorageService:
    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def get_meeting_dir(self, meeting_id: str) -> str:
        meeting_dir = os.path.join(self.base_dir, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)
        return meeting_dir

    async def save_uploaded_file(self, upload_file: UploadFile, meeting_id: str) -> Tuple[str, int]:
        meeting_dir = self.get_meeting_dir(meeting_id)
        original_filename = upload_file.filename or f"upload_{uuid.uuid4().hex[:8]}"
        sanitized_filename = os.path.basename(original_filename).replace(" ", "_")
        dest_path = os.path.join(meeting_dir, sanitized_filename)

        size = 0
        with open(dest_path, "wb") as f:
            while chunk := await upload_file.read(1024 * 1024):  # 1MB chunks
                f.write(chunk)
                size += len(chunk)

        return dest_path, size

    def delete_meeting_files(self, meeting_id: str) -> bool:
        meeting_dir = os.path.join(self.base_dir, meeting_id)
        if os.path.exists(meeting_dir):
            shutil.rmtree(meeting_dir, ignore_errors=True)
            return True
        return False


storage_service = StorageService()
