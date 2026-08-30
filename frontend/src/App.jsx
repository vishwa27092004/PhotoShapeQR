import { useRef, useState } from "react";
import "./styles.css";


// ============================================================
// API
// ============================================================

const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";


// ============================================================
// QR TYPES
// ============================================================

const TYPES = [
  {
    value: "url",
    icon: "↗",
    title: "Website",
    description: "Share a URL",
  },

  {
    value: "text",
    icon: "T",
    title: "Text",
    description: "Share a message",
  },

  {
    value: "file",
    icon: "▤",
    title: "Document",
    description: "PDF, DOCX, ZIP...",
  },

  {
    value: "image",
    icon: "◈",
    title: "Image",
    description: "JPG, PNG, WEBP...",
  },

  {
    value: "audio",
    icon: "♫",
    title: "Audio",
    description: "MP3, WAV...",
  },

  {
    value: "video",
    icon: "▶",
    title: "Video",
    description: "MP4, MOV...",
  },

  {
    value: "folder",
    icon: "▦",
    title: "Multiple Files",
    description: "One QR for many files",
  },
];


// ============================================================
// APP
// ============================================================

function App() {

  // ----------------------------------------------------------
  // STATE
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


  // ----------------------------------------------------------
  // RESET
  // ----------------------------------------------------------

  const resetContent = (nextType) => {

    setType(nextType);

    setFile(null);

    setFiles([]);

    setQr(null);

    setMessage("");

    setScanResult("");

  };


  // ==========================================================
  // GENERATE QR
  // ==========================================================

  const generate = async () => {

    setBusy(true);

    setMessage("");

    setQr(null);


    try {

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
      // MULTIPLE FILES
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
      // SINGLE FILE
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
      // API REQUEST
      // ------------------------------------------------------

      const response =
        await fetch(
          `${API}/api/generate`,
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
          "QR generation failed."
        );

      }


      setQr(data);

    }


    catch (error) {

      setMessage(
        error.message ||
        "Something went wrong."
      );

    }


    finally {

      setBusy(false);

    }

  };


  // ==========================================================
  // SCAN QR
  // ==========================================================

  const scan = async (event) => {

    const selected =
      event.target.files?.[0];


    if (!selected) {

      return;

    }


    setBusy(true);

    setMessage("");

    setScanResult("");


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
          "Could not scan QR code."
        );

      }


      setScanResult(
        data.value
      );

    }


    catch (error) {

      setMessage(
        error.message ||
        "Could not scan QR code."
      );

    }


    finally {

      setBusy(false);

      event.target.value = "";

    }

  };


  // ==========================================================
  // DOWNLOAD QR
  // ==========================================================

  const downloadQR = () => {

    if (!qr) {

      return;

    }


    const link =
      document.createElement(
        "a"
      );


    link.href =
      qr.qr_url;


    link.download =
      "PhotoShapeQR.png";


    document.body.appendChild(
      link
    );


    link.click();


    document.body.removeChild(
      link
    );

  };


  // ==========================================================
  // OPEN SCAN RESULT
  // ==========================================================

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


  // ==========================================================
  // FILE ICON
  // ==========================================================

  const getFileIcon = () => {

    if (type === "image") {
      return "◈";
    }

    if (type === "audio") {
      return "♫";
    }

    if (type === "video") {
      return "▶";
    }

    if (type === "folder") {
      return "▦";
    }

    return "▤";

  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="app">


      {/* ==================================================== */}
      {/* BACKGROUND EFFECTS                                  */}
      {/* ==================================================== */}

      <div className="background">

        <div className="orb orbOne"></div>

        <div className="orb orbTwo"></div>

        <div className="orb orbThree"></div>

        <div className="gridBackground"></div>

      </div>


      {/* ==================================================== */}
      {/* HEADER                                               */}
      {/* ==================================================== */}

      <header className="navbar">

        <div className="brand">

          <div className="brandMark">

            <span>⌁</span>

            <span>QR</span>

          </div>


          <div className="brandText">

            <div className="brandName">

              PhotoShape
              <span>QR</span>

            </div>


            <div className="brandTagline">

              Share smarter.

            </div>

          </div>

        </div>


        <div className="statusPill">

          <span className="statusDot"></span>

          Free & Fast

        </div>

      </header>


      {/* ==================================================== */}
      {/* HERO                                                 */}
      {/* ==================================================== */}

      <section className="hero">

        <div className="heroBadge">

          <span>✦</span>

          Instant QR sharing

        </div>


        <h1>

          One QR.
          <br />

          <span>
            Everything shared.
          </span>

        </h1>


        <p>

          Turn links, documents, photos, videos and
          multiple files into one beautiful,
          instantly scannable QR code.

        </p>


        <div className="heroStats">

          <div>

            <strong>
              01
            </strong>

            <span>
              Select
            </span>

          </div>


          <div className="statLine"></div>


          <div>

            <strong>
              02
            </strong>

            <span>
              Generate
            </span>

          </div>


          <div className="statLine"></div>


          <div>

            <strong>
              03
            </strong>

            <span>
              Share
            </span>

          </div>

        </div>

      </section>


      {/* ==================================================== */}
      {/* MAIN                                                  */}
      {/* ==================================================== */}

      <main className="mainContainer">


        {/* ================================================== */}
        {/* CREATE PANEL                                        */}
        {/* ================================================== */}

        <section className="glassPanel createPanel">


          <div className="panelHeader">

            <div>

              <div className="sectionEyebrow">

                CREATE

              </div>


              <h2>

                What do you want to share?

              </h2>


              <p>

                Choose a content type and generate
                your QR code in seconds.

              </p>

            </div>


            <div className="stepBadge">

              STEP 01

            </div>

          </div>


          {/* ================================================= */}
          {/* TYPE CARDS                                        */}
          {/* ================================================= */}

          <div className="typeGrid">

            {TYPES.map(
              (item) => (

                <button
                  key={item.value}
                  type="button"
                  className={
                    type === item.value
                      ? "typeCard active"
                      : "typeCard"
                  }
                  onClick={() =>
                    resetContent(
                      item.value
                    )
                  }
                >

                  <div className="typeIcon">

                    {item.icon}

                  </div>


                  <div className="typeInfo">

                    <strong>

                      {item.title}

                    </strong>


                    <span>

                      {item.description}

                    </span>

                  </div>


                  <div className="typeArrow">

                    →

                  </div>

                </button>

              )
            )}

          </div>


          {/* ================================================= */}
          {/* CONTENT AREA                                      */}
          {/* ================================================= */}

          <div className="contentArea">


            {/* =============================================== */}
            {/* URL                                               */}
            {/* =============================================== */}

            {type === "url" && (

              <div className="fieldGroup">

                <label>

                  Website URL

                </label>


                <div className="inputWrapper">

                  <span className="inputIcon">

                    ↗

                  </span>


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

                </div>

              </div>

            )}


            {/* =============================================== */}
            {/* TEXT                                              */}
            {/* =============================================== */}

            {type === "text" && (

              <div className="fieldGroup">

                <label>

                  Your message

                </label>


                <textarea
                  value={text}
                  onChange={(e) =>
                    setText(
                      e.target.value
                    )
                  }
                  placeholder="Write something you want to share..."
                  rows="6"
                />


                <div className="fieldHint">

                  Your text will be encoded
                  directly into the QR code.

                </div>

              </div>

            )}


            {/* =============================================== */}
            {/* SINGLE FILE                                       */}
            {/* =============================================== */}

            {[
              "file",
              "image",
              "audio",
              "video",
            ].includes(type) && (

              <div className="fieldGroup">

                <label>

                  Select your file

                </label>


                <div className="dropZone">

                  <div className="dropIcon">

                    {getFileIcon()}

                  </div>


                  <h3>

                    {file
                      ? file.name
                      : `Upload ${
                          type === "image"
                            ? "an image"
                            : type === "audio"
                            ? "an audio file"
                            : type === "video"
                            ? "a video"
                            : "a document"
                        }`
                    }

                  </h3>


                  <p>

                    {file
                      ? `${(
                          file.size /
                          1024 /
                          1024
                        ).toFixed(2)} MB`
                      : "Click anywhere to browse your device"
                    }

                  </p>


                  <div className="browseButton">

                    {file
                      ? "Choose another"
                      : "Browse files"
                    }

                  </div>


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

                </div>

              </div>

            )}


            {/* =============================================== */}
            {/* MULTIPLE FILES                                    */}
            {/* =============================================== */}

            {type === "folder" && (

              <div className="fieldGroup">

                <label>

                  Select multiple files

                </label>


                <div
                  className={
                    files.length
                      ? "dropZone selected"
                      : "dropZone"
                  }
                >

                  <div className="dropIcon">

                    ▦

                  </div>


                  <h3>

                    {files.length
                      ? `${files.length} files selected`
                      : "Upload multiple files"
                    }

                  </h3>


                  <p>

                    Select photos, documents,
                    videos, audio and more.

                  </p>


                  <div className="browseButton">

                    {files.length
                      ? "Add more files"
                      : "Browse files"
                    }

                  </div>


                  <input
                    type="file"
                    multiple
                    accept="*/*"
                    onChange={(e) =>
                      setFiles(
                        Array.from(
                          e.target.files || []
                        )
                      )
                    }
                  />

                </div>


                {/* ============================================ */}
                {/* FILE LIST                                      */}
                {/* ============================================ */}

                {files.length > 0 && (

                  <div className="selectedFiles">

                    <div className="selectedHeader">

                      <span>

                        Selected files

                      </span>


                      <strong>

                        {files.length}

                      </strong>

                    </div>


                    <div className="fileList">

                      {files.map(
                        (
                          selectedFile,
                          index
                        ) => (

                          <div
                            className="fileItem"
                            key={`${selectedFile.name}-${index}`}
                          >

                            <div className="miniFileIcon">

                              {selectedFile.type.startsWith(
                                "image/"
                              )
                                ? "◈"
                                : selectedFile.type.startsWith(
                                    "video/"
                                  )
                                ? "▶"
                                : selectedFile.type.startsWith(
                                    "audio/"
                                  )
                                ? "♫"
                                : "▤"
                              }

                            </div>


                            <div className="fileItemInfo">

                              <span>

                                {selectedFile.name}

                              </span>


                              <small>

                                {(
                                  selectedFile.size /
                                  1024 /
                                  1024
                                ).toFixed(2)}{" "}
                                MB

                              </small>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  </div>

                )}

              </div>

            )}

          </div>


          {/* ================================================= */}
          {/* ERROR                                             */}
          {/* ================================================= */}

          {message && (

            <div className="message errorMessage">

              <span>
                !
              </span>

              {message}

            </div>

          )}


          {/* ================================================= */}
          {/* GENERATE BUTTON                                    */}
          {/* ================================================= */}

          <button
            type="button"
            className="primaryButton"
            onClick={generate}
            disabled={busy}
          >

            {busy ? (

              <>

                <span className="spinner"></span>

                Generating your QR...

              </>

            ) : (

              <>

                Generate QR Code

                <span className="buttonArrow">

                  →

                </span>

              </>

            )}

          </button>


          <div className="privacyNote">

            <span>
              ✦
            </span>

            Your files are shared through
            a unique QR link.

          </div>


        </section>


        {/* ================================================== */}
        {/* QR PREVIEW                                          */}
        {/* ================================================== */}

        <section className="glassPanel qrPanel">


          <div className="panelHeader">

            <div>

              <div className="sectionEyebrow">

                PREVIEW

              </div>


              <h2>

                Your QR code

              </h2>


              <p>

                Ready to scan and share.

              </p>

            </div>


            <div className="stepBadge">

              STEP 02

            </div>

          </div>


          {qr ? (

            <div className="qrResult">


              {/* ============================================= */}
              {/* QR                                             */}
              {/* ============================================= */}

              <div className="qrFrame">

                <div className="qrGlow"></div>


                <div className="qrInner">

                  <img
                    src={qr.qr_url}
                    alt="Generated PhotoShapeQR QR code"
                  />

                </div>

              </div>


              {/* ============================================= */}
              {/* SUCCESS                                        */}
              {/* ============================================= */}

              <div className="successMessage">

                <span className="successIcon">

                  ✓

                </span>


                <div>

                  <strong>

                    QR code ready

                  </strong>


                  <span>

                    Scan it with any phone camera.

                  </span>

                </div>

              </div>


              {/* ============================================= */}
              {/* LINK                                           */}
              {/* ============================================= */}

              <div className="encodedBox">

                <div className="encodedLabel">

                  SHARED LINK

                </div>


                <div className="encodedValue">

                  {qr.payload}

                </div>

              </div>


              {/* ============================================= */}
              {/* DOWNLOAD                                       */}
              {/* ============================================= */}

              <button
                type="button"
                className="secondaryButton"
                onClick={downloadQR}
              >

                <span>

                  ↓

                </span>

                Download QR image

              </button>


            </div>

          ) : (

            <div className="emptyQR">

              <div className="emptyQRVisual">

                <div className="fakeQR">

                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>

                </div>


                <div className="scanLine"></div>

              </div>


              <h3>

                Your QR appears here

              </h3>


              <p>

                Configure your content on the left
                and generate a QR code.

              </p>

            </div>

          )}

        </section>


        {/* ================================================== */}
        {/* SCANNER                                             */}
        {/* ================================================== */}

        <section className="glassPanel scannerPanel">


          <div className="scannerContent">


            <div className="scannerIcon">

              ⌁

            </div>


            <div className="scannerText">

              <div className="sectionEyebrow">

                SCANNER

              </div>


              <h2>

                Already have a QR?

              </h2>


              <p>

                Upload a QR image and we'll
                read its content for you.

              </p>

            </div>


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

              {busy
                ? "Reading..."
                : "Upload QR image"
              }

              <span>
                →
              </span>

            </button>


          </div>


          {scanResult && (

            <div className="scanResult">

              <div>

                <span className="resultBadge">

                  QR DETECTED

                </span>


                <div className="resultText">

                  {scanResult}

                </div>

              </div>


              <button
                type="button"
                className="resultOpen"
                onClick={openScanResult}
              >

                Open

                <span>
                  →
                </span>

              </button>

            </div>

          )}

        </section>


      </main>


      {/* ==================================================== */}
      {/* FOOTER                                               */}
      {/* ==================================================== */}

      <footer className="footer">

        <div className="footerLogo">

          PhotoShape<span>QR</span>

        </div>


        <p>

          Simple. Beautiful. Shareable.

        </p>


        <div className="footerLine"></div>


        <small>

          © {new Date().getFullYear()}
          PhotoShapeQR. Built for effortless sharing.

        </small>

      </footer>


    </div>

  );

}


export default App;