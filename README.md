# pdbview - lightweight browser-based pdb viewer

a lightweight, interactive molecular viewer that runs entirely in your web browser. built with 3dmol.js for high-performance 3d visualization of protein structures.

## features

- **load pdb structures** by id from rcsb protein data bank
- **upload local pdb files** for custom structures
- **multiple visualization styles**: cartoon, stick, sphere, line, cross
- **flexible coloring schemes**: spectrum, chain, residue, atom, solid colors
- **interactive 3d controls**: rotate (drag), zoom (scroll), center view
- **lightweight**: no installation required, runs in any modern browser
- **responsive design**: works on desktop and mobile devices

## getting started

### quick start
1. open `index.html` in any modern web browser
2. enter a pdb id (e.g., `1bna`, `1crn`, `2igy`) and click "load from pdb"
3. or upload your own pdb file using the file selector
4. interact with the molecule using mouse controls

### examples to try
- `1bna` - dna double helix structure
- `1crn` - small protein (crambin)
- `2igy` - antibody structure
- `1htm` - hiv protease
- `6vxx` - sars-cov-2 spike protein

## usage

### loading structures
- **from pdb database**: enter a 4-character pdb id and click "load from pdb"
- **from file**: click "choose file" and select a local `.pdb` file

### visualization controls
- **style**: choose between cartoon, stick, sphere, line, or cross representations
- **color**: select from spectrum, chain-based, residue-based, atom-based, or solid colors
- **navigation**: 
  - drag to rotate the molecule
  - scroll to zoom in/out
  - click "center view" to reset the view
  - press enter in the pdb id field to load

### supported file formats
- pdb format (`.pdb` files)
- structures from rcsb protein data bank

## technical details

### built with
- **3dmol.js** - high-performance molecular visualization library
- **jquery** - dom manipulation and ajax requests
- **vanilla html/css/javascript** - no build process required

### browser compatibility
- chrome (recommended)
- firefox
- safari
- edge
- any modern browser with webgl support

### file structure
```
pdbview/
├── index.html          # main application file
├── readme.md          # this documentation
└── license           # mit license
```

## how it works

1. **pdb parsing**: the application fetches pdb data either from rcsb's servers or reads local files
2. **3d rendering**: 3dmol.js parses the molecular data and renders it using webgl
3. **styling**: users can apply different visual representations and color schemes
4. **interaction**: mouse and keyboard events control camera position and molecular display

## development

this is a client-side only application. to make changes:

1. edit `index.html` with any text editor
2. refresh the browser to see changes
3. no build process or server required

### adding new features

the codebase is designed to be easily extensible:
- **new visualization styles**: add options to the `style-select` dropdown
- **custom color schemes**: extend the `color-select` options
- **additional file formats**: 3dmol.js supports sdf, mol2, xyz, and other formats
- **analysis tools**: add molecular analysis functions using 3dmol.js apis

## contributing

1. fork the repository
2. make your changes
3. test in multiple browsers
4. submit a pull request

## license

this project is licensed under the mit license - see the [license](license) file for details.

## acknowledgments

- **3dmol.js** team for the excellent molecular visualization library
- **rcsb protein data bank** for providing free access to structural data
- **webgl** for enabling high-performance 3d graphics in browsers

---

*built for researchers, educators, and anyone interested in exploring molecular structures.*