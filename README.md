# Chat to PDF — Firefox Extension

Export your AI chat conversations to PDF, TXT, and Markdown (MD), entirely locally — no data leaves your browser.

**Supported sites:** Claude, ChatGPT, Gemini

---

## Installation (Temporary, for testing)

1. Open Firefox and go to `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on…**
4. Navigate to this folder and select `manifest.json`
5. The extension icon appears in your toolbar

> Note: Temporary add-ons are removed when Firefox restarts. See below for permanent install.

---

## Permanent Installation

To install permanently without signing (requires Firefox Developer Edition or Nightly):

1. Go to `about:config`
2. Set `xpinstall.signatures.required` → `false`
3. Go to `about:addons` → gear icon → **Install Add-on From File…**
4. Select the `.zip` file (rename to `.xpi` first)

Or use **Firefox Developer Edition** / **Firefox Nightly**, which allow unsigned extensions.

---

## How to Use

1. Navigate to a conversation on **Claude**, **ChatGPT**, or **Gemini**
2. Click the extension icon in the toolbar
3. Choose your preferred theme and options
4. Click **Export to PDF**
5. A new tab opens with the formatted conversation
6. Firefox's print dialog appears — choose **Save to PDF** as the destination

---

## Options

| Option | Description |
|--------|-------------|
| Light / Dark theme | Controls the PDF color scheme |
| Include timestamp | Adds export date/time to the header |
| Include URL | Adds the source page URL |
| Highlight code blocks | Syntax-highlights code using Prism.js (requires internet) |

---

## Privacy

- **No network requests** are made by the extension itself
- All chat extraction and HTML generation happens locally in your browser
- The only optional external resource is Prism.js CDN for syntax highlighting (disable in options to go fully offline)
- No analytics, no telemetry, no external servers

---

## Files

```
manifest.json   — Extension manifest
popup.html/js   — Toolbar button popup UI
content.js      — Injected into chat pages; extracts messages
print.html      — Intermediate page that triggers the print dialog
icons/          — Extension icons
```

---

## Troubleshooting

**"No chat messages found"** — Make sure you have a conversation open (not the home/new chat screen). Try scrolling through the conversation to make sure it's loaded.

**"Could not establish connection"** — Reload the chat page, then try again. The content script needs to be injected fresh.

**ChatGPT / Gemini not extracting correctly** — These sites update their DOM structure frequently. Open an issue with the page structure and it can be updated.
