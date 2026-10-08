const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const path = require('node:path');
const pdb = fs.readFileSync(path.join(__dirname, '../data/1CRN.pdb'), 'utf8');

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function loaded(page) {
  await page.goto('./');
  await expect(page.locator('#status-display')).toHaveText('1CRN (bundled) loaded successfully');
}

async function dropPdb(page, contents, name = 'dropped.pdb') {
  const transfer = await page.evaluateHandle(({ contents, name }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([contents], name, { type: 'text/plain' }));
    return transfer;
  }, { contents, name });
  await page.dispatchEvent('#viewer-container', 'drop', { dataTransfer: transfer });
  await transfer.dispose();
}

async function axeClean(page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
}

test('sequence, keyboard atom measurement and share links restore real model state', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await loaded(page);
  await expect(page.locator('.sequence-residue')).toHaveCount(46);
  const residue = page.locator('.sequence-residue').nth(3);
  await residue.focus();
  await page.keyboard.press('Space');
  await expect(residue).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => selectedResidue.resi)).toBe(4);
  await page.selectOption('#style-select', 'stick');
  await page.selectOption('#color-select', 'element');
  await expect(residue).toHaveAttribute('aria-pressed', 'true');
  await page.selectOption('#measure-first', '0');
  await page.selectOption('#measure-second', '1');
  await page.locator('#measure-selected').focus();
  await page.keyboard.press('Enter');
  const expected = Math.hypot(17.047 - 16.967, 14.099 - 12.784, 3.625 - 4.338).toFixed(3);
  await expect(page.locator('#distance-result')).toContainText(`${expected} Å`);
  await page.selectOption('#color-select', 'chain');
  expect(await page.evaluate(() => Boolean(measurementShape && measurementLabel))).toBe(true);
  const canvas = page.locator('#viewer-container');
  await canvas.focus();
  const before = await page.evaluate(() => viewer.getView());
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('+');
  expect(await page.evaluate(() => viewer.getView())).not.toEqual(before);
  const sharedView = await page.evaluate(() => viewer.getView());
  await page.locator('#share-view').click();
  const url = await page.locator('#share-url').inputValue();
  expect(url).toContain('example=1CRN');
  await page.goto(url);
  await expect(page.locator('#status-display')).toHaveText('1CRN (bundled) loaded successfully');
  await expect(page.locator('#style-select')).toHaveValue('stick');
  await expect(page.locator('#color-select')).toHaveValue('chain');
  await expect(page.locator('.sequence-residue').nth(3)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#distance-result')).toContainText(`${expected} Å`);
  const restored = await page.evaluate(() => viewer.getView());
  restored.forEach((value, index) => expect(value).toBeCloseTo(sharedView[index], 5));
  await axeClean(page);
  const screenshot = process.env.PDBVIEW_FEATURE_SCREENSHOT || testInfo.outputPath('pdbview-features.png');
  await page.locator('#distance-result').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('Sequence and measured crambin', { path: screenshot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('canvas shortcuts center the view and leave modified browser shortcuts alone', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  await page.locator('#viewer-container').focus();
  const before = await page.evaluate(() => viewer.getView());
  await page.keyboard.press('Control+Minus');
  expect(await page.evaluate(() => viewer.getView())).toEqual(before);
  await page.keyboard.press('Control+Equal');
  expect(await page.evaluate(() => viewer.getView())).toEqual(before);
  await page.keyboard.press('Control+c');
  await expect(page.locator('#status-display')).toHaveText('1CRN (bundled) loaded successfully');
  await page.keyboard.press('c');
  await expect(page.locator('#status-display')).toHaveText('View centered');
  expect(errors).toEqual([]);
});

test('the hidden atom table does not poll for layout', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  const calls = await page.evaluate(async () => {
    let count = 0;
    const original = updateAtomTableView;
    window.updateAtomTableView = () => { count++; original(); };
    await new Promise(resolve => setTimeout(resolve, 1000));
    return count;
  });
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Atoms', exact: true }).click();
  await expect(page.locator('.atom-table-row').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('drag and drop stays local, invalid input preserves the model, and Clear empties it', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  // Tab reaches the native chooser; its visible label shows the keyboard focus.
  await page.locator('#load-example').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#pdb-file')).toBeFocused();
  await expect(page.locator('.file-label')).toHaveCSS('outline-color', 'rgb(255, 220, 85)');
  const fileChooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await fileChooser).setFiles(path.join(__dirname, '../data/1CRN.pdb'));
  await expect(page.locator('#status-display')).toHaveText('1CRN.pdb loaded successfully');
  await dropPdb(page, pdb);
  await expect(page.locator('#status-display')).toHaveText('dropped.pdb loaded successfully');
  expect(await page.evaluate(() => currentModel.selectedAtoms({}).length)).toBe(327);
  await page.locator('#share-view').click();
  await expect(page.locator('#share-url')).toHaveValue('');
  await expect(page.locator('#share-note')).toContainText('stay on your device');
  await dropPdb(page, 'not a structure');
  await expect(page.locator('#pdb-error-display')).toContainText('No atoms found');
  expect(await page.evaluate(() => currentModel.selectedAtoms({}).length)).toBe(327);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('.sequence-residue')).toHaveCount(0);
  await expect(page.locator('#distance-result')).toHaveText('No atoms selected');
  expect(await page.evaluate(() => currentModel)).toBeNull();
  await axeClean(page);
  expect(errors).toEqual([]);
});

test('a new load error stays visible for its full eight seconds', async ({ page }) => {
  const errors = collectErrors(page);
  await page.clock.install();
  await loaded(page);
  await page.clock.pauseAt(Date.now() + 1000);
  const display = page.locator('#pdb-error-display');
  await page.locator('#pdb-id').fill('AB');
  await page.getByRole('button', { name: 'Load from Database' }).click();
  await expect(display).toHaveText('PDB ID must be exactly 4 characters (letters and numbers only)');
  await page.clock.fastForward(7000);
  await dropPdb(page, 'not a structure');
  await expect(display).toContainText('No atoms found');
  await page.clock.fastForward(2000);
  await expect(display).toHaveClass(/show/);
  await page.clock.fastForward(7000);
  await expect(display).not.toHaveClass(/show/);
  expect(errors).toEqual([]);
});

// A small PDB-format fixture makes projected atom picking unambiguous and exercises
// a blank chain, residue zero, and distinct insertion codes rather than protein biology.
const synthetic = [
  'ATOM      1  CA  ALA     0       0.000   0.000   0.000  1.00 10.00           C',
  'ATOM      2  CA  GLY     1A      6.000   0.000   0.000  1.00 10.00           C',
  'ATOM      3  CA  SER     1B     12.000   0.000   0.000  1.00 10.00           C',
  'ATOM      4  CA  VAL A   1      18.000   0.000   0.000  1.00 10.00           C',
  'END'
].join('\n');

test('canvas picking measures atoms and sequence identity includes blank chains and insertion codes', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  await dropPdb(page, synthetic, 'identities.pdb');
  await expect(page.locator('#status-display')).toHaveText('identities.pdb loaded successfully');
  await expect(page.locator('.sequence-residue')).toHaveCount(4);
  await expect(page.locator('#molecular-stats')).toContainText('4');
  await page.locator('.sequence-residue').nth(1).click();
  expect(await page.evaluate(() => currentModel.selectedAtoms(residueSelection(selectedResidue)).length)).toBe(1);
  expect(await page.evaluate(() => selectedResidue.icode)).toBe('A');
  await page.selectOption('#style-select', 'sphere');
  await page.locator('#measure-toggle').click();
  const positions = await page.evaluate(() => viewer.modelToScreen(currentModel.selectedAtoms({})));
  for (const position of positions.slice(0, 2)) await page.mouse.click(position.x, position.y);
  await expect(page.locator('#distance-result')).toContainText('6.000 Å');
  await page.keyboard.press('Escape');
  await expect(page.locator('#distance-result')).toHaveText('No atoms selected');
  expect(await page.evaluate(() => currentModel.selectedAtoms({}).length)).toBe(4);
  expect(errors).toEqual([]);
});

