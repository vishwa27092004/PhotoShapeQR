# PhotoShapeQR - Normal QR File Sharing Website

This version intentionally removes image-shaped QR generation.

Supported:
- URL
- Text
- Documents
- Images
- MP3 / audio
- MP4 / video
- Complete folders (folder is compressed to ZIP)
- QR image download
- QR image scanning

## Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0
```

## Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## Phone testing

Find your PC IPv4 address:

```powershell
ipconfig
```

For example:

`192.168.1.5`

Then open the frontend on the PC/phone using:

`http://192.168.1.5:5173`

Set the backend public address before starting it:

PowerShell:

```powershell
$env:PUBLIC_BASE_URL="http://192.168.1.5:8000"
python -m uvicorn main:app --reload --host 0.0.0.0
```

Both phone and PC must be on the same Wi-Fi network.

Windows Firewall may ask permission for Python. Allow it on the private network.

For real public sharing outside your Wi-Fi, deploy the backend and storage to a public server/cloud and set PUBLIC_BASE_URL to the public HTTPS address.
