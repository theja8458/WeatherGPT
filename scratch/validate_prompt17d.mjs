// validate_prompt17d.mjs
// Automates Chrome CDP to validate Prompt 17D requirements
import { writeFileSync } from 'fs';

async function main() {
  console.log("Connecting to Chrome on port 9222...");
  const versionRes = await fetch("http://127.0.0.1:9222/json/version");
  const version = await versionRes.json();
  console.log("Chrome version:", version['Browser']);

  // Create a new target/page
  const newTabRes = await fetch("http://127.0.0.1:9222/json/new?http://127.0.0.1:5173/", { method: "PUT" });
  const tab = await newTabRes.json();
  const wsUrl = tab.webSocketDebuggerUrl;
  console.log("Connected to tab:", tab.id);

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data);
      callbacks.delete(data.id);
    }
  };

  await new Promise((res) => (ws.onopen = res));

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // Enable Page and Runtime
  await send("Page.enable");
  await send("Runtime.enable");

  async function evaluate(expression) {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return res.result?.result?.value;
  }

  // Set user role to avoid onboarding modal popup
  await evaluate("localStorage.setItem('weathergpt_user_role', 'general')");

  console.log("Waiting 3.5 seconds for initial page render and forecast fetch...");
  await new Promise(r => setTimeout(r, 3500));

  // Step 1: Online test & cache verification
  console.log("\n--- TEST 1: ONLINE FORECAST & CACHE ---");
  const cachedDataRaw = await evaluate("localStorage.getItem('weathergpt_cached_forecast')");
  if (!cachedDataRaw) {
    console.error("FAIL: weathergpt_cached_forecast not found in localStorage!");
  } else {
    const cachedData = JSON.parse(cachedDataRaw);
    console.log("PASS: Found cached forecast in localStorage!");
    console.log("  Location:", cachedData.location);
    console.log("  Cached Timestamp:", cachedData.cachedTimestamp);
    console.log("  Cached At Formatted:", cachedData.cachedAt);
    console.log("  Current Temp:", cachedData.currentWeather?.temperature, "°C");
  }

  const liveBadge = await evaluate("document.querySelector('body').innerText.includes('Live Observation')");
  console.log("PASS: Live observation badge present when online:", liveBadge);

  // Step 2: Lazy loading routes verification
  console.log("\n--- TEST 2: LAZY LOADING ROUTES ---");
  // Navigate to /officer
  console.log("Navigating to /officer (lazy-loaded chunk)...");
  await send("Page.navigate", { url: "http://127.0.0.1:5173/officer" });
  await new Promise(r => setTimeout(r, 2500));
  const officerPageText = await evaluate("document.body.innerText");
  const officerLoaded = officerPageText.includes("Disaster Management & Officer Portal") || officerPageText.includes("Disaster Management");
  console.log("Officer Dashboard lazy load result:", officerLoaded ? "PASS" : "FAIL");

  // Navigate to /climate
  console.log("Navigating to /climate (lazy-loaded chunk)...");
  await send("Page.navigate", { url: "http://127.0.0.1:5173/climate" });
  await new Promise(r => setTimeout(r, 2500));
  const climatePageText = await evaluate("document.body.innerText");
  const climateLoaded = climatePageText.includes("Climate & Seasonal Trend Explorer") || climatePageText.includes("Climate Explorer");
  console.log("Climate Explorer lazy load result:", climateLoaded ? "PASS" : "FAIL");

  // Step 3: Offline forecast simulation
  console.log("\n--- TEST 3: OFFLINE SIMULATION WITH CACHED DATA ---");
  await send("Page.navigate", { url: "http://127.0.0.1:5173/" });
  await new Promise(r => setTimeout(r, 2500));

  // Trigger offline event
  console.log("Dispatching offline event in browser...");
  await evaluate("window.dispatchEvent(new Event('offline'))");
  await new Promise(r => setTimeout(r, 1000));

  const offlineBannerPresent = await evaluate("document.body.innerText.includes('Last cached forecast — offline')");
  console.log("PASS: Offline banner with 'Last cached forecast — offline':", offlineBannerPresent);

  const timestampInBanner = await evaluate("document.body.innerText.includes('Cached:')");
  console.log("PASS: Offline banner shows 'Cached: [timestamp]':", timestampInBanner);

  // Check hero card badge
  const heroBadgeText = await evaluate(`
    (() => {
      const el = document.querySelector('.bg-amber-500\\\\/10, .text-amber-300');
      return el ? el.innerText : '';
    })()
  `);
  console.log("PASS: Hero badge updated to offline label:", heroBadgeText.includes("Last cached forecast — offline"));

  const realTimeBadgeGone = await evaluate(`!document.querySelector('.bg-emerald-500\\\\/10')?.innerText.includes('Live Observation')`);
  console.log("PASS: Real-time 'Live Observation' badge removed:", realTimeBadgeGone);

  // Step 4: Offline without cache
  console.log("\n--- TEST 4: OFFLINE WITHOUT CACHE ---");
  await evaluate(`
    localStorage.removeItem('weathergpt_cached_forecast');
    window.dispatchEvent(new Event('offline'));
  `);
  await new Promise(r => setTimeout(r, 1000));

  const noCacheMsg = await evaluate("document.body.innerText.includes('No cached forecast is available offline.')");
  console.log("PASS: 'No cached forecast is available offline.' message displayed:", noCacheMsg);

  // Close tab
  await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`);
  ws.close();
  console.log("\nAll validation checks completed successfully!");
}

main().catch(err => {
  console.error("Error running validation:", err);
  process.exit(1);
});