test('atom table residue numbers include insertion codes', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  await dropPdb(page, synthetic, 'identities.pdb');
  await expect(page.locator('#status-display')).toHaveText('identities.pdb loaded successfully');
  await page.getByRole('button', { name: 'Atoms', exact: true }).click();
  await expect(page.locator('.atom-table-row')).toHaveCount(4);
  await expect(page.locator('.atom-table-row .atom-table-cell:nth-child(6)')).toHaveText(['0', '1A', '1B', '1']);
  expect(errors).toEqual([]);
});

test('markup characters in PDB fields are shown as text', async ({ page }) => {
  const errors = collectErrors(page);
  const atom = synthetic.split('\n')[0];
  await loaded(page);
  await dropPdb(page, ['REMARK   1 a &lt;b&gt; <i>c</i>', `${atom.slice(0, 12)}<i>  <b>${atom.slice(20)}`, 'END'].join('\n'), 'markup.pdb');
  await expect(page.locator('#status-display')).toHaveText('markup.pdb loaded successfully');
  await page.getByRole('button', { name: 'Atoms', exact: true }).click();
  await expect(page.locator('.atom-table-row .atom-name')).toHaveText('<i>');
  await expect(page.locator('.atom-table-row .residue-name')).toHaveText('<b>');
  await page.getByRole('button', { name: 'Raw PDB', exact: true }).click();
  await expect(page.locator('.fast-grid-row').first().locator('.fast-grid-cell').nth(2)).toContainText('a &lt;b&gt; <i>c</i>');
  expect(await page.locator('#atom-table-content i, #atom-table-content b, #rawpdb-content i').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('residue details report residue zero and insertion codes', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  await dropPdb(page, synthetic, 'identities.pdb');
  await expect(page.locator('#status-display')).toHaveText('identities.pdb loaded successfully');
  await page.selectOption('#style-select', 'sphere');
  await page.locator('#interactive-btn').click();
  await expect(page.locator('#interactive-btn')).toHaveAttribute('aria-pressed', 'true');
  // Interactive mode schedules its render on the next animation frame; pick after it.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const positions = await page.evaluate(() => viewer.modelToScreen(currentModel.selectedAtoms({})));
  await page.mouse.click(positions[0].x, positions[0].y);
  await expect(page.locator('#amino-acid-modal')).toBeVisible();
  await expect(page.locator('#amino-acid-info')).toContainText('Position: 0');
  await page.keyboard.press('Escape');
  await page.mouse.click(positions[1].x, positions[1].y);
  await expect(page.locator('#amino-acid-info')).toContainText('Position: 1A');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('#interactive-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#interactive-btn')).toHaveText('Interactive Mode: OFF');
  expect(errors).toEqual([]);
});

test('the viewer uses the first model and alternate location while the Atoms tab lists every record', async ({ page }) => {
  const errors = collectErrors(page);
  const first = 'ATOM      1  CA  ALA A   1       0.000   0.000   0.000  1.00 10.00           C';
  const altA = 'ATOM      2  CA AGLY A   2       3.800   0.000   0.000  0.50 10.00           C';
  const altB = 'ATOM      3  CA BGLY A   2       3.900   0.100   0.000  0.50 10.00           C';
  await loaded(page);
  await dropPdb(page, ['MODEL        1', first, altA, altB, 'ENDMDL', 'MODEL        2', first, altA, altB, 'ENDMDL', 'END'].join('\n'), 'models.pdb');
  await expect(page.locator('#status-display')).toHaveText('models.pdb loaded successfully');
  expect(await page.evaluate(() => currentModel.selectedAtoms({}).map(atom => atom.serial))).toEqual([1, 2]);
  await expect(page.locator('#atoms-info')).toHaveText('6 ATOM records, 0 HETATM records');
  expect(errors).toEqual([]);
});

test('atom table keeps zero occupancy and infers a blank element column from the atom name', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  await dropPdb(page, [
    'ATOM      1  N   ALA A   1       1.000   2.000   3.000  0.00 15.00           N',
    'HETATM    2 FE   HEM A 101       0.000   0.000   0.000  1.00 20.00            ',
    'END'
  ].join('\n'), 'columns.pdb');
  await expect(page.locator('#status-display')).toHaveText('columns.pdb loaded successfully');
  await page.getByRole('button', { name: 'Atoms', exact: true }).click();
  const rows = page.locator('.atom-table-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.factor').first()).toHaveText('0.00');
  await expect(rows.nth(0).locator('.element')).toHaveText('N');
  await expect(rows.nth(1).locator('.element')).toHaveText('FE');
  await expect(page.locator('#atom-element-filter option')).toHaveText(['All Elements', 'FE', 'N']);
  expect(errors).toEqual([]);
});

