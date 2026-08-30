from pathlib import Path
from uuid import uuid4
from urllib.parse import quote
from html import escape
import os
import sqlite3
import mimetypes

import cv2
import numpy as np
import qrcode
from PIL import Image

from fastapi import (
    FastAPI,
    File,
    Form,
    UploadFile,
    HTTPException,
    Request,
)

from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import (
    FileResponse,
    HTMLResponse,
)


# ============================================================
# CONFIGURATION
# ============================================================

BASE = Path(__file__).resolve().parent

UPLOADS = BASE / "uploads"
GENERATED = BASE / "generated"

UPLOADS.mkdir(exist_ok=True)
GENERATED.mkdir(exist_ok=True)

DB = BASE / "app.db"

ERROR_CORRECTION = qrcode.constants.ERROR_CORRECT_H

QR_SIZE = 900


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="PhotoShapeQR - File Sharing QR"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        # Local Vite development
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        # Vercel frontend
        "https://photoshapeqr.vercel.app",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================

def db():

    con = sqlite3.connect(DB)

    # --------------------------------------------------------
    # Shares table
    # --------------------------------------------------------

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS shares (
            id TEXT PRIMARY KEY
        )
        """
    )

    # --------------------------------------------------------
    # Files table
    # --------------------------------------------------------

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            share_id TEXT,
            filename TEXT NOT NULL,
            path TEXT NOT NULL,
            mime TEXT NOT NULL
        )
        """
    )

    con.commit()

    return con


# ============================================================
# PUBLIC BASE URL
# ============================================================

def public_base_url(request: Request) -> str:

    configured = os.getenv(
        "PUBLIC_BASE_URL",
        ""
    ).strip().rstrip("/")

    if configured:

        return configured

    return str(
        request.base_url
    ).rstrip("/")


# ============================================================
# SAFE FILENAME
# ============================================================

def safe_filename(name: str) -> str:

    name = (
        name or "file.bin"
    ).replace("\\", "/")

    parts = [
        part
        for part in name.split("/")
        if part not in ("", ".", "..")
    ]

    return "/".join(parts) or "file.bin"


# ============================================================
# CREATE SHARE
# ============================================================

def create_share():

    share_id = uuid4().hex

    con = db()

    con.execute(
        """
        INSERT INTO shares (id)
        VALUES (?)
        """,
        (share_id,)
    )

    con.commit()

    con.close()

    return share_id


# ============================================================
# SAVE FILE INTO SHARE
# ============================================================

