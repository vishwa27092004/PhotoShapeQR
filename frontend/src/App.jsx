import { useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TYPES = [
  ["url", "🔗", "URL"],
  ["text", "📝", "Text"],
  ["file", "📄", "Document"],
  ["image", "🖼️", "Image"],
  ["audio", "🎵", "MP3 / Audio"],
  ["video", "🎬", "MP4 / Video"],
  ["folder", "📁", "Folder"],
];

function App() {
  const [type, setType] = useState("url");
  const [text, setText] = useState("https://example.com");
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [qr, setQr] = useState(null);
  const [scanResult, setScanResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const scannerInput = useRef();

  const resetContent = (nextType) => {
    setType(nextType);
    setFile(null);
    setFiles([]);
    setMessage("");
  };

  const generate = async () => {
    setBusy(true);
    setMessage("");
    setQr(null);

    try {
      const form = new FormData();
      form.append("content_type", type);
      form.append("text", text);

      if (type === "folder") {
        files.forEach((f) => form.append("content_files", f, f.webkitRelativePath || f.name));
      } else if (["file", "image", "audio", "video"].includes(type)) {
        if (!file) throw new Error("Please select a file.");
        form.append("content_file", file);
      }

      const response = await fetch(`${API}/api/generate`, {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Generation failed.");

      setQr(data);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const scan = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setBusy(true);
    setScanResult("");
    setMessage("");

    try {
      const form = new FormData();
      form.append("qr_image", selected);

      const response = await fetch(`${API}/api/scan`, {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Could not scan QR.");

      setScanResult(data.value);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const downloadQR = () => {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr.qr_url;
    a.download = "photoshapeqr.png";
    a.click();
  };

  const openScanResult = () => {
    if (!scanResult) return;
    window.open(scanResult, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="brandIcon">QR</div>
          <div>
            <h1>PhotoShape<span>QR</span></h1>
            <p>Share links, text and files with a QR code</p>
          </div>
        </div>
        <div className="headerBadge">Simple • Fast • Scannable</div>
      </header>

      <main>
        <section className="panel">
          <h2>Create QR Code</h2>
          <p className="muted">Choose what you want to share.</p>

          <div className="typeGrid">
            {TYPES.map(([value, icon, label]) => (
              <button
                key={value}
                className={type === value ? "type active" : "type"}
                onClick={() => resetContent(value)}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {type === "url" && (
            <label>
              Website URL
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="https://example.com"
              />
            </label>
          )}

          {type === "text" && (
            <label>
              Text
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your message..."
                rows="6"
              />
            </label>
          )}

          {["file", "image", "audio", "video"].includes(type) && (
            <label className="uploadBox">
              <strong>
                {type === "audio" ? "Choose an MP3/audio file" :
                 type === "video" ? "Choose an MP4/video file" :
                 type === "image" ? "Choose an image" :
                 "Choose a document"}
              </strong>
              <span>{file ? file.name : "Click to browse"}</span>
              <input
                type="file"
                accept={
                  type === "audio" ? "audio/*" :
                  type === "video" ? "video/*" :
                  type === "image" ? "image/*" :
                  "*/*"
                }
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          )}

          {type === "folder" && (
            <label className="uploadBox">
              <strong>Select a complete folder</strong>
              <span>
                {files.length
                  ? `${files.length} file(s) selected`
                  : "Click to choose a folder"}
              </span>
              <input
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </label>
          )}

          <button className="generate" onClick={generate} disabled={busy}>
            {busy ? "Working..." : "Generate QR Code"}
          </button>

          {message && <div className="error">{message}</div>}

          <div className="note">
            <strong>Important for phone sharing</strong>
            <span>
              The QR must contain an address your phone can reach. For local
              testing, open the website using your computer's Wi-Fi IP address.
            </span>
          </div>
        </section>

        <section className="panel previewPanel">
          <h2>Your QR Code</h2>

          {qr ? (
            <>
              <div className="qrBox">
                <img src={qr.qr_url} alt="Generated QR code" />
              </div>

              <div className="success">✓ QR code generated successfully</div>

              <div className="payload">
                <b>Encoded content</b>
                <div>{qr.payload}</div>
              </div>

              <button className="download" onClick={downloadQR}>
                Download QR PNG
              </button>
            </>
          ) : (
            <div className="empty">
              <div className="emptyIcon">▦</div>
              <h3>Your QR code will appear here</h3>
              <p>Select URL, text, document, image, MP3, MP4 or a complete folder.</p>
            </div>
          )}
        </section>

        <section className="panel scanner">
          <h2>Scan QR Code</h2>
          <p className="muted">
            Upload a QR image. If it contains a shared file, the link will open
            the file download.
          </p>

          <input
            ref={scannerInput}
            type="file"
            accept="image/*"
            onChange={scan}
            hidden
          />

          <button
            className="scanButton"
            onClick={() => scannerInput.current?.click()}
            disabled={busy}
          >
            Scan QR Image
          </button>

          {scanResult && (
            <div className="scanResult">
              <b>QR content</b>
              <div className="resultText">{scanResult}</div>
              <button className="download" onClick={openScanResult}>
                Open / Download
              </button>
            </div>
          )}
        </section>
      </main>

      <footer>
        PhotoShapeQR • Normal QR generation with URL, text, documents, images,
        audio, video and folder sharing.
      </footer>
    </div>
  );
}

export default App;
