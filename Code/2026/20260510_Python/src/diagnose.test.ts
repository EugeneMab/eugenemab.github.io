import { test, expect } from '@playwright/test';

test('diagnose empty output issue', async ({ page }) => {
  // Capture all logs
  page.on('console', msg => console.log(`BROWSER LOG [${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER EXCEPTION: ${err.message}`));

  await page.goto('http://localhost:8080');
  
  // 1. Verify script loading
  const scriptLoaded = await page.evaluate(() => {
    return document.querySelector('script[src="js/main.js"]') !== null;
  });
  console.log(`Script tag exists: ${scriptLoaded}`);

  // 2. Load Sample
  console.log('Selecting Variables & Math...');
  await page.selectOption('#sample-select', 'sample/variables.py');
  
  // 3. Wait a bit for async fetch
  await page.waitForTimeout(1000);

  // 4. Check Editor
  const editorValue = await page.inputValue('#editor');
  console.log(`Editor Value Length: ${editorValue.length}`);

  // 5. Check Lexicon
  const lexContent = await page.innerText('#lex-output');
  console.log(`Lexicon Text Length: ${lexContent.length}`);
  if (lexContent.length > 0) {
    console.log('Lexicon First 50 chars:', lexContent.substring(0, 50));
  }

  // 6. Check Visibility
  const isLexVisible = await page.isVisible('#lex-content');
  const isLexHidden = await page.locator('#lex-content').evaluate(el => el.classList.contains('hidden'));
  console.log(`Lexicon Panel Visible: ${isLexVisible}, Has 'hidden' class: ${isLexHidden}`);

  // 7. Manual Click
  console.log('Manually clicking compile button...');
  await page.click('#compile-btn');
  await page.waitForTimeout(500);
  
  const lexContentAfterClick = await page.innerText('#lex-output');
  console.log(`Lexicon Text Length after manual click: ${lexContentAfterClick.length}`);
});