def save_file_to_share(
    upload: UploadFile,
    share_id: str
):

    file_id = uuid4().hex

    original_filename = safe_filename(
        upload.filename
    )

    # We keep only the filename for physical storage.
    filename = Path(
        original_filename
    ).name

    storage_name = (
        f"{file_id}_{filename}"
    )

    path = UPLOADS / storage_name

    data = upload.file.read()

    path.write_bytes(data)

    mime = (
        upload.content_type
        or mimetypes.guess_type(filename)[0]
        or "application/octet-stream"
    )

    con = db()

    con.execute(
        """
        INSERT INTO files
        (
            id,
            share_id,
            filename,
            path,
            mime
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            file_id,
            share_id,
            filename,
            str(path),
            mime,
        )
    )

    con.commit()

    con.close()

    return file_id


# ============================================================
# CREATE QR IMAGE
# ============================================================

def make_qr(data: str) -> Image.Image:

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECTION,
        box_size=18,
        border=5,
    )

    qr.add_data(data)

    qr.make(
        fit=True
    )

    image = qr.make_image(
        fill_color="black",
        back_color="white"
    ).convert("RGB")

    image = image.resize(
        (QR_SIZE, QR_SIZE),
        Image.Resampling.NEAREST
    )

    return image


# ============================================================
# QR DECODER
# ============================================================

def decode_qr(
    image_bytes: bytes
):

    array = np.frombuffer(
        image_bytes,
        dtype=np.uint8
    )

    image = cv2.imdecode(
        array,
        cv2.IMREAD_COLOR
    )

    if image is None:

        return None

    detector = cv2.QRCodeDetector()

    attempts = [
        image,
        cv2.cvtColor(
            image,
            cv2.COLOR_BGR2GRAY
        )
    ]

    for attempt in attempts:

        try:

            value, points, _ = (
                detector.detectAndDecode(
                    attempt
                )
            )

            if value:

                return value

        except Exception:

            pass

    return None


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():

    return {
        "ok": True,
        "service": "PhotoShapeQR backend"
    }


# ============================================================
# GENERATE QR
# ============================================================

@app.post("/api/generate")
async def generate(

    request: Request,

    content_type: str = Form(...),

    text: str = Form(""),

    content_file: UploadFile | None = File(
        None
    ),

    content_files: list[UploadFile] = File(
        default=[]
    ),
):

    # ========================================================
    # URL
    # ========================================================

    if content_type == "url":

        payload = text.strip()

        if not payload:

            raise HTTPException(
                status_code=400,
                detail="Enter a URL."
            )


    # ========================================================
    # TEXT
    # ========================================================

    elif content_type == "text":

        payload = text

        if not payload.strip():

            raise HTTPException(
                status_code=400,
                detail="Enter some text."
            )


    # ========================================================
    # SINGLE FILE
    # ========================================================

    elif content_type in {
        "file",
        "image",
        "audio",
        "video",
    }:

        if not content_file:

            raise HTTPException(
                status_code=400,
                detail="Select a file."
            )

        share_id = create_share()

        save_file_to_share(
            content_file,
            share_id
        )

        payload = (
            f"{public_base_url(request)}"
            f"/share/{quote(share_id)}"
        )


    # ========================================================
    # MULTIPLE FILES
    # ========================================================

    elif content_type == "folder":

        if not content_files:

            raise HTTPException(
                status_code=400,
                detail="Select at least one file."
            )

        share_id = create_share()

        saved_count = 0

        for upload in content_files:

            if not upload.filename:

                continue

            save_file_to_share(
                upload,
                share_id
            )

            saved_count += 1

        if saved_count == 0:

            raise HTTPException(
                status_code=400,
                detail="No valid files were selected."
            )

        # ----------------------------------------------------
        # ONE URL FOR ALL FILES
        # ----------------------------------------------------

        payload = (
            f"{public_base_url(request)}"
            f"/share/{quote(share_id)}"
        )


    # ========================================================
    # UNSUPPORTED TYPE
    # ========================================================

    else:

        raise HTTPException(
            status_code=400,
            detail="Unsupported content type."
        )


    # ========================================================
    # CREATE QR
    # ========================================================

    qr_id = uuid4().hex

    qr_path = (
        GENERATED
        / f"{qr_id}.png"
    )

    qr_image = make_qr(
        payload
    )

    qr_image.save(
        qr_path,
        "PNG"
    )


    # ========================================================
    # RESPONSE
    # ========================================================

    return {

        "id": qr_id,

        "qr_url":
            f"{public_base_url(request)}"
            f"/api/generated/{qr_id}",

        "payload": payload,

        "content_type": content_type,

    }


# ============================================================
# SERVE GENERATED QR IMAGE
# ============================================================

@app.get(
    "/api/generated/{qr_id}"
)
def generated(
    qr_id: str
):

    path = (
        GENERATED
        / f"{qr_id}.png"
    )

    if not path.exists():

        raise HTTPException(
            status_code=404,
            detail="QR not found."
        )

    return FileResponse(
        path,
        media_type="image/png",
        filename=f"qr_{qr_id}.png"
    )


# ============================================================
# SHARE PAGE
# ============================================================

@app.get(
    "/share/{share_id}",
    response_class=HTMLResponse
)
def share_page(

    share_id: str,

    request: Request

):

    con = db()

    # --------------------------------------------------------
    # Check share
    # --------------------------------------------------------

    share = con.execute(
        """
        SELECT id
        FROM shares
        WHERE id = ?
        """,
        (share_id,)
    ).fetchone()

    if not share:

        con.close()

        raise HTTPException(
            status_code=404,
            detail="Share not found."
        )


    # --------------------------------------------------------
    # Get files
    # --------------------------------------------------------

    rows = con.execute(
        """
        SELECT
            id,
            filename,
            mime
        FROM files
        WHERE share_id = ?
        ORDER BY rowid
        """,
        (share_id,)
    ).fetchall()

    con.close()


    if not rows:

        raise HTTPException(
            status_code=404,
            detail="No files found."
        )


    base = public_base_url(
        request
    )


    # ========================================================
    # BUILD FILE CARDS
    # ========================================================

    file_cards = ""


    for (
        file_id,
        filename,
        mime
    ) in rows:

        safe_name = escape(
            filename
        )

        encoded_id = quote(
            file_id,
            safe=""
        )

        file_url = (
            f"{base}/api/files/{encoded_id}"
        )

        safe_url = escape(
            file_url,
            quote=True
        )


        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        if mime.startswith(
            "image/"
        ):

            preview = f"""
            <img
                src="{safe_url}"
                class="preview"
                alt="{safe_name}"
            />
            """

            view_button = f"""
            <a
                href="{safe_url}"
                target="_blank"
                rel="noopener noreferrer"
                class="button view"
            >
                View
            </a>
            """


        # ----------------------------------------------------
        # VIDEO
        # ----------------------------------------------------

        elif mime.startswith(
            "video/"
        ):

            preview = f"""
            <video
                controls
                class="preview"
            >
                <source
                    src="{safe_url}"
                    type="{escape(mime)}"
                >
            </video>
            """

            view_button = f"""
            <a
                href="{safe_url}"
                target="_blank"
                rel="noopener noreferrer"
                class="button view"
            >
                Open
            </a>
            """


        # ----------------------------------------------------
        # AUDIO
        # ----------------------------------------------------

        elif mime.startswith(
            "audio/"
        ):

            preview = f"""
            <div class="iconPreview">
                🎵
            </div>

            <audio
                controls
                class="audio"
            >
                <source
                    src="{safe_url}"
                    type="{escape(mime)}"
                >
            </audio>
            """

            view_button = ""


        # ----------------------------------------------------
        # PDF
        # ----------------------------------------------------

        elif mime == "application/pdf":

            preview = """
            <div class="iconPreview">
                📕
            </div>
            """

            view_button = f"""
            <a
                href="{safe_url}"
                target="_blank"
                rel="noopener noreferrer"
                class="button view"
            >
                Open PDF
            </a>
            """


        # ----------------------------------------------------
        # OTHER FILES
        # ----------------------------------------------------

        else:

            preview = """
            <div class="iconPreview">
                📄
            </div>
            """

            view_button = ""


        # ----------------------------------------------------
        # FILE CARD
        # ----------------------------------------------------

        file_cards += f"""

        <div class="fileCard">

            <div class="previewContainer">

                {preview}

            </div>


            <div class="fileInfo">

                <div class="filename">

                    {safe_name}

                </div>


                <div class="mime">

                    {escape(mime)}

                </div>


                <div class="buttons">

                    {view_button}

                    <a
                        href="{safe_url}"
                        class="button download"
                        download
                    >
                        Download
                    </a>

                </div>

            </div>

        </div>

        """


    count = len(rows)


    # ========================================================
    # HTML PAGE
    # ========================================================

    html = f"""

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<meta
    name="description"
    content="Files shared using PhotoShapeQR"
>

<title>
    PhotoShapeQR - Shared Files
</title>


<style>

* {{
    box-sizing: border-box;
}}


body {{

    margin: 0;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    background:
        linear-gradient(
            135deg,
            #f5f7ff,
            #ffffff
        );

    color: #222;

    min-height: 100vh;

}}


.container {{

    width: 100%;

    max-width: 1000px;

    margin: auto;

    padding:
        20px 16px 50px;

}}


.header {{

    text-align: center;

    padding:
        25px 0 30px;

}}


.logo {{

    font-size: 34px;

    font-weight: 800;

    letter-spacing: -1px;

}}


.subtitle {{

    margin-top: 8px;

    color: #666;

    font-size: 16px;

}}


.files {{

    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(
                280px,
                1fr
            )
        );

    gap: 20px;

}}


