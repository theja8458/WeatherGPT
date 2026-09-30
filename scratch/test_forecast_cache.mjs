// test_forecast_cache.mjs
async function main() {
  const newTabRes = await fetch("http://127.0.0.1:9222/json/new?http://127.0.0.1:5173/", { method: "PUT" });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  function send(id, method, params = {}) {
    return new Promise(res => {
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          res(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Wait for React to render and API to complete
  await new Promise(r => setTimeout(r, 3000));

  const cacheRes = await send(1, 'Runtime.evaluate', {
    expression: "localStorage.getItem('weathergpt_cached_forecast')",
    returnByValue: true
  });

  console.log("Cached Forecast Value:", cacheRes.result?.value);

  // Check lazy-loading route /officer
  await send(2, 'Page.navigate', { url: 'http://127.0.0.1:5173/officer' });
  await new Promise(r => setTimeout(r, 2000));
  const officerTextRes = await send(3, 'Runtime.evaluate', {
    expression: "document.body.innerText",
    returnByValue: true
  });
  console.log("Officer Page Text excerpt:\n", officerTextRes.result?.value.slice(0, 300));

  // Check lazy-loading route /climate
  await send(4, 'Page.navigate', { url: 'http://127.0.0.1:5173/climate' });
  await new Promise(r => setTimeout(r, 2000));
  const climateTextRes = await send(5, 'Runtime.evaluate', {
    expression: "document.body.innerText",
    returnByValue: true
  });
  console.log("Climate Page Text excerpt:\n", climateTextRes.result?.value.slice(0, 300));

  // Navigate back to Home
  await send(6, 'Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await new Promise(r => setTimeout(r, 2000));

  // Test offline trigger
  console.log("Triggering offline event...");
  await send(7, 'Runtime.evaluate', {
    expression: "window.dispatchEvent(new Event('offline'))"
  });
  await new Promise(r => setTimeout(r, 1000));

  const homeOfflineTextRes = await send(8, 'Runtime.evaluate', {
    expression: "document.body.innerText",
    returnByValue: true
  });
  const text = homeOfflineTextRes.result?.value;
  console.log("Offline banner displayed?", text.includes("Last cached forecast — offline"));
  console.log("Offline timestamp displayed?", text.includes("Cached:"));

  // Test offline without cache
  console.log("Testing offline with no cache...");
  await send(9, 'Runtime.evaluate', {
    expression: `
      localStorage.removeItem('weathergpt_cached_forecast');
      window.dispatchEvent(new Event('offline'));
    `
  });
  await new Promise(r => setTimeout(r, 1000));
  const emptyCacheTextRes = await send(10, 'Runtime.evaluate', {
    expression: "document.body.innerText",
    returnByValue: true
  });
  console.log("No cache message displayed?", emptyCacheTextRes.result?.value.includes("No cached forecast is available offline."));

  await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`);
  ws.close();
  console.log("\nTEST COMPLETE!");
}

main().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