test('atom filters survive tab switches and reset for a new structure', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  await page.getByRole('button', { name: 'Atoms', exact: true }).click();
  await page.selectOption('#atom-element-filter', 'S');
  await expect(page.locator('#atom-stats')).toContainText('Showing 6 of 327 atoms');
  await page.getByRole('button', { name: '3D View', exact: true }).click();
  await page.getByRole('button', { name: 'Atoms', exact: true }).click();
  await expect(page.locator('#atom-element-filter')).toHaveValue('S');
  await expect(page.locator('#atom-stats')).toContainText('Showing 6 of 327 atoms');
  await expect(page.locator('.atom-table-row')).toHaveCount(6);
  await page.selectOption('#atom-type-filter', 'HETATM');
  await dropPdb(page, pdb, 'replacement.pdb');
  await expect(page.locator('#status-display')).toHaveText('replacement.pdb loaded successfully');
  await expect(page.locator('#atom-type-filter')).toHaveValue('all');
  await expect(page.locator('#atom-element-filter')).toHaveValue('all');
  await expect(page.locator('#atom-stats')).toHaveText('327 atoms (327 ATOM, 0 HETATM)');
  expect(errors).toEqual([]);
});

test('latest load wins and Clear empties the displayed structure', async ({ page }) => {
  const errors = collectErrors(page);
  await loaded(page);
  let complete;
  const waiting = new Promise(resolve => { complete = resolve; });
  await page.route('https://files.rcsb.org/download/1ABC.pdb', async route => {
    await waiting;
    await route.fulfill({ contentType: 'text/plain', body: pdb });
  });
  await page.locator('#pdb-id').fill('1ABC');
  await page.getByRole('button', { name: 'Load from Database' }).click();
  await expect(page.locator('#status-display')).toContainText('Loading 1ABC');
  await dropPdb(page, pdb, 'newer.pdb');
  await expect(page.locator('#status-display')).toHaveText('newer.pdb loaded successfully');
  complete();
  await page.waitForResponse('https://files.rcsb.org/download/1ABC.pdb');
  expect(await page.evaluate(() => currentPdbId)).toBeNull();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  expect(await page.evaluate(() => currentModel)).toBeNull();
  expect(errors).toEqual([]);
});

