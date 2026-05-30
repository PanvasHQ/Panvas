const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[Browser ${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`[Browser PageError] ${error.message}`);
  });

  await page.goto('http://localhost:3000');
  
  // Wait a bit
  await page.waitForTimeout(2000);
  
  // Click the "Canvas" button in sidebar to create a canvas
  try {
    await page.click('#sidebar-new-canvas-btn');
    await page.waitForTimeout(500);
    await page.fill('#create-dialog-input', 'My Canvas');
    await page.click('button[type="submit"]');
    
    // Wait for canvas to load
    await page.waitForTimeout(3000);
  } catch (err) {
    console.log('Error during interaction:', err.message);
  }

  await browser.close();
})();
