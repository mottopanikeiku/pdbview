// Interaction state uses parsed atoms, so sequence selection and measurements agree with 3Dmol.
let structureSource = null;
let measurementMode = false;
let measurementAtoms = [];
let measurementShape = null;
let measurementLabel = null;
let pendingSharedState = new URLSearchParams(location.search);

function residueKey(residue) {
    return JSON.stringify([residue.chain || '', residue.resi, residue.icode || '']);
}

function residueSelection(residue) {
    return { chain: residue.chain || '', resi: residue.resi, icode: residue.icode || '' };
}

function applyResidueHighlight() {
    if (!currentModel || !selectedResidue) return;
    viewer.addStyle(residueSelection(selectedResidue), {
        stick: { color: '#ffdc55', radius: 0.3 }, sphere: { color: '#ffdc55', scale: 0.35 }
    });
}

function selectSequenceResidue(residue) {
    selectedResidue = residue;
    for (const button of document.querySelectorAll('.sequence-residue')) {
        button.setAttribute('aria-pressed', String(button.dataset.key === residueKey(residue)));
    }
    updateStyle();
    viewer.render();
    showMessage(`Selected ${residue.resn} ${residue.chain || '(blank chain)'}:${residue.resi}${residue.icode}`, 'success');
}

function displaySequenceStrip() {
    const strip = document.getElementById('sequence-strip');
    strip.replaceChildren();
    if (!proteinSequence.length) {
        strip.textContent = 'No observed standard amino-acid sequence in this structure.';
        return;
    }
    for (const chain of proteinSequence) {
        const row = document.createElement('div');
        row.className = 'sequence-chain';
        const label = document.createElement('span');
        label.textContent = `Chain ${chain.chain || '(blank)'}: `;
        row.append(label);
        for (const residue of chain.residues) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'sequence-residue';
            button.dataset.key = residueKey(residue);
            button.textContent = residue.resn;
            button.title = `${residue.resn} ${residue.chain || '(blank chain)'}:${residue.resi}${residue.icode}`;
            button.setAttribute('aria-label', button.title);
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', () => selectSequenceResidue(residue));
            row.append(button);
        }
        strip.append(row);
    }
}

function atomDescription(atom) {
    return `#${atom.serial} ${atom.atom} ${atom.resn} ${atom.chain || '(blank)'}:${atom.resi}${atom.icode || ''}`;
}

function populateMeasurementAtoms() {
    const atoms = currentModel ? currentModel.selectedAtoms({}) : [];
    for (const id of ['measure-first', 'measure-second']) {
        const select = document.getElementById(id);
        const fragment = document.createDocumentFragment();
        atoms.forEach((atom, index) => fragment.append(new Option(atomDescription(atom), String(index))));
        select.replaceChildren(fragment);
        select.disabled = !atoms.length;
    }
    document.getElementById('measure-second').selectedIndex = atoms.length > 1 ? 1 : 0;
    document.getElementById('measure-selected').disabled = !atoms.length;
}

function configureAtomPicking() {
    if (!currentModel) return;
    viewer.setClickable({}, measurementMode || interactiveMode, atom => {
        if (measurementMode) pickMeasurementAtom(atom);
        else if (interactiveMode) handleAtomClick(atom);
    });
}

function toggleMeasurement() {
    measurementMode = !measurementMode;
    document.getElementById('measure-toggle').setAttribute('aria-pressed', String(measurementMode));
    document.getElementById('measure-toggle').textContent = measurementMode ? 'Picking atoms: ON' : 'Pick two atoms';
    configureAtomPicking();
    if (measurementMode) document.getElementById('distance-result').textContent = 'Pick two atoms in the structure, or use the atom selectors below.';
    if (viewer) viewer.render();
}

function clearMeasurementDrawing() {
    if (measurementShape) viewer.removeShape(measurementShape);
    if (measurementLabel) viewer.removeLabel(measurementLabel);
    measurementShape = null;
    measurementLabel = null;
}

function resetMeasurement() {
    clearMeasurementDrawing();
    measurementAtoms = [];
    document.getElementById('distance-result').textContent = 'No atoms selected';
    if (viewer) viewer.render();
}

function pickMeasurementAtom(atom) {
    if (measurementAtoms.length === 2) resetMeasurement();
    if (measurementAtoms[0] === atom) {
        document.getElementById('distance-result').textContent = 'Choose a different second atom.';
        return;
    }
    measurementAtoms.push(atom);
    if (measurementAtoms.length === 1) {
        document.getElementById('distance-result').textContent = `First atom: ${atomDescription(atom)}. Pick a second atom.`;
    } else drawMeasurement();
}