.fileCard {{

    background: #ffffff;

    border:
        1px solid #e8e8e8;

    border-radius: 18px;

    padding: 16px;

    box-shadow:
        0 8px 30px
        rgba(
            0,
            0,
            0,
            0.08
        );

    overflow: hidden;

}}


.previewContainer {{

    width: 100%;

    height: 230px;

    display: flex;

    justify-content: center;

    align-items: center;

    background: #f5f5f5;

    border-radius: 14px;

    overflow: hidden;

    position: relative;

}}


.preview {{

    width: 100%;

    height: 100%;

    object-fit: contain;

}}


.iconPreview {{

    font-size: 75px;

}}


.audio {{

    position: absolute;

    bottom: 20px;

    left: 5%;

    width: 90%;

}}


.fileInfo {{

    padding-top: 15px;

}}


.filename {{

    font-size: 17px;

    font-weight: 700;

    line-height: 1.4;

    word-break: break-word;

}}


.mime {{

    color: #888;

    font-size: 12px;

    margin-top: 5px;

    word-break: break-word;

}}


.buttons {{

    display: flex;

    gap: 8px;

    margin-top: 14px;

    flex-wrap: wrap;

}}


.button {{

    display: inline-block;

    text-decoration: none;

    padding:
        10px 15px;

    border-radius: 9px;

    font-weight: 700;

    font-size: 14px;

}}


