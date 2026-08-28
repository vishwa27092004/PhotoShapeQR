from pathlib import Path
from uuid import uuid4
from urllib.parse import quote
import io
import os
import sqlite3
import zipfile
import mimetypes

import cv2
import numpy as np
import qrcode
from PIL import Image
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

BASE = Path(__file__).resolve().parent
UPLOADS = BASE / "uploads"
GENERATED = BASE / "generated"
UPLOADS.mkdir(exist_ok=True)
GENERATED.mkdir(exist_ok=True)

DB = BASE / "app.db"
ERROR_CORRECTION = qrcode.constants.ERROR_CORRECT_H
QR_SIZE = 900

app = FastAPI(title="PhotoShapeQR - File Sharing QR")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://photoshapeqr.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def db():
    con = sqlite3.connect(DB)
    con.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            path TEXT NOT NULL,
            mime TEXT NOT NULL
        )
    """)
    con.commit()
    return con

def public_base_url(request: Request) -> str:
    configured = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
    if configured:
        return configured

    # If the browser opened the frontend using a LAN IP, use that host.
    # Otherwise this will normally be localhost/127.0.0.1.
    return str(request.base_url).rstrip("/")

def save_record(file_id: str, filename: str, path: Path, mime: str):
    con = db()
    con.execute(
        "INSERT INTO files (id, filename, path, mime) VALUES (?, ?, ?, ?)",
        (file_id, filename, str(path), mime),
    )
    con.commit()
    con.close()

def safe_filename(name: str) -> str:
    name = (name or "file.bin").replace("\\", "/")
    parts = [p for p in name.split("/") if p not in ("", ".", "..")]
    return "/".join(parts) or "file.bin"

def save_single_upload(upload: UploadFile):
    file_id = uuid4().hex
    filename = safe_filename(upload.filename)
    # A single file must not create nested directories.
    filename = Path(filename).name
    path = UPLOADS / f"{file_id}_{filename}"
    path.write_bytes(upload.file.read())

    mime = (
        upload.content_type
        or mimetypes.guess_type(filename)[0]
        or "application/octet-stream"
    )
    save_record(file_id, filename, path, mime)
    return file_id

def save_folder_uploads(uploads: list[UploadFile]):
    if not uploads:
        raise HTTPException(400, "Select at least one folder file.")

    folder_id = uuid4().hex
    zip_path = UPLOADS / f"{folder_id}.zip"

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for upload in uploads:
            arcname = safe_filename(upload.filename)
            if not arcname:
                continue
            zf.writestr(arcname, upload.file.read())

    save_record(
        folder_id,
        f"shared_folder_{folder_id[:8]}.zip",
        zip_path,
        "application/zip",
    )
    return folder_id

def make_qr(data: str) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECTION,
        box_size=18,
        border=5,
    )
    qr.add_data(data)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    image = image.resize((QR_SIZE, QR_SIZE), Image.Resampling.NEAREST)
    return image

def decode_qr(image_bytes: bytes):
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        return None

    detector = cv2.QRCodeDetector()

    attempts = [image, cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)]
    for attempt in attempts:
        try:
            value, points, _ = detector.detectAndDecode(attempt)
            if value:
                return value
        except Exception:
            pass
    return None

@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/generate")
async def generate(
    request: Request,
    content_type: str = Form(...),
    text: str = Form(""),
    content_file: UploadFile | None = File(None),
    content_files: list[UploadFile] = File(default=[]),
):
    if content_type == "url":
        payload = text.strip()
        if not payload:
            raise HTTPException(400, "Enter a URL.")

    elif content_type == "text":
        payload = text
        if not payload.strip():
            raise HTTPException(400, "Enter some text.")

    elif content_type in {"file", "image", "audio", "video"}:
        if not content_file:
            raise HTTPException(400, "Select a file.")
        file_id = save_single_upload(content_file)
        payload = f"{public_base_url(request)}/api/files/{quote(file_id)}"

    elif content_type == "folder":
        file_id = save_folder_uploads(content_files)
        payload = f"{public_base_url(request)}/api/files/{quote(file_id)}"

    else:
        raise HTTPException(400, "Unsupported content type.")

    qr_id = uuid4().hex
    qr_path = GENERATED / f"{qr_id}.png"
    qr_image = make_qr(payload)
    qr_image.save(qr_path, "PNG")

    return {
        "id": qr_id,
        "qr_url": f"{public_base_url(request)}/api/generated/{qr_id}",
        "payload": payload,
        "content_type": content_type,
    }

@app.get("/api/generated/{qr_id}")
def generated(qr_id: str):
    path = GENERATED / f"{qr_id}.png"
    if not path.exists():
        raise HTTPException(404, "QR not found.")
    return FileResponse(path, media_type="image/png", filename=f"qr_{qr_id}.png")

@app.get("/api/files/{file_id}")
def get_file(file_id: str):
    con = db()
    row = con.execute(
        "SELECT filename, path, mime FROM files WHERE id=?",
        (file_id,),
    ).fetchone()
    con.close()

    if not row:
        raise HTTPException(404, "Shared item not found.")

    filename, path, mime = row
    file_path = Path(path)

    if not file_path.exists():
        raise HTTPException(404, "Stored file is missing.")

    return FileResponse(
        file_path,
        media_type=mime,
        filename=filename,
    )

@app.post("/api/scan")
async def scan(qr_image: UploadFile = File(...)):
    raw = await qr_image.read()
    value = decode_qr(raw)

    if not value:
        raise HTTPException(422, "Could not decode this QR code.")

    return {"value": value}
