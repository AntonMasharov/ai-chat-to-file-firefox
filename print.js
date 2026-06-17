browser.runtime.sendMessage({ action: "printReady" }).then(response => {
  if (!response || response.action !== "printContent") {
    document.querySelector("p").textContent = "Error: no print job found.";
    return;
  }

  document.open();
  document.write(response.html);
  document.close();

  if (response.title) document.title = response.title;

  // Wait for fonts to load before printing so that math characters render correctly
  const triggerPrint = () => {
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 100);
    });
  };

  if (document.fonts && document.fonts.ready) {
    Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 2000)) // Fallback timeout of 2 seconds
    ]).then(triggerPrint).catch(triggerPrint);
  } else {
    triggerPrint();
  }
}).catch(err => {
  document.querySelector("p").textContent = "Error: " + err.message;
});