.view {{

    background: #eeeeee;

    color: #222;

}}


.download {{

    background: #111111;

    color: #ffffff;

}}


.footer {{

    text-align: center;

    color: #777;

    margin-top: 40px;

    font-size: 13px;

}}


@media (max-width: 600px) {{

    .container {{

        padding:
            15px 12px 40px;

    }}

    .logo {{

        font-size: 28px;

    }}

    .fileCard {{

        border-radius: 14px;

    }}

    .previewContainer {{

        height: 210px;

    }}

}}


</style>

</head>


<body>


<div class="container">


    <div class="header">

        <div class="logo">

            📦 PhotoShapeQR

        </div>


        <div class="subtitle">

            {count} file(s) shared

        </div>

    </div>


    <div class="files">

        {file_cards}

    </div>


    <div class="footer">

        Shared securely using PhotoShapeQR

    </div>


</div>


</body>

</html>

"""

    return HTMLResponse(
        content=html
    )


# ============================================================
# SERVE INDIVIDUAL FILE
# ============================================================

@app.get(
    "/api/files/{file_id}"
)
def get_file(

    file_id: str,

    download: bool = False

):

    con = db()

    row = con.execute(
        """
        SELECT
            filename,
            path,
            mime
        FROM files
        WHERE id = ?
        """,
        (file_id,)
    ).fetchone()

    con.close()


    if not row:

        raise HTTPException(
            status_code=404,
            detail="Shared file not found."
        )


    filename, path, mime = row

    file_path = Path(
        path
    )


    if not file_path.exists():

        raise HTTPException(
            status_code=404,
            detail="Stored file is missing."
        )


    # --------------------------------------------------------
    # Content-Disposition
    # --------------------------------------------------------

    encoded_filename = quote(
        filename
    )

    disposition = (
        "attachment"
        if download
        else "inline"
    )

    headers = {

        "Content-Disposition":
            f"{disposition}; "
            f"filename*=UTF-8''{encoded_filename}"

    }


    return FileResponse(

        file_path,

        media_type=mime,

        headers=headers

    )


# ============================================================
# QR SCANNING
# ============================================================

@app.post(
    "/api/scan"
)
async def scan(

    qr_image: UploadFile = File(...)

):

    raw = await qr_image.read()

    value = decode_qr(
        raw
    )


    if not value:

        raise HTTPException(
            status_code=422,
            detail="Could not decode this QR code."
        )


    return {
        "value": value
    }