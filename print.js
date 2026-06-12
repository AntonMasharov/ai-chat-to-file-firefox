browser.runtime.sendMessage({ action: "printReady" }).then(response => {
  if (!response || response.action !== "printContent") {
    document.querySelector("p").textContent = "Error: no print job found.";
    return;
  }

  document.open();
  document.write(response.html);
  document.close();

  if (response.title) document.title = response.title;

  requestAnimationFrame(() => {
    setTimeout(() => window.print(), 100);
  });
}).catch(err => {
  document.querySelector("p").textContent = "Error: " + err.message;
});
