// content.js — injected into claude.ai, chatgpt.com, gemini.google.com

(function () {
  "use strict";

  // ─── Site Detector ─────────────────────────────────────────────────────────

  function detectSite() {
    const host = location.hostname;
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("chatgpt.com") || host.includes("openai.com")) return "chatgpt";
    if (host.includes("gemini.google.com")) return "gemini";
    return null;
  }

  // ─── Dedup helper ──────────────────────────────────────────────────────────
  // Returns only the elements from `selector` that are not a descendant of
  // (or identical to) any element already in `seen`, then adds them to `seen`.

  function uniqueElements(selector, seen) {
    const results = [];
    document.querySelectorAll(selector).forEach(el => {
      // Skip if we already have this element or one of its ancestors
      if (seen.has(el)) return;
      for (const s of seen) {
        if (s.contains(el) || el.contains(s)) return;
      }
      seen.add(el);
      results.push(el);
    });
    return results;
  }

  // ─── Extractors ────────────────────────────────────────────────────────────

  function extractClaude() {
    const seen = new Set();
    const messages = [];

    // Try the most specific selector first
    const turns = uniqueElements(
      '[data-testid^="human-turn"], [data-testid^="ai-turn"]',
      seen
    );

    if (turns.length > 0) {
      turns.forEach(el => {
        const testId = el.getAttribute("data-testid") || "";
        const role = testId.includes("human") ? "human" : "assistant";
        messages.push({ role, content: cleanNode(el) });
      });
    } else {
      // Fallback: class-based
      const fallback = uniqueElements(
        '[class*="human-turn"], [class*="assistant-turn"]',
        seen
      );
      fallback.forEach(el => {
        const role = el.className.includes("human") ? "human" : "assistant";
        messages.push({ role, content: cleanNode(el) });
      });
    }

    if (messages.length === 0) {
      // Last resort: direct children of the chat feed, alternating roles
      const feed = document.querySelector(
        'main [class*="flex-col"], [class*="chat-content"], [class*="conversation"]'
      );
      if (feed) {
        Array.from(feed.children).forEach((child, i) => {
          if (child.innerText.trim().length > 0) {
            messages.push({ role: i % 2 === 0 ? "human" : "assistant", content: cleanNode(child) });
          }
        });
      }
    }

    return {
      title: document.title.replace(" - Claude", "").trim() || "Claude Conversation",
      messages
    };
  }

  function extractChatGPT() {
    const seen = new Set();
    const messages = [];

    const turns = uniqueElements('[data-message-author-role]', seen);

    if (turns.length > 0) {
      turns.forEach(el => {
        const role = el.getAttribute("data-message-author-role") === "user" ? "human" : "assistant";
        messages.push({ role, content: cleanNode(el) });
      });
    } else {
      // Fallback for older ChatGPT layouts
      uniqueElements('[class*="group"][class*="w-full"]', seen).forEach(el => {
        const isUser = !!el.querySelector('[class*="user-message"]');
        messages.push({ role: isUser ? "human" : "assistant", content: cleanNode(el) });
      });
    }

    const titleEl = document.querySelector('nav [class*="active"] span, h1');
    return {
      title: titleEl?.textContent.trim() || document.title.replace(" - ChatGPT", "").trim() || "ChatGPT Conversation",
      messages
    };
  }

  function extractGemini() {
    const seen = new Set();
    const messages = [];

    // Use the most specific selector only — the custom element tag name.
    // Avoid combining tag + class + attribute for the same element type,
    // which was causing 3–6× duplicates before.
    const queryEls    = uniqueElements('user-query',    seen);
    const responseEls = uniqueElements('model-response', seen);

    // Merge and sort by document order
    const allBubbles = [
      ...queryEls.map(el    => ({ role: "human",     el })),
      ...responseEls.map(el => ({ role: "assistant",  el }))
    ].sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    allBubbles.forEach(({ role, el }) => {
      messages.push({ role, content: cleanNode(el) });
    });

    if (messages.length === 0) {
      // Fallback: class-based, still deduped
      const qFallback = uniqueElements('.user-query',    seen);
      const rFallback = uniqueElements('.model-response', seen);
      [...qFallback.map(el => ({ role: "human", el })),
       ...rFallback.map(el => ({ role: "assistant", el }))]
        .sort((a, b) =>
          a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        )
        .forEach(({ role, el }) => messages.push({ role, content: cleanNode(el) }));
    }

    return {
      title: document.title.replace(" - Gemini", "").trim() || "Gemini Conversation",
      messages
    };
  }

  // ─── DOM Cleaner ───────────────────────────────────────────────────────────

  function cleanNode(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(
      'button, [role="button"], [class*="action"], [class*="tooltip"], ' +
      '[class*="feedback"], [class*="copy-btn"], [class*="regenerate"], ' +
      'svg, [class*="icon"], [aria-hidden="true"], [class*="actions-bar"],' +
      '[data-testid*="action"], [data-testid*="button"], [class*="thumb"]'
    ).forEach(n => {
      // Do not remove elements that are part of KaTeX or MathJax formulas
      if (n.closest('.katex, .MathJax, mjx-container')) return;
      n.remove();
    });
    return clone.innerHTML;
  }

  // ─── HTML Builder ──────────────────────────────────────────────────────────

  function buildPrintHTML(data, options) {
    const { title, messages } = data;
    const { theme, includeTimestamp, includeUrl, codeHighlight, site } = options;
    const isDark = theme === "dark";

    const siteColors = {
      claude:  { accent: "#c96442", label: "Claude" },
      chatgpt: { accent: "#10a37f", label: "ChatGPT" },
      gemini:  { accent: "#1a73e8", label: "Gemini" },
      unknown: { accent: "#666",    label: "AI Chat" }
    };
    const brand = siteColors[site?.toLowerCase()] || siteColors.unknown;

    const bg      = isDark ? "#1a1a2e" : "#f5f5f5";
    const paper   = isDark ? "#16213e" : "#ffffff";
    const text    = isDark ? "#e0e0f0" : "#1a1a2a";
    const subtext = isDark ? "#8888aa" : "#666677";
    const userBg  = isDark ? "#0f3460" : "#eff6ff";
    const aiBg    = isDark ? "#1a2a40" : "#f9f9fb";
    const codeBg  = isDark ? "#0d1117" : "#f4f4f6";
    const border  = isDark ? "#2a2a4a" : "#e0e0ec";

    const messageRows = messages.map(msg => {
      const isHuman   = msg.role === "human";
      const roleName  = isHuman ? "You" : brand.label;
      const roleColor = isHuman ? brand.accent : (isDark ? "#7eb8ff" : "#2255cc");
      const msgBg     = isHuman ? userBg : aiBg;
      return `
        <div class="message ${isHuman ? "message-human" : "message-ai"}" style="background:${msgBg}">
          <div class="role-label" style="color:${roleColor}">${roleName}</div>
          <div class="message-content">${msg.content}</div>
        </div>`;
    }).join("\n");

    const metaLines = [];
    if (includeTimestamp) metaLines.push(`Exported: ${new Date().toLocaleString()}`);
    if (includeUrl)       metaLines.push(`Source: ${location.href}`);

    const prismCSS = codeHighlight
      ? `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/${isDark ? "prism-tomorrow" : "prism"}.min.css">`
      : "";
    const prismJS = codeHighlight
      ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"><\/script>
         <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"><\/script>`
      : "";

    const katexCSS = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  ${prismCSS}
  ${katexCSS}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      background: ${bg};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 14px; color: ${text}; line-height: 1.65;
    }
    .page-wrap { max-width: 800px; margin: 0 auto; padding: 32px 24px 48px; }
    .chat-header {
      background: ${paper}; border: 1px solid ${border};
      border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;
    }
    .chat-header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .brand-dot { width: 12px; height: 12px; border-radius: 50%; background: ${brand.accent}; flex-shrink: 0; }
    .chat-title { font-size: 18px; font-weight: 700; color: ${text}; flex: 1; }
    .meta-info { font-size: 11px; color: ${subtext}; line-height: 1.8; }
    .messages { display: flex; flex-direction: column; gap: 12px; }
    .message { border: 1px solid ${border}; border-radius: 10px; padding: 14px 18px; page-break-inside: avoid; }
    .role-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
    .message-content { color: ${text}; }
    .message-content p { margin: 0 0 10px; }
    .message-content p:last-child { margin-bottom: 0; }
    .message-content h1, .message-content h2, .message-content h3 { color: ${text}; margin: 14px 0 6px; line-height: 1.3; }
    .message-content h1 { font-size: 1.3em; } .message-content h2 { font-size: 1.15em; } .message-content h3 { font-size: 1.05em; }
    .message-content ul, .message-content ol { margin: 6px 0 10px 20px; padding: 0; }
    .message-content li { margin: 3px 0; }
    .message-content pre { background: ${codeBg}; border: 1px solid ${border}; border-radius: 6px; padding: 12px 14px; overflow-x: auto; margin: 10px 0; font-size: 12.5px; }
    .message-content code { font-family: "JetBrains Mono","Fira Code",Consolas,monospace; font-size: 12.5px; background: ${codeBg}; padding: 1px 4px; border-radius: 3px; }
    .message-content pre code { background: none; padding: 0; }
    .message-content blockquote { border-left: 3px solid ${brand.accent}; margin: 10px 0; padding: 4px 14px; color: ${subtext}; }
    .message-content table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
    .message-content th, .message-content td { border: 1px solid ${border}; padding: 6px 10px; text-align: left; }
    .message-content th { background: ${codeBg}; font-weight: 600; }
    .message-content a { color: ${brand.accent}; word-break: break-word; }
    .message-content img { max-width: 100%; height: auto; border-radius: 4px; }
    .message-content button, .message-content [role="button"], .message-content svg:not(.katex *):not(mjx-container *), .message-content [aria-hidden="true"]:not(.katex *):not(mjx-container *) { display: none !important; }
    @media print {
      body { background: white !important; color: #111 !important; }
      .page-wrap { padding: 0; }
      .chat-header, .message { border-color: #ddd !important; background: white !important; }
      .message-content pre { background: #f4f4f6 !important; }
      @page { margin: 1.5cm 1.5cm 2cm; }
    }
  </style>
</head>
<body>
<div class="page-wrap">
  <div class="chat-header">
    <div class="chat-header-top">
      <div class="brand-dot"></div>
      <div class="chat-title">${escapeHtml(title)}</div>
    </div>
    ${metaLines.length ? `<div class="meta-info">${metaLines.map(escapeHtml).join("<br>")}</div>` : ""}
  </div>
  <div class="messages">${messageRows}</div>
</div>
${prismJS}
</body>
</html>`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }


  // ─── TXT Builder ───────────────────────────────────────────────────────────

  function buildTxt(data, options) {
    const { title, messages } = data;
    const { includeTimestamp, includeUrl, site } = options;

    const siteLabels = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini" };
    const aiLabel = siteLabels[site?.toLowerCase()] || "Assistant";

    const lines = [];

    lines.push("=".repeat(60));
    lines.push(title);
    lines.push("=".repeat(60));
    if (includeTimestamp) lines.push("Exported: " + new Date().toLocaleString());
    if (includeUrl)       lines.push("Source:   " + location.href);
    lines.push("");

    messages.forEach((msg, i) => {
      const label = msg.role === "human" ? "You" : aiLabel;
      lines.push("-".repeat(40));
      lines.push(label + ":");
      lines.push("-".repeat(40));
      // Strip HTML tags to get plain text
      const tmp = document.createElement("div");
      tmp.innerHTML = msg.content;
      // Preserve code blocks with a simple marker
      tmp.querySelectorAll("pre").forEach(pre => {
        pre.textContent = "\n```\n" + pre.textContent.trim() + "\n```\n";
      });
      // Replace KaTeX math with raw LaTeX source for cleaner text output
      tmp.querySelectorAll(".katex").forEach(katexEl => {
        if (!katexEl.parentNode) return;
        const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation) {
          const isDisplay = katexEl.querySelector(".katex-display") || katexEl.classList.contains("katex-display");
          const delimiter = isDisplay ? "$$" : "$";
          const tex = annotation.textContent.trim();
          katexEl.replaceWith(document.createTextNode(` ${delimiter}${tex}${delimiter} `));
        }
      });
      const text = (tmp.innerText || tmp.textContent || "").trim();
      lines.push(text);
      lines.push("");
    });

    lines.push("=".repeat(60));
    return lines.join("\n");
  }

  // ─── Message Listener ──────────────────────────────────────────────────────

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== "extractChat") return;

    try {
      const site = detectSite();
      let data;
      if (site === "claude")       data = extractClaude();
      else if (site === "chatgpt") data = extractChatGPT();
      else if (site === "gemini")  data = extractGemini();
      else throw new Error("Unsupported site");

      if (!data.messages || data.messages.length === 0)
        throw new Error("No chat messages found. Make sure a conversation is open.");

      const opts = msg.options;
      sendResponse({ success: true, html: buildPrintHTML(data, opts), txt: buildTxt(data, opts), title: data.title });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }

    return true;
  });

})();
