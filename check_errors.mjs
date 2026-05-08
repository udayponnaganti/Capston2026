import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });

  await page.goto('http://localhost:5173/analytics', { waitUntil: 'networkidle0' }).catch(e => console.log('Goto error:', e));
  
  await browser.close();
})();
