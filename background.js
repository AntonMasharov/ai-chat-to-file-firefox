// background.js — relays print content and handles txt downloads

const pendingPrintJobs = new Map(); // tabId -> {html, title}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "storePrintJob") {
    pendingPrintJobs.set(msg.tabId, { html: msg.html, title: msg.title });
    return Promise.resolve({ ok: true });
  }

  if (msg.action === "printReady") {
    const tabId = sender.tab?.id;
    const job = pendingPrintJobs.get(tabId);
    if (job) {
      pendingPrintJobs.delete(tabId);
      return Promise.resolve({
        action: "printContent",
        html: job.html,
        title: job.title,
      });
    }
    return Promise.resolve({ action: "noJob" });
  }

  // background.js
  if (msg.action === "downloadTxt") {
    const { txt, title } = msg;
    const filename = (title || "chat").replace(/[\\/:*?"<>|]/g, "_") + ".txt";

    // 1. Создаем Blob из текста
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });

    // 2. Создаем временный Object URL (он выглядит как blob:null/...)
    const objectUrl = URL.createObjectURL(blob);

    return browser.downloads
      .download({ url: objectUrl, filename, saveAs: true })
      .then((downloadId) => {
        // 3. Освобождаем память ТОЛЬКО после завершения скачивания или ошибки/отмены
        const listener = (delta) => {
          if (delta.id === downloadId && delta.state) {
            if (delta.state.current === "complete" || delta.state.current === "interrupted") {
              URL.revokeObjectURL(objectUrl);
              browser.downloads.onChanged.removeListener(listener);
            }
          }
        };
        browser.downloads.onChanged.addListener(listener);
        return { ok: true };
      })
      .catch((err) => {
        // И в случае ошибки при старте загрузки освобождаем память
        URL.revokeObjectURL(objectUrl);
        return { ok: false, error: err.message };
      });
  }

  if (msg.action === "downloadMd") {
    const { txt, title } = msg;
    const filename = (title || "chat").replace(/[\\/:*?"<>|]/g, "_") + ".md";

    // 1. Создаем Blob из текста
    const blob = new Blob([txt], { type: "text/markdown;charset=utf-8" });

    // 2. Создаем временный Object URL (он выглядит как blob:null/...)
    const objectUrl = URL.createObjectURL(blob);

    return browser.downloads
      .download({ url: objectUrl, filename, saveAs: true })
      .then((downloadId) => {
        // 3. Освобождаем память ТОЛЬКО после завершения скачивания или ошибки/отмены
        const listener = (delta) => {
          if (delta.id === downloadId && delta.state) {
            if (delta.state.current === "complete" || delta.state.current === "interrupted") {
              URL.revokeObjectURL(objectUrl);
              browser.downloads.onChanged.removeListener(listener);
            }
          }
        };
        browser.downloads.onChanged.addListener(listener);
        return { ok: true };
      })
      .catch((err) => {
        // И в случае ошибки при старте загрузки освобождаем память
        URL.revokeObjectURL(objectUrl);
        return { ok: false, error: err.message };
      });
  }
});
