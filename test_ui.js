const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

// We'll use the pre-installed playwright
const pwPath = path.join(process.env.HOME, '.npm', '_npx', 'e41f203b7505f1fb', 'node_modules', 'playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:8000/index.html');
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    window.activeSynth = {
      'test_pano_1': { mode: 'chord', scale: 'lydian', wave: 'sine' }
    };
    window.panoDataCache = {
      'test_pano_1': {
        id: 'test_pano_1',
        title: 'Test Panorama',
        arrayUrl: 'mock_url'
      }
    };
    window.currentLang = 'fr';
    window.text = {
      fr: {
        dauer: 'Durée', range: 'Range', attack: 'Attack',
        release: 'Release', echo: "L'écho", lautstaerke: 'Vol'
      }
    };
  });

  await page.evaluate(() => {
    window.openPanoModal(window.panoDataCache['test_pano_1']);
  });

  await page.waitForSelector('.synth-layout-container');
  await page.screenshot({ path: '/home/jules/verification/synth-fixed.png' });

  await browser.close();
})();
