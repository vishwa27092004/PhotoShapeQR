import { useRef, useState } from "react";


// ============================================================
// API URL
// ============================================================
//
// Local:
// http://localhost:8000
//
// Production:
// VITE_API_URL=https://photoshapeqr-backend.onrender.com
//

const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";


// ============================================================
// QR TYPES
// ============================================================

const TYPES = [

  ["url", "🔗", "URL"],

  ["text", "📝", "Text"],

  ["file", "📄", "Document"],

  ["image", "🖼️", "Image"],

  ["audio", "🎵", "MP3 / Audio"],

  ["video", "🎬", "MP4 / Video"],

  ["folder", "📦", "Multiple Files"],

];


// ============================================================
// APP
// ============================================================

function App() {


  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------

  const [type, setType] =
    useState("url");


  const [text, setText] =
    useState("https://example.com");


  const [file, setFile] =
    useState(null);


  const [files, setFiles] =
    useState([]);


  const [qr, setQr] =
    useState(null);


  const [scanResult, setScanResult] =
    useState("");


  const [busy, setBusy] =
    useState(false);


  const [message, setMessage] =
    useState("");


  const scannerInput =
    useRef(null);


  // ========================================================
  // RESET
  // ========================================================

  const resetContent = (
    nextType
  ) => {

    setType(nextType);

    setFile(null);

    setFiles([]);

    setMessage("");

    setQr(null);

  };


  // ========================================================
  // GENERATE QR
  // ========================================================

  const generate = async () => {

    setBusy(true);

    setMessage("");

    setQr(null);


    try {

      // ------------------------------------------------------
      // Create FormData
      // ------------------------------------------------------

      const form =
        new FormData();


      form.append(
        "content_type",
        type
      );


      form.append(
        "text",
        text
      );


      // ------------------------------------------------------
      // Multiple Files
      // ------------------------------------------------------

      if (type === "folder") {

        if (!files.length) {

          throw new Error(
            "Please select at least one file."
          );

        }


        files.forEach(
          (selectedFile) => {

            form.append(
              "content_files",
              selectedFile,
              selectedFile.name
            );

          }
        );

      }


      // ------------------------------------------------------
      // Single File
      // ------------------------------------------------------

      else if (
        [
          "file",
          "image",
          "audio",
          "video",
        ].includes(type)
      ) {

        if (!file) {

          throw new Error(
            "Please select a file."
          );

        }


        form.append(
          "content_file",
          file
        );

      }


      // ------------------------------------------------------
      // Send Request
      // ------------------------------------------------------

      const response =
        await fetch(
          `${API}/api/generate`,
          {
            method: "POST",
            body: form,
          }
        );


      // ------------------------------------------------------
      // Read Response
      // ------------------------------------------------------

      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Generation failed."
        );

      }


      // ------------------------------------------------------
      // Show QR
      // ------------------------------------------------------

      setQr(data);

    }


    catch (err) {

      setMessage(
        err.message ||
        "Something went wrong."
      );

    }


    finally {

      setBusy(false);

    }

  };


  // ========================================================
  // SCAN QR
  // ========================================================

  const scan = async (
    event
  ) => {

    const selected =
      event.target.files?.[0];


    if (!selected) {

      return;

    }


    setBusy(true);

    setScanResult("");

    setMessage("");


    try {

      const form =
        new FormData();


      form.append(
        "qr_image",
        selected
      );


      const response =
        await fetch(
          `${API}/api/scan`,
          {
            method: "POST",
            body: form,
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Could not scan QR."
        );

      }


      setScanResult(
        data.value
      );

    }


    catch (err) {

      setMessage(
        err.message ||
        "Could not scan QR."
      );

    }


    finally {

      setBusy(false);

      event.target.value = "";

    }

  };


  // ========================================================
  // DOWNLOAD QR
  // ========================================================

  const downloadQR = () => {

    if (!qr) {

      return;

    }


    const a =
      document.createElement(
        "a"
      );


    a.href =
      qr.qr_url;


    a.download =
      "photoshapeqr.png";


    document.body.appendChild(
      a
    );


    a.click();


    document.body.removeChild(
      a
    );

  };


  // ========================================================
  // OPEN SCAN RESULT
  // ========================================================

  const openScanResult = () => {

    if (!scanResult) {

      return;

    }


    window.open(
      scanResult,
      "_blank",
      "noopener,noreferrer"
    );

  };


  // ========================================================
  // RENDER
  // ========================================================

  return (

    <div className="app">


      {/* ================================================== */}
      {/* HEADER                                             */}
      {/* ================================================== */}

      <header>

        <div className="brand">

          <div className="brandIcon">
            QR
          </div>


          <div>

            <h1>
              PhotoShape<span>QR</span>
            </h1>


            <p>
              Share links, text and files with a QR code
            </p>

          </div>

        </div>


        <div className="headerBadge">

          Simple • Fast • Scannable

        </div>

      </header>


      {/* ================================================== */}
      {/* MAIN                                               */}
      {/* ================================================== */}

      <main>


        {/* ================================================= */}
        {/* CREATE QR                                         */}
        {/* ================================================= */}

        <section className="panel">


          <h2>
            Create QR Code
          </h2>


          <p className="muted">

            Choose what you want to share.

          </p>


          {/* ============================================== */}
          {/* TYPE GRID                                      */}
          {/* ============================================== */}

          <div className="typeGrid">

            {TYPES.map(
              ([
                value,
                icon,
                label,
              ]) => (

                <button
                  key={value}
                  type="button"
                  className={
                    type === value
                      ? "type active"
                      : "type"
                  }
                  onClick={() =>
                    resetContent(
                      value
                    )
                  }
                >

                  <span>
                    {icon}
                  </span>

                  {label}

                </button>

              )
            )}

          </div>


          {/* ============================================== */}
          {/* URL                                             */}
          {/* ============================================== */}

          {type === "url" && (

            <label>

              Website URL

              <input
                type="url"
                value={text}
                onChange={(e) =>
                  setText(
                    e.target.value
                  )
                }
                placeholder="https://example.com"
              />

            </label>

          )}


          {/* ============================================== */}
          {/* TEXT                                            */}
          {/* ============================================== */}

          {type === "text" && (

            <label>

              Text

              <textarea
                value={text}
                onChange={(e) =>
                  setText(
                    e.target.value
                  )
                }
                placeholder="Enter your message..."
                rows="6"
              />

            </label>

          )}


          {/* ============================================== */}
          {/* SINGLE FILE                                     */}
          {/* ============================================== */}

          {[
            "file",
            "image",
            "audio",
            "video",
          ].includes(type) && (

            <label className="uploadBox">


              <strong>

                {type === "audio"
                  ? "Choose an MP3/audio file"
                  : type === "video"
                  ? "Choose an MP4/video file"
                  : type === "image"
                  ? "Choose an image"
                  : "Choose a document"}

              </strong>


              <span>

                {file
                  ? file.name
                  : "Click to browse"}

              </span>


              <input
                type="file"
                accept={
                  type === "audio"
                    ? "audio/*"
                    : type === "video"
                    ? "video/*"
                    : type === "image"
                    ? "image/*"
                    : "*/*"
                }
                onChange={(e) =>
                  setFile(
                    e.target.files?.[0] ||
                    null
                  )
                }
              />


            </label>

          )}


          {/* ============================================== */}
          {/* MULTIPLE FILES                                  */}
          {/* ============================================== */}

          {type === "folder" && (

            <label className="uploadBox">


              <strong>

                Select multiple images / files

              </strong>


              <span>

                {files.length
                  ? `${files.length} file(s) selected`
                  : "Click to choose multiple files"}

              </span>


              <input
                type="file"
                multiple
                accept="*/*"
                onChange={(e) =>
                  setFiles(
                    Array.from(
                      e.target.files ||
                      []
                    )
                  )
                }
              />


            </label>

          )}


          {/* ============================================== */}
          {/* SELECTED FILE LIST                              */}
          {/* ============================================== */}

          {type === "folder" &&
            files.length > 0 && (

              <div
                style={{
                  marginTop: "15px",
                  padding: "14px",
                  background: "#f7f7f7",
                  borderRadius: "12px",
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
              >

                <strong>

                  Selected files:

                </strong>


                <ul
                  style={{
                    marginTop: "10px",
                    paddingLeft: "20px",
                  }}
                >

                  {files.map(
                    (selectedFile, index) => (

                      <li
                        key={
                          `${selectedFile.name}-${index}`
                        }
                        style={{
                          marginBottom:
                            "5px",
                          wordBreak:
                            "break-word",
                        }}
                      >

                        {selectedFile.name}

                      </li>

                    )
                  )}

                </ul>

              </div>

            )}


          {/* ============================================== */}
          {/* GENERATE BUTTON                                 */}
          {/* ============================================== */}

          <button
            type="button"
            className="generate"
            onClick={generate}
            disabled={busy}
          >

            {busy
              ? "Working..."
              : "Generate QR Code"}

          </button>


          {/* ============================================== */}
          {/* ERROR                                           */}
          {/* ============================================== */}

          {message && (

            <div className="error">

              {message}

            </div>

          )}


          {/* ============================================== */}
          {/* NOTE                                            */}
          {/* ============================================== */}

          <div className="note">

            <strong>

              Multiple Files → One QR

            </strong>


            <span>

              Select multiple images or files.
              PhotoShapeQR creates one share link
              and one QR code for all selected files.

            </span>

          </div>


        </section>


        {/* ================================================= */}
        {/* QR PREVIEW                                       */}
        {/* ================================================= */}

        <section className="panel previewPanel">


          <h2>
            Your QR Code
          </h2>


          {qr ? (

            <>


              <div className="qrBox">

                <img
                  src={qr.qr_url}
                  alt="Generated QR code"
                />

              </div>


              <div className="success">

                ✓ QR code generated successfully

              </div>


              <div className="payload">

                <b>
                  Encoded content
                </b>


                <div>

                  {qr.payload}

                </div>

              </div>


              <button
                type="button"
                className="download"
                onClick={downloadQR}
              >

                Download QR PNG

              </button>


            </>

          ) : (

            <div className="empty">


              <div className="emptyIcon">
                ▦
              </div>


              <h3>

                Your QR code will appear here

              </h3>


              <p>

                Select URL, text, document,
                image, MP3, MP4 or multiple files.

              </p>


            </div>

          )}


        </section>


        {/* ================================================= */}
        {/* SCANNER                                          */}
        {/* ================================================= */}

        <section className="panel scanner">


          <h2>
            Scan QR Code
          </h2>


          <p className="muted">

            Upload a QR image to read its content.

          </p>


          <input
            ref={scannerInput}
            type="file"
            accept="image/*"
            onChange={scan}
            hidden
          />


          <button
            type="button"
            className="scanButton"
            onClick={() =>
              scannerInput.current?.click()
            }
            disabled={busy}
          >

            Scan QR Image

          </button>


          {scanResult && (

            <div className="scanResult">


              <b>
                QR content
              </b>


              <div className="resultText">

                {scanResult}

              </div>


              <button
                type="button"
                className="download"
                onClick={openScanResult}
              >

                Open Shared Files

              </button>


            </div>

          )}


        </section>


      </main>


      {/* ================================================== */}
      {/* FOOTER                                             */}
      {/* ================================================== */}

      <footer>

        PhotoShapeQR • Share multiple files
        with a single QR code.

      </footer>


    </div>

  );

}


export default App;