test('all data tabs and mobile controls have no axe violations', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await loaded(page);
  for (const tab of ['Atoms', 'Raw PDB', 'Literature', '3D View']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await axeClean(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await axeClean(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const screenshot = process.env.PDBVIEW_MOBILE_SCREENSHOT || testInfo.outputPath('pdbview-mobile.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('Mobile viewer', { path: screenshot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('live RCSB entry loads through the database controls', async ({ page }) => {
  test.skip(process.env.PDBVIEW_LIVE_RCSB !== '1', 'Opt-in network check; deterministic CI uses the bundled RCSB fixture.');
  const errors = collectErrors(page);
  await loaded(page);
  await page.locator('#pdb-id').fill('1crn');
  await page.locator('#pdb-id').press('Enter');
  await expect(page.locator('#status-display')).toHaveText('1CRN loaded successfully');
  await expect(page.locator('.sequence-residue')).toHaveCount(46);
  expect(await page.evaluate(() => currentModel.selectedAtoms({}).length)).toBe(327);
  await page.getByRole('button', { name: 'Literature', exact: true }).click();
  await expect(page.locator('#literature-info')).toContainText('Found');
  await expect(page.getByRole('link', { name: 'PubMed', exact: true })).toBeVisible();
  await axeClean(page);
  expect(errors).toEqual([]);
});

test('RCSB citation links and detail dialogs are keyboard accessible', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('https://files.rcsb.org/download/1CRN.pdb', route =>
    route.fulfill({ contentType: 'text/plain', body: pdb }));
  await page.route('https://data.rcsb.org/rest/v1/core/entry/1CRN', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      citation: [{
        title: 'Water structure of a hydrophobic protein at atomic resolution',
        pdbx_database_id_PubMed: 16593516,
        pdbx_database_id_DOI: '10.1073/pnas.81.19.6014',
        rcsb_authors: ['Teeter, M.M.'], journal_abbrev: 'PNAS', year: 1984
      }]
    }) }));
  await page.goto('./?pdb=1CRN');
  await expect(page.locator('#status-display')).toHaveText('1CRN loaded successfully');
  await page.getByRole('button', { name: 'Literature', exact: true }).click();
  await expect(page.getByRole('link', { name: 'PubMed', exact: true })).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/16593516/');
  await expect(page.getByRole('link', { name: 'View Paper', exact: true })).toHaveAttribute('href', 'https://doi.org/10.1073/pnas.81.19.6014');
  await axeClean(page);
  const title = page.getByRole('button', { name: 'Water structure of a hydrophobic protein at atomic resolution', exact: true });
  await title.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#paper-viewer')).toBeVisible();
  await expect(page.locator('#paper-viewer a').first()).toHaveAttribute('href', 'https://doi.org/10.1073/pnas.81.19.6014');
  await axeClean(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#paper-viewer')).not.toBeVisible();
  await expect(title).toBeFocused();
  expect(errors).toEqual([]);
});