function drawMeasurement() {
    clearMeasurementDrawing();
    const [first, second] = measurementAtoms;
    const distance = Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
    const text = `${distance.toFixed(3)} Å`;
    measurementShape = viewer.addLine({ start: first, end: second, color: '#ffdc55', linewidth: 3 });
    measurementLabel = viewer.addLabel(text, {
        position: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2, z: (first.z + second.z) / 2 },
        backgroundColor: '#202020', fontColor: '#ffffff', fontSize: 14
    });
    document.getElementById('distance-result').textContent = `${atomDescription(first)} → ${atomDescription(second)}: ${text}`;
    const atoms = currentModel.selectedAtoms({});
    document.getElementById('measure-first').value = String(atoms.indexOf(first));
    document.getElementById('measure-second').value = String(atoms.indexOf(second));
    viewer.render();
}

function measureSelectedAtoms() {
    if (!currentModel) return;
    const atoms = currentModel.selectedAtoms({});
    const first = atoms[Number(document.getElementById('measure-first').value)];
    const second = atoms[Number(document.getElementById('measure-second').value)];
    resetMeasurement();
    if (!first || !second) return;
    pickMeasurementAtom(first);
    pickMeasurementAtom(second);
}

function shareView() {
    const field = document.getElementById('share-url');
    const note = document.getElementById('share-note');
    if (!currentModel || structureSource === 'local') {
        field.value = '';
        note.textContent = 'Local files stay on your device. Load an RCSB entry or the bundled example to share a view.';
        return;
    }
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    if (currentPdbId) url.searchParams.set('pdb', currentPdbId);
    else url.searchParams.set('example', '1CRN');
    url.searchParams.set('style', document.getElementById('style-select').value);
    url.searchParams.set('color', document.getElementById('color-select').value);
    url.searchParams.set('view', JSON.stringify(viewer.getView()));
    if (selectedResidue) url.searchParams.set('residue', residueKey(selectedResidue));
    if (measurementAtoms.length === 2) {
        const atoms = currentModel.selectedAtoms({});
        url.searchParams.set('atoms', measurementAtoms.map(atom => atoms.indexOf(atom)).join(','));
    }
    field.value = url.href;
    history.replaceState(null, '', url);
    note.textContent = 'Copy this URL to restore the structure, style, camera, residue and measurement.';
    field.focus();
    field.select();
}

function restoreSharedView() {
    if (!pendingSharedState) return;
    const state = pendingSharedState;
    pendingSharedState = null;
    for (const [parameter, id] of [['style', 'style-select'], ['color', 'color-select']]) {
        const select = document.getElementById(id);
        if ([...select.options].some(option => option.value === state.get(parameter))) select.value = state.get(parameter);
    }
    updateStyle();
    try {
        const residue = JSON.parse(state.get('residue'));
        if (Array.isArray(residue) && residue.length === 3) {
            const match = proteinSequence.flatMap(chain => chain.residues).find(item => residueKey(item) === JSON.stringify(residue));
            if (match) selectSequenceResidue(match);
        }
    } catch { /* Ignore an invalid optional selection, keeping the structure usable. */ }
    const indices = state.get('atoms')?.split(',');
    if (indices?.length === 2 && indices.every(index => /^\d+$/.test(index))) {
        const atoms = currentModel.selectedAtoms({});
        const pair = indices.map(index => atoms[Number(index)]);
        if (pair.every(Boolean) && pair[0] !== pair[1]) {
            measurementAtoms = pair;
            drawMeasurement();
        }
    }
    try {
        const view = JSON.parse(state.get('view'));
        if (Array.isArray(view) && view.length === 8 && view.every(value => Number.isFinite(value) && Math.abs(value) < 1e7)) viewer.setView(view);
    } catch { /* Ignore malformed camera state. */ }
}

// Native buttons/selects work with Tab, Enter and Space; only the canvas needs custom keys.
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('viewer-container');
    canvas.addEventListener('keydown', event => {
        // Leave browser shortcuts such as Ctrl/Cmd +/- page zoom alone.
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const rotation = { ArrowLeft: [-10, 'y'], ArrowRight: [10, 'y'], ArrowUp: [-10, 'x'], ArrowDown: [10, 'x'] }[event.key];
        if (rotation) viewer.rotate(...rotation);
        else if (event.key === '+' || event.key === '=') viewer.zoom(1.15);
        else if (event.key === '-') viewer.zoom(1 / 1.15);
        else if (event.key.toLowerCase() === 'c') centerView();
        else return;
        event.preventDefault();
        viewer.render();
    });
    document.addEventListener('dragover', event => {
        if ([...event.dataTransfer.types].includes('Files')) {
            event.preventDefault();
            document.body.classList.add('file-dragging');
        }
    });
    document.addEventListener('dragleave', event => {
        if (!event.relatedTarget) document.body.classList.remove('file-dragging');
    });
    document.addEventListener('drop', event => {
        event.preventDefault();
        document.body.classList.remove('file-dragging');
        const files = [...event.dataTransfer.files];
        if (files.length !== 1) showPdbError('Drop one PDB file at a time');
        else loadLocalFile(files[0]);
    });
});
