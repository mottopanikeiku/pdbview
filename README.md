# pdbview

pdbview is a PDB structure viewer for the browser, built on [3Dmol.js](https://3dmol.org/) with no build step. You can give it an RCSB ID, such as [4HHB](https://mottopanikeiku.github.io/pdbview/?pdb=4HHB) for hemoglobin, or drop in a `.pdb` file, which stays on your machine, and with no ID it opens crambin (1CRN).

![Hemoglobin (4HHB) colored by chain, His B:77 selected, 17.8 Å measured between two atoms](assets/pdbview.png)

Clicking a residue in the sequence strip highlights it in 3D, and picking two atoms gives their distance in ångströms. The structure draws as ribbon, stick, sphere, line or cross, colored by chain, residue or element, and other panels show the atom records, the raw PDB text and the entry's citations. The Share view button writes a link with the structure ID, style, camera, selection and measurement, so whoever opens it sees exactly what you saw.

The 3D view shows the first model and the A alternate location. From the keyboard, the arrow keys rotate it, `+` and `-` zoom, and `C` centers it.

## Running it

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/` in a browser, and run the Playwright tests with:

```sh
npm ci && npx playwright install chromium && npm test
```

Structures and citations come from [RCSB PDB](https://www.rcsb.org/). The page also uses [jQuery](https://jquery.com/), and the raw-text grid is [fast-grid](https://github.com/gabrielpetersson/fast-grid) by Gabriel Petersson. The code is MIT licensed, while the libraries and PDB data keep their own terms.