test('entries with more than five citations list every publication', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('https://files.rcsb.org/download/1CRN.pdb', route =>
    route.fulfill({ contentType: 'text/plain', body: pdb }));
  await page.route('https://data.rcsb.org/rest/v1/core/entry/1CRN', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      citation: Array.from({ length: 7 }, (_, index) => ({ title: `Citation ${index + 1}`, rcsb_authors: ['Test author'], year: 2000 + index }))
    }) }));
  await page.goto('./?pdb=1CRN');
  await expect(page.locator('#status-display')).toHaveText('1CRN loaded successfully');
  await page.getByRole('button', { name: 'Literature', exact: true }).click();
  await expect(page.locator('#literature-info')).toHaveText('Found 7 publication(s) related to 1CRN');
  await expect(page.locator('.paper-item')).toHaveCount(7);
  await page.getByRole('button', { name: 'Citation 7', exact: true }).click();
  await expect(page.locator('#paper-viewer-title')).toHaveText('Citation 7');
  expect(errors).toEqual([]);
});

test('citation metadata with markup characters is shown as text', async ({ page }) => {
  const errors = collectErrors(page);
  const title = 'Binding of Ca<sup>2+</sup> & <img src=x onerror="window.injected=1"> at pH < 5';
  await page.route('https://files.rcsb.org/download/1CRN.pdb', route =>
    route.fulfill({ contentType: 'text/plain', body: pdb }));
  await page.route('https://data.rcsb.org/rest/v1/core/entry/1CRN', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      citation: [{ title, rcsb_authors: ['O\'Brien, <b>A</b>'], pdbx_database_id_DOI: '10.1000/a"b\'c', year: 2020 }]
    }) }));
  await page.goto('./?pdb=1CRN');
  await expect(page.locator('#status-display')).toHaveText('1CRN loaded successfully');
  await page.getByRole('button', { name: 'Literature', exact: true }).click();
  await expect(page.locator('.paper-title')).toHaveText(title);
  await expect(page.locator('.paper-authors')).toHaveText('O\'Brien, <b>A</b>');
  await expect(page.getByRole('link', { name: 'View Paper', exact: true })).toHaveAttribute('href', 'https://doi.org/10.1000/a"b\'c');
  await page.locator('.paper-title').click();
  await expect(page.locator('#paper-viewer h3')).toHaveText(title);
  expect(await page.locator('#papers-list img, #paper-viewer img, #papers-list b').count()).toBe(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('a failed replacement does not strand the retained model publications', async ({ page }) => {
  const errors = collectErrors(page);
  let complete;
  const waiting = new Promise(resolve => { complete = resolve; });
  await page.route('https://files.rcsb.org/download/1CRN.pdb', route =>
    route.fulfill({ contentType: 'text/plain', body: pdb }));
  await page.route('https://data.rcsb.org/rest/v1/core/entry/1CRN', async route => {
    await waiting;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      citation: [{ title: 'Retained model publication', rcsb_authors: ['Test author'], year: 1984 }]
    }) });
  });
  await page.goto('./?pdb=1CRN');
  await expect(page.locator('#status-display')).toHaveText('1CRN loaded successfully');
  await dropPdb(page, 'no atom records', 'invalid.pdb');
  await expect(page.locator('#pdb-error-display')).toContainText('No atoms found');
  const response = page.waitForResponse('https://data.rcsb.org/rest/v1/core/entry/1CRN');
  complete();
  await response;
  await page.getByRole('button', { name: 'Literature', exact: true }).click();
  await expect(page.locator('#literature-info')).toContainText('Found 1 publication');
  await expect(page.getByRole('button', { name: 'Retained model publication' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('superseding a shared entry does not restore its measurement onto a local file', async ({ page }) => {
  const errors = collectErrors(page);
  let complete;
  const waiting = new Promise(resolve => { complete = resolve; });
  await page.route('https://files.rcsb.org/download/1ABC.pdb', async route => {
    await waiting;
    await route.fulfill({ contentType: 'text/plain', body: pdb });
  });
  await page.goto('./?pdb=1ABC&atoms=0,1&style=sphere&residue=%5B%22A%22,4,%22%22%5D');
  await expect(page.locator('#status-display')).toHaveText('Loading 1ABC...');
  await dropPdb(page, pdb, 'replacement.pdb');
  await expect(page.locator('#status-display')).toHaveText('replacement.pdb loaded successfully');
  await expect(page.locator('#distance-result')).toHaveText('No atoms selected');
  await expect(page.locator('#style-select')).toHaveValue('cartoon');
  expect(await page.evaluate(() => selectedResidue)).toBeNull();
  const response = page.waitForResponse('https://files.rcsb.org/download/1ABC.pdb');
  complete();
  await response;
  expect(await page.evaluate(() => currentPdbId)).toBeNull();
  expect(errors).toEqual([]);
});
