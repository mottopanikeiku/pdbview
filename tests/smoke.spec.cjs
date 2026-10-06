const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { PNG } = require('pngjs');

test('bundled protein renders, controls work, and an empty filter clears rows', async ({ page }, testInfo) => {
  const errors = [];
  const failedRequests = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure().errorText}`));
  await page.goto('./');
  await expect(page.locator('#viewer-container canvas')).toBeVisible();
  await page.locator('#load-example').click();
  await expect(page.locator('#status-display')).toHaveText('1CRN (bundled) loaded successfully');
  await expect(page.locator('#molecular-stats')).toContainText('327');
  expect(await page.evaluate(() => currentModel.selectedAtoms({}).length)).toBe(327);

  // Sample the displayed canvas, including renderers using an OffscreenCanvas.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const rendered = PNG.sync.read(await page.locator('#viewer-container canvas').screenshot());
  let coloredPixels = 0;
  let spectrumPixels = 0;
  for (let i = 0; i < rendered.data.length; i += 4) {
    if (rendered.data[i] + rendered.data[i + 1] + rendered.data[i + 2] > 30) coloredPixels++;
    const red = rendered.data[i], green = rendered.data[i + 1], blue = rendered.data[i + 2];
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 30) spectrumPixels++;
  }
  expect(coloredPixels).toBeGreaterThan(100);
  expect(spectrumPixels).toBeGreaterThan(100);

  await page.selectOption('#style-select', 'stick');
  await page.selectOption('#color-select', 'element');
  await page.getByRole('button', { name: 'Center View', exact: true }).click();
  await page.getByRole('button', { name: 'Atoms', exact: true }).click();
  await expect(page.locator('.atom-table-row').first()).toBeVisible();
  await page.selectOption('#atom-type-filter', 'HETATM');
  await expect(page.locator('#atom-stats')).toContainText('0');
  await expect(page.locator('.atom-table-row')).toHaveCount(0);
  await page.selectOption('#atom-type-filter', 'all');
  await expect(page.locator('.atom-table-row').first()).toBeVisible();
  await page.getByRole('button', { name: 'Raw PDB', exact: true }).click();
  await expect(page.locator('.fast-grid-row').first()).toBeVisible();

  // Exercise the independent local-file loading path too.
  await page.setInputFiles('#pdb-file', path.join(__dirname, '../data/1CRN.pdb'));
  await expect(page.locator('#status-display')).toHaveText('1CRN.pdb loaded successfully');
  await page.getByRole('button', { name: '3D View', exact: true }).click();
  await page.selectOption('#style-select', 'cartoon');
  await page.selectOption('#color-select', 'spectrum');
  await page.mouse.move(300, 300);
  await page.mouse.down();
  await page.mouse.move(420, 340, { steps: 10 });
  await page.mouse.up();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const screenshot = process.env.PDBVIEW_SCREENSHOT || testInfo.outputPath('pdbview.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('Protein viewer', { path: screenshot, contentType: 'image/png' });
  expect(failedRequests).toEqual([]);
  expect(errors).toEqual([]);
});
