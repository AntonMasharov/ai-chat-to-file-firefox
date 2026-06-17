const SUPPORTED_SITES = {
  "claude.ai": "Claude",
  "chatgpt.com": "ChatGPT",
  "chat.openai.com": "ChatGPT",
  "gemini.google.com": "Gemini"
};

let currentTab = null;
let currentSite = null;

async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const badge     = document.getElementById("siteBadge");
  const exportPdf = document.getElementById("exportPdf");
  const exportTxt = document.getElementById("exportTxt");
  const exportMd  = document.getElementById("exportMd");

  try {
    const url  = new URL(tab.url);
    const host = url.hostname.replace(/^www\./, "");
    currentSite = SUPPORTED_SITES[host] || null;
  } catch (_) {}

  if (currentSite) {
    badge.textContent = currentSite;
    badge.classList.remove("unsupported");
    exportPdf.disabled = false;
    exportTxt.disabled = false;
    exportMd.disabled = false;
  } else {
    badge.textContent = "Not a supported chat site";
    badge.classList.add("unsupported");
    exportPdf.disabled = true;
    exportTxt.disabled = true;
    exportMd.disabled = true;
    setStatus("Open Claude, ChatGPT, or Gemini first.", "error");
  }
}

function setStatus(msg, type = "") {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = "status " + type;
}

function getOptions(format) {
  return {
    format,
    theme:            document.querySelector('input[name="theme"]:checked').value,
    includeTimestamp: document.getElementById("includeTimestamp").checked,
    includeUrl:       document.getElementById("includeUrl").checked,
    codeHighlight:    document.getElementById("codeHighlight").checked,
    site:             currentSite
  };
}

async function doExport(format) {
  if (!currentTab) return;

  setStatus(format === "pdf" ? "Extracting conversation…" : (format === "md" ? "Building markdown file…" : "Building text file…"));
  document.getElementById("exportPdf").disabled = true;
  document.getElementById("exportTxt").disabled = true;
  document.getElementById("exportMd").disabled = true;

  try {
    const response = await browser.tabs.sendMessage(currentTab.id, {
      action: "extractChat",
      options: getOptions(format)
    });

    if (!response || !response.success) {
      setStatus(response?.error || "Could not extract chat.", "error");
      return;
    }

    if (format === "pdf") {
      setStatus("Opening print dialog…", "success");
      const printTab = await browser.tabs.create({
        url: browser.runtime.getURL("print.html"),
        active: true
      });
      await browser.runtime.sendMessage({
        action: "storePrintJob",
        tabId:  printTab.id,
        html:   response.html,
        title:  response.title
      });

    } else {
      // TXT or MD: hand off to background script which has reliable downloads access
      setStatus("Downloading…", "success");
      const result = await browser.runtime.sendMessage({
        action: format === "txt" ? "downloadTxt" : "downloadMd",
        txt:    format === "txt" ? response.txt : response.md,
        title:  response.title
      });
      if (result?.ok) {
        setStatus("Saved!", "success");
      } else {
        setStatus("Download failed: " + (result?.error || "unknown error"), "error");
      }
    }

  } catch (err) {
    if (err.message && err.message.includes("Could not establish connection")) {
      setStatus("Reload the chat page and try again.", "error");
    } else {
      setStatus("Error: " + err.message, "error");
    }
  } finally {
    document.getElementById("exportPdf").disabled = false;
    document.getElementById("exportTxt").disabled = false;
    document.getElementById("exportMd").disabled = false;
  }
}

document.getElementById("exportPdf").addEventListener("click", () => doExport("pdf"));
document.getElementById("exportTxt").addEventListener("click", () => doExport("txt"));
document.getElementById("exportMd").addEventListener("click", () => doExport("md"));

init();
