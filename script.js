        // Performance utilities
        class PerformanceManager {
            static debounce(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            }
            
            static throttle(func, limit) {
                let inThrottle;
                return function() {
                    const args = arguments;
                    const context = this;
                    if (!inThrottle) {
                        func.apply(context, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                }
            }
        }
        
        // Enhanced cache manager with expiration
        class CacheManager {
            constructor(maxAge = 300000) { // 5 minutes
                this.cache = new Map();
                this.maxAge = maxAge;
            }
            
            set(key, value) {
                this.cache.set(key, {
                    value,
                    timestamp: Date.now()
                });
            }
            
            get(key) {
                const item = this.cache.get(key);
                if (!item) return null;
                
                if (Date.now() - item.timestamp > this.maxAge) {
                    this.cache.delete(key);
                    return null;
                }
                
                return item.value;
            }
            
            clear() {
                this.cache.clear();
            }
            
            size() {
                return this.cache.size;
            }
        }
        
        // Virtual scroll manager for literature
        class VirtualScrollManager {
            constructor(container, itemHeight = 120) {
                this.container = container;
                this.itemHeight = itemHeight;
                this.items = [];
                this.visibleItems = [];
                this.startIndex = 0;
                this.endIndex = 0;
                this.buffer = 3;
                this.scrollTop = 0;
                
                this.setupContainer();
                this.bindEvents();
            }
            
            setupContainer() {
                this.container.innerHTML = `
                    <div class="virtual-scroll-content"></div>
                `;
                this.content = this.container.querySelector('.virtual-scroll-content');
            }
            
            bindEvents() {
                this.container.addEventListener('scroll', 
                    PerformanceManager.throttle(() => this.updateView(), 16)
                );
            }
            
            setItems(items) {
                this.items = items;
                this.content.style.height = `${items.length * this.itemHeight}px`;
                this.updateView();
            }
            
            updateView() {
                const containerHeight = this.container.clientHeight;
                const scrollTop = this.container.scrollTop;
                
                const visibleCount = Math.ceil(containerHeight / this.itemHeight) + this.buffer * 2;
                this.startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
                this.endIndex = Math.min(this.items.length, this.startIndex + visibleCount);
                
                this.render();
            }
            
            render() {
                // Clear existing items
                this.content.innerHTML = '';
                
                for (let i = this.startIndex; i < this.endIndex; i++) {
                    const item = this.items[i];
                    if (!item) continue;
                    
                    const element = this.createItemElement(item, i);
                    element.style.top = `${i * this.itemHeight}px`;
                    element.classList.add('virtual-scroll-item');
                    this.content.appendChild(element);
                }
            }
            
            createItemElement(item, index) {
                const div = document.createElement('div');
                div.className = 'paper-item';
                div.style.height = `${this.itemHeight - 12}px`; // Account for margin
                div.onclick = () => viewPaper(index);
                
                const authors = Array.isArray(item.authors) ? 
                    item.authors.slice(0, 3).map(a => a.name || a).join(', ') + 
                    (item.authors.length > 3 ? ' et al.' : '') : 
                    (item.rcsb_authors || []).slice(0, 3).join(', ') + 
                    (item.rcsb_authors && item.rcsb_authors.length > 3 ? ' et al.' : '');
                
                div.innerHTML = `
                    <div class="paper-title">${item.title || 'Untitled'}</div>
                    <div class="paper-authors">${authors || 'Unknown authors'}</div>
                    <div class="paper-journal">${item.journal || 'Unknown journal'} ${item.year ? `(${item.year})` : ''}</div>
                    <div class="paper-abstract">${item.abstract || 'No abstract available.'}</div>
                    <div class="paper-actions" style="margin-top: 8px; display: flex; gap: 8px;">
                        ${item.doi ? `<button onclick="event.stopPropagation(); window.open('https://doi.org/${item.doi}', '_blank')" style="background: #51cf66; border: none; color: white; padding: 4px 8px; border-radius: 3px; font-size: 10px; cursor: pointer;">View Paper</button>` : ''}
                        ${item.pubmed_id ? `<button onclick="event.stopPropagation(); window.open('https://pubmed.ncbi.nlm.nih.gov/${item.pubmed_id}/', '_blank')" style="background: #4a9eff; border: none; color: white; padding: 4px 8px; border-radius: 3px; font-size: 10px; cursor: pointer;">PubMed</button>` : ''}
                    </div>
                `;
                
                return div;
            }
        }
        
        // Global variables
        let viewer;
        let currentModel;
        let interactiveMode = false;
        let selectedAtoms = [];
        let currentPdbId = null;
        let rawPdbData = null;
        
        // Enhanced cache instances
        const literatureCache = new CacheManager(600000); // 10 minutes
        const pdbCache = new CacheManager(1800000); // 30 minutes
        const pdbExistenceCache = new CacheManager(3600000); // 1 hour for existence checks
        
        // Performance monitoring
        class PerformanceMonitor {
            static frameCount = 0;
            static lastFPSUpdate = performance.now();
            static currentFPS = 0;
            
            static trackRender() {
                this.frameCount++;
                const now = performance.now();
                
                if (now - this.lastFPSUpdate >= 1000) {
                    this.currentFPS = Math.round((this.frameCount * 1000) / (now - this.lastFPSUpdate));
                    this.frameCount = 0;
                    this.lastFPSUpdate = now;
                    
                    // Warn if FPS drops too low
                    if (this.currentFPS < 20) {
                        console.warn(`Low FPS detected: ${this.currentFPS}`);
                    }
                }
            }
            
            static getFPS() {
                return this.currentFPS;
            }
        }
        
        // Virtual scroll manager
        let virtualScrollManager = null;
        
        // fast grid variables
        let fastGrid = {
            data: [],
            filteredData: [],
            currentFilter: 'all',
            visibleRows: [],
            rowHeight: 24,
            containerHeight: 0,
            scrollTop: 0,
            startIndex: 0,
            endIndex: 0,
            buffer: 10,
            container: null,
            viewport: null,
            header: null
        };
        
        // atom table variables
        let atomTable = {
            data: [],
            filteredData: [],
            currentTypeFilter: 'all',
            currentChainFilter: 'all',
            currentElementFilter: 'all',
            rowHeight: 22,
            containerHeight: 0,
            startIndex: 0,
            endIndex: 0,
            buffer: 20,
            container: null,
            viewport: null,
            isParsing: false  // Flag to prevent duplicate parsing
        };
        
        // Progressive loading for better performance
        document.addEventListener('DOMContentLoaded', function() {
            // Core functionality first
            initializeViewer();
            
            // Initialize secondary features
            setTimeout(() => {
                initializeSecondaryFeatures();
            }, 200);
            
            // Initialize advanced features last
            setTimeout(() => {
                initializeAdvancedFeatures();
            }, 500);
            
            // Handle window resize for fast grid and atom table
            window.addEventListener('resize', PerformanceManager.debounce(() => {
                if (fastGrid.viewport) {
                    updateFastGridDimensions();
                    updateFastGridView();
                }
                
                if (atomTable.viewport) {
                    updateAtomTableDimensions();
                    updateAtomTableView();
                }
                
                if (viewer) {
                    viewer.resize();
                    throttledRender();
                }
            }, 100));
        });
        
        function initializeSecondaryFeatures() {
            // Initialize virtual scroll manager for literature
            const papersListElement = document.getElementById('papers-list');
            if (papersListElement) {
                virtualScrollManager = new VirtualScrollManager(papersListElement);
            }
            
            // Initialize image lazy loading
            MemoryManager.optimizeImageLoading();
            
            // Set up keyboard shortcuts
            setupKeyboardShortcuts();
        }
        
        function initializeAdvancedFeatures() {
            // Preload common amino acid data
            preloadAminoAcidData();
            
            // Set up periodic cleanup
            setInterval(() => {
                if (literatureCache.size() > 20 || pdbCache.size() > 10 || pdbExistenceCache.size() > 100) {
                    MemoryManager.cleanupResources();
                }
            }, 300000); // Every 5 minutes
        }
        
        function setupKeyboardShortcuts() {
            document.addEventListener('keydown', function(e) {
                // Enter key to load PDB
                if (e.key === 'Enter' && e.target.id === 'pdb-id') {
                    e.preventDefault();
                    debouncedLoadPDB();
                }
                
                // Escape to clear
                if (e.key === 'Escape') {
                    e.preventDefault();
                    clearViewer();
                }
                
                // Space to toggle interactive mode
                if (e.key === ' ' && !e.target.matches('input, select, textarea')) {
                    e.preventDefault();
                    toggleInteractiveMode();
                }
                
                // C to center view
                if (e.key === 'c' && !e.target.matches('input, select, textarea')) {
                    e.preventDefault();
                    centerView();
                }
            });
        }
        
        function preloadAminoAcidData() {
            // Preload common amino acids to reduce lookup time
            const commonAminoAcids = ['ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE'];
            commonAminoAcids.forEach(code => {
                getAminoAcidData(code); // This will cache the data
            });
        }
        
        // Optimized rendering for performance
        let renderAnimationFrame;
        let isRenderScheduled = false;
        
        function throttledRender() {
            if (isRenderScheduled) return;
            
            isRenderScheduled = true;
            renderAnimationFrame = requestAnimationFrame(() => {
                if (viewer) {
                    viewer.render();
                    PerformanceMonitor.trackRender();
                }
                isRenderScheduled = false;
            });
        }
        
        // Cancel pending renders when switching contexts
        function cancelPendingRender() {
            if (renderAnimationFrame) {
                cancelAnimationFrame(renderAnimationFrame);
                isRenderScheduled = false;
            }
        }
        
        function initializeViewer() {
            const element = document.getElementById('viewer-container');
            if (!element) {
                console.error('Viewer container not found');
                return;
            }
            
            viewer = $3Dmol.createViewer($(element), {
                defaultcolors: $3Dmol.elementColors.rasmol,
                backgroundColor: 'black',
                // Enhanced performance optimizations
                antialias: false,
                preserveDrawingBuffer: false,
                powerPreference: "high-performance",
                alpha: false,
                depth: true,
                stencil: false,
                premultipliedAlpha: false,
                failIfMajorPerformanceCaveat: false
            });
            
            // Set up optimized controls
            viewer.setViewStyle({style: "outline", color: "black", width: 0.1});
            
            // Use single RAF call for initial setup
            requestAnimationFrame(() => {
                if (viewer) {
                    viewer.resize();
                    viewer.render();
                }
            });
        }
        
        function showMessage(message, type = 'info') {
            const statusDisplay = document.getElementById('status-display');
            if (!statusDisplay) return;
            
            statusDisplay.classList.remove('error', 'success', 'warning');
            
            if (type === 'error') {
                statusDisplay.classList.add('error');
            } else if (type === 'success') {
                statusDisplay.classList.add('success');
            } else if (type === 'warning') {
                statusDisplay.classList.add('warning');
            }
            
            statusDisplay.textContent = message;
        }
        
        // Local PDB error display functions
        function showPdbError(message) {
            const errorDisplay = document.getElementById('pdb-error-display');
            if (!errorDisplay) return;
            
            errorDisplay.textContent = message;
            errorDisplay.classList.add('show');
            
            // Auto-hide after 8 seconds
            setTimeout(() => hidePdbError(), 8000);
        }
        
        function hidePdbError() {
            const errorDisplay = document.getElementById('pdb-error-display');
            if (!errorDisplay) return;
            
            errorDisplay.classList.remove('show');
        }
        
        function clearPdbError() {
            hidePdbError();
        }
        
        // PDB validation indicator functions
        function showPdbValidationIndicator(message, type = 'checking') {
            const indicator = document.getElementById('pdb-validation-indicator');
            if (!indicator) return;
            
            indicator.textContent = message;
            indicator.className = `pdb-validation-indicator show ${type}`;
        }
        
        function hidePdbValidationIndicator() {
            const indicator = document.getElementById('pdb-validation-indicator');
            if (!indicator) return;
            
            indicator.classList.remove('show', 'checking', 'valid');
        }
        
        // Enhanced memory management utilities
        class MemoryManager {
            static cleanupResources() {
                // Cancel any pending renders first
                cancelPendingRender();
                
                if (currentModel) {
                    viewer.removeAllModels();
                    viewer.removeAllShapes();
                    currentModel = null;
                }
                
                // Clear large data structures
                if (fastGrid.data) {
                    fastGrid.data.length = 0; // More efficient than reassignment
                    fastGrid.filteredData.length = 0;
                }
                
                if (atomTable.data) {
                    atomTable.data.length = 0;
                    atomTable.filteredData.length = 0;
                }
                
                rawPdbData = null;
                selectedAtoms.length = 0;
                
                // Clear caches more aggressively
                if (literatureCache.size() > 8) {
                    literatureCache.clear();
                }
                if (pdbCache.size() > 3) {
                    pdbCache.clear();
                }
                if (pdbExistenceCache.size() > 50) { // Keep more existence checks cached
                    pdbExistenceCache.clear();
                }
                
                // Clear DOM references that might hold memory
                this.clearDOMReferences();
                
                // Force garbage collection hint
                if (window.gc) {
                    window.gc();
                }
            }
            
            static clearDOMReferences() {
                // Clear any cached DOM elements that might hold references
                const containers = [fastGrid.container, atomTable.container];
                containers.forEach(container => {
                    if (container) {
                        container.innerHTML = '';
                    }
                });
            }
            
            static optimizeImageLoading() {
                // Lazy load images
                const images = document.querySelectorAll('img[data-src]');
                const imageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    });
                });
                
                images.forEach(img => imageObserver.observe(img));
            }
        }
        
        function updateMolecularStats(model) {
            const stats = document.getElementById('molecular-stats');
            if (!stats) return;
            
            if (model) {
                const allAtoms = model.selectedAtoms({});
                const atoms = allAtoms.length;
                const chains = [...new Set(allAtoms.map(atom => atom.chain))].length;
                const residues = [...new Set(allAtoms.map(atom => atom.resi))].length;
                
                stats.innerHTML = `
                    <div class="stat-line"><span>Status:</span><span class="stat-value">Loaded</span></div>
                    <div class="stat-line"><span>Atoms:</span><span class="stat-value">${atoms.toLocaleString()}</span></div>
                    <div class="stat-line"><span>Chains:</span><span class="stat-value">${chains}</span></div>
                    <div class="stat-line"><span>Residues:</span><span class="stat-value">${residues.toLocaleString()}</span></div>
                `;
            } else {
                stats.innerHTML = `
                    <div class="stat-line"><span>Status:</span><span class="stat-value">Standby</span></div>
                    <div class="stat-line"><span>Atoms:</span><span class="stat-value">--</span></div>
                    <div class="stat-line"><span>Chains:</span><span class="stat-value">--</span></div>
                    <div class="stat-line"><span>Residues:</span><span class="stat-value">--</span></div>
                `;
            }
        }
        
        function quickLoad(pdbId) {
            const pdbInput = document.getElementById('pdb-id');
            if (pdbInput) {
                clearPdbError(); // Clear any previous errors
                hidePdbValidationIndicator(); // Clear validation indicator
                pdbInput.value = pdbId;
                loadPDBFromId();
            }
        }
        
        // Debounced loading function for performance
        const debouncedLoadPDB = PerformanceManager.debounce(loadPDBFromId, 300);
        
        async function loadPDBFromId() {
            const pdbInput = document.getElementById('pdb-id');
            if (!pdbInput) return;
            
            const pdbId = pdbInput.value.trim().toUpperCase();
            
            // Clear any previous PDB errors and indicators
            clearPdbError();
            hidePdbValidationIndicator();
            
            if (!pdbId) {
                showPdbError('Please enter a PDB ID');
                return;
            }
            
            // Validate PDB ID format (4 characters, alphanumeric)
            if (!/^[A-Z0-9]{4}$/.test(pdbId)) {
                showPdbError('PDB ID must be exactly 4 characters (letters and numbers only)');
                return;
            }
            
            // Check cache first
            const cachedData = pdbCache.get(pdbId);
            if (cachedData) {
                loadPDBData(cachedData, pdbId);
                return;
            }
            
            showMessage(`Checking ${pdbId}...`);
            
            try {
                // Quick existence check using RCSB REST API (much faster than downloading full file)
                const existsCheck = await checkPDBExists(pdbId);
                if (!existsCheck.exists) {
                    throw new Error(existsCheck.error);
            }
            
            showMessage(`Loading ${pdbId}...`);
            
            // Clear previous model
            viewer.removeAllModels();
            
                // Now fetch the actual PDB data
                const response = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
                
                if (!response.ok) {
                    throw new Error(`Failed to download PDB file for "${pdbId}"`);
                }
                
                const data = await response.text();
                
                // Validate that we got actual PDB data
                if (!data.includes('HEADER') && !data.includes('ATOM') && !data.includes('HETATM')) {
                    throw new Error(`Invalid PDB data received for "${pdbId}"`);
                }
                
                // Cache the data
                pdbCache.set(pdbId, data);
                
                loadPDBData(data, pdbId);
                
            } catch (error) {
                console.error('PDB loading error:', error);
                showPdbError(error.message);
                showMessage(`Failed to load ${pdbId}`, 'error');
            }
        }
        
        // Fast PDB existence check using RCSB REST API with caching
        async function checkPDBExists(pdbId) {
            // Check cache first
            const cachedResult = pdbExistenceCache.get(pdbId);
            if (cachedResult) {
                return cachedResult;
            }
            
            try {
                // Use RCSB's REST API to quickly check if PDB exists
                // This endpoint returns basic info (much smaller than full PDB file)
                const response = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                let result;
                
                if (response.status === 404) {
                    result = {
                        exists: false,
                        error: `PDB "${pdbId}" doesn't exist in the database`
                    };
                } else if (response.status === 400) {
                    result = {
                        exists: false,
                        error: `Invalid PDB ID format: "${pdbId}"`
                    };
                } else if (response.status >= 500) {
                    result = {
                        exists: false,
                        error: `Server error checking "${pdbId}". Try again later`
                    };
                } else if (!response.ok) {
                    result = {
                        exists: false,
                        error: `Error checking PDB "${pdbId}" (HTTP ${response.status})`
                    };
                } else {
                    // PDB exists, optionally parse some basic info
                    const data = await response.json();
                    result = {
                        exists: true,
                        info: {
                            title: data.struct?.title,
                            release_date: data.rcsb_accession_info?.initial_release_date
                        }
                    };
                }
                
                // Cache the result
                pdbExistenceCache.set(pdbId, result);
                return result;
                
            } catch (error) {
                // Network error or other issue
                console.warn('PDB existence check failed:', error);
                const result = {
                    exists: false,
                    error: `Unable to verify PDB "${pdbId}". Check your connection and try again`
                };
                
                // Don't cache network errors (so we can retry)
                return result;
            }
        }
        
        // Debounced real-time PDB validation
        const debouncedPDBValidation = PerformanceManager.debounce(async (pdbId) => {
            if (!pdbId || pdbId.length !== 4 || !/^[A-Z0-9]{4}$/.test(pdbId)) {
                hidePdbValidationIndicator();
                return; // Don't validate incomplete or invalid format
            }
            
            try {
                // Show checking indicator
                showPdbValidationIndicator('Checking PDB...', 'checking');
                
                const result = await checkPDBExists(pdbId);
                
                // Only update UI if the input still matches what we checked
                const currentInput = document.getElementById('pdb-id')?.value?.trim()?.toUpperCase();
                if (currentInput === pdbId) {
                    if (result.exists) {
                        showPdbValidationIndicator('PDB exists', 'valid');
                        // Auto-hide success indicator after 3 seconds
                        setTimeout(() => hidePdbValidationIndicator(), 3000);
                    } else {
                        hidePdbValidationIndicator();
                        showPdbError(result.error);
                    }
                } else {
                    // Input changed while we were checking, hide indicator
                    hidePdbValidationIndicator();
                }
            } catch (error) {
                hidePdbValidationIndicator();
                // Silently fail for real-time validation
                console.warn('Real-time validation failed:', error);
            }
        }, 800); // Wait 800ms after user stops typing
        
        function loadPDBData(data, pdbId) {
            try {
                // Cancel any pending renders
                cancelPendingRender();
                
                // Clear previous model and literature
                viewer.removeAllModels();
                viewer.removeAllShapes();
                clearLiterature();
                clearRawPdb();
                
                // Clear atom data to prevent duplication
                atomTable.data.length = 0;
                atomTable.filteredData.length = 0;
                
                // Add the molecular data to the viewer
                currentModel = viewer.addModel(data, 'pdb');
                
                // Check model size for performance warnings
                const atomCount = currentModel.selectedAtoms({}).length;
                if (atomCount > 50000) {
                    showMessage(`Large molecule detected (${atomCount.toLocaleString()} atoms). Performance may be affected.`, 'warning');
                }
                
                // Apply initial styling (batched)
                requestAnimationFrame(() => {
                updateStyle();
                
                    // Center and render once
                viewer.zoomTo();
                
                    // Store current pdb id and update stats
                currentPdbId = pdbId;
                updateMolecularStats(currentModel);
                    
                    // Parse data asynchronously to avoid blocking
                    setTimeout(() => {
                fetchLiterature(pdbId);
                displayRawPdb(data, pdbId);
                parseAtomData(data);
                    }, 0);
                
                showMessage(`${pdbId} loaded successfully`, 'success');
                    // Clear any previous PDB errors on successful load
                    clearPdbError();
                });
                
            } catch (error) {
                console.error('PDB parsing error:', error);
                showPdbError(`Error parsing PDB data: ${error.message}`);
                showMessage(`Error parsing PDB data: ${error.message}`, 'error');
            }
        }
        
        function loadPDBFromFile() {
            const fileInput = document.getElementById('pdb-file');
            if (!fileInput || !fileInput.files || !fileInput.files[0]) {
                return;
            }
            
            const file = fileInput.files[0];
            
            // Clear any previous PDB errors and indicators
            clearPdbError();
            hidePdbValidationIndicator();
            
            // Validate file extension
            if (!file.name.toLowerCase().endsWith('.pdb')) {
                showPdbError('Please select a PDB file (.pdb extension)');
                return;
            }
            
            // Validate file size (limit to 50MB for performance)
            if (file.size > 50 * 1024 * 1024) {
                showPdbError('File too large. Please select a file smaller than 50MB');
                return;
            }
            
            showMessage(`Loading ${file.name}...`);
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = e.target.result;
                    
                    // Validate file content
                    if (!data || data.trim().length === 0) {
                        throw new Error('File appears to be empty');
                    }
                    
                    // Check if it looks like a PDB file
                    if (!data.includes('ATOM') && !data.includes('HETATM') && !data.includes('HEADER')) {
                        throw new Error('File doesn\'t appear to be a valid PDB format');
                    }
                    
                    // Clear previous model
                    viewer.removeAllModels();
                    
                    // Clear atom data to prevent duplication
                    atomTable.data = [];
                    atomTable.filteredData = [];
                    
                    // Add the molecular data to the viewer
                    currentModel = viewer.addModel(data, 'pdb');
                    
                    // Apply initial styling
                    updateStyle();
                    
                    // Center and render
                    viewer.zoomTo();
                    throttledRender();
                    
                    // Clear literature for file uploads (no pdb id)
                    currentPdbId = null;
                    clearLiterature();
                    clearRawPdb();
                    displayRawPdb(data, null);
                    
                    // Parse atom data for atom table
                    parseAtomData(data);
                    
                    updateMolecularStats(currentModel);
                    showMessage(`${file.name} loaded successfully`, 'success');
                } catch (error) {
                    console.error('File parsing error:', error);
                    showPdbError(`Error parsing file: ${error.message}`);
                    showMessage(`Error parsing file: ${error.message}`, 'error');
                }
            };
            
            reader.onerror = function() {
                showPdbError('Error reading file. Please try again');
                showMessage('Error reading file', 'error');
            };
            
            reader.readAsText(file);
        }
        
        const throttledUpdateStyle = PerformanceManager.throttle(updateStyle, 150);
        
        function updateStyle() {
            if (!currentModel) {
                return;
            }
            
            const styleSelect = document.getElementById('style-select');
            const colorSelect = document.getElementById('color-select');
            
            if (!styleSelect || !colorSelect) return;
            
            const styleType = styleSelect.value;
            const colorScheme = colorSelect.value;
            
            // Batch style updates for better performance
            cancelPendingRender(); // Cancel any pending renders
            
            // Clear existing styles efficiently
            viewer.removeAllShapes();
            viewer.setStyle({}, {});
            
            // Define style object with proper color handling
            const styleObj = {};
            
            // Handle different color schemes properly for 3DMol.js
            if (colorScheme === 'spectrum') {
                styleObj[styleType] = { colorscheme: 'spectrum' };
            } else if (colorScheme === 'chain') {
                styleObj[styleType] = { colorscheme: 'chain' };
            } else if (colorScheme === 'residue') {
                styleObj[styleType] = { colorscheme: 'residue' };
            } else if (colorScheme === 'element') {
                styleObj[styleType] = { colorscheme: 'element' };
            } else {
                // For solid colors (white, red, blue, green)
                styleObj[styleType] = { color: colorScheme };
            }
            
            // Apply the style in a single batch
            viewer.setStyle({}, styleObj);
            
            // Re-enable click handling if interactive mode is on (without render)
            if (interactiveMode) {
                viewer.setClickable({}, true, function(atom, viewer, event, container) {
                    if (interactiveMode) {
                        handleAtomClick(atom);
                    }
                });
            }
            
            // Single render call at the end
            throttledRender();
        }
        
        function centerView() {
            if (viewer) {
                viewer.zoomTo();
                throttledRender();
                showMessage('View centered', 'success');
            }
        }
        
        function clearViewer() {
            if (viewer) {
                viewer.removeAllModels();
                throttledRender();
                currentModel = null;
                selectedAtoms = [];
                currentPdbId = null;
                updateMolecularStats(null);
                closeAminoAcidModal();
                clearLiterature();
                clearRawPdb();
                clearPdbError(); // Clear any PDB errors
                hidePdbValidationIndicator(); // Clear validation indicator
                showMessage('Display cleared');
                
                // Turn off interactive mode
                if (interactiveMode) {
                    interactiveMode = false;
                    const btn = document.getElementById('interactive-btn');
                    if (btn) {
                        btn.textContent = 'Interactive Mode: OFF';
                        btn.style.background = '#2a2a2a';
                    }
                }
                
                // Clear atom data
                atomTable.data = [];
                atomTable.filteredData = [];
                atomTable.isParsing = false;
                
                // Reset atoms tab
                const atomsTitle = document.getElementById('atoms-title');
                const atomsInfo = document.getElementById('atoms-info');
                const atomsContent = document.getElementById('atom-table-content');
                
                if (atomsTitle) atomsTitle.textContent = 'Atom Data';
                if (atomsInfo) atomsInfo.textContent = 'Load a structure to view atomic coordinates and properties';
                if (atomsContent) {
                    atomsContent.innerHTML = '<div class="no-rawpdb"><div>No structure loaded</div><div style="margin-top: 5px; font-size: 10px;">Load a PDB structure to view atomic data</div></div>';
                }
                
                // Clean up resources
                MemoryManager.cleanupResources();
            }
        }
        
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
        
        function toggleInteractiveMode() {
            interactiveMode = !interactiveMode;
            const btn = document.getElementById('interactive-btn');
            
            if (!btn) return;
            
            if (interactiveMode) {
                btn.textContent = 'Interactive Mode: ON';
                btn.style.background = '#333333';
                enableClickHandling();
                showMessage('Interactive mode enabled - click on amino acids to explore', 'success');
            } else {
                btn.textContent = 'Interactive Mode: OFF';
                btn.style.background = '#2a2a2a';
                disableClickHandling();
                closeAminoAcidModal();
                showMessage('Interactive mode disabled', 'info');
            }
        }
        
        function enableClickHandling() {
            if (!currentModel) return;
            
            // Set up click handling for all atoms (no immediate render)
            viewer.setClickable({}, true, function(atom, viewer, event, container) {
                if (interactiveMode) {
                    handleAtomClick(atom);
                }
            });
            
            // Only render if not already scheduled
            throttledRender();
        }
        
        function disableClickHandling() {
            if (!currentModel) return;
            
            // Clear previous selections efficiently
            clearAtomSelection();
            
            // Remove click handlers (no immediate render)
            viewer.setClickable({}, false);
            
            // Single render call
            throttledRender();
        }
        
        function handleAtomClick(atom) {
            // clear previous selection
            clearAtomSelection();
            
            // highlight the clicked residue
            const residueSelector = {
                chain: atom.chain,
                resi: atom.resi
            };
            
            // add glowing highlight to the residue
            viewer.addStyle(residueSelector, {
                stick: {
                    color: '#ffff00',
                    radius: 0.4
                },
                sphere: {
                    color: '#ffff00',
                    radius: 0.6,
                    alpha: 0.8
                }
            });
            
            // store selected atoms for later clearing
            selectedAtoms = currentModel.selectedAtoms(residueSelector);
            
            throttledRender();
            
            // Show amino acid details in modal
            showAminoAcidDetails(atom);
            
            showMessage(`Selected: ${getResidueFullName(atom.resn)} in chain ${atom.chain}`, 'success');
        }
        
        function clearAtomSelection() {
            if (selectedAtoms.length > 0) {
                selectedAtoms = [];
                // Reapply the current style to remove highlights
                throttledUpdateStyle();
            }
        }
        
        function showAminoAcidDetails(atom) {
            const residueCode = atom.resn;
            const residueName = getResidueFullName(residueCode);
            const residueData = getAminoAcidData(residueCode);
            
            // Update modal title
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) {
                modalTitle.textContent = `${residueName} (${residueCode})`;
            }
            
            // Show structure
            const structureElement = document.getElementById('amino-acid-structure');
            if (structureElement) {
                structureElement.innerHTML = `
                    <div style="font-size: 14px; color: #ffffff; margin-bottom: 10px;">Chemical Structure</div>
                    <div style="font-family: monospace; font-size: 24px; color: #00ff88; background: #000; padding: 15px; border-radius: 4px;">
                        ${residueData.structure}
                    </div>
                `;
            }
            
            // Show information
            const infoElement = document.getElementById('amino-acid-info');
            if (infoElement) {
                infoElement.innerHTML = `
                    <div class="info-item">
                        <span class="info-label">Full Name:</span>
                        <span class="info-value">${residueName}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Code:</span>
                        <span class="info-value">${residueCode}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Chain:</span>
                        <span class="info-value">${atom.chain || 'unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Position:</span>
                        <span class="info-value">${atom.resi || 'unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Type:</span>
                        <span class="info-value">${residueData.type}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Properties:</span>
                        <span class="info-value">${residueData.properties}</span>
                    </div>
                `;
            }
            
            // Show description
            const descriptionElement = document.getElementById('amino-acid-description');
            if (descriptionElement) {
                descriptionElement.textContent = residueData.description;
            }
            
            // Show modal with fade effect
            const modal = document.getElementById('amino-acid-modal');
            if (modal) {
                modal.style.display = 'block';
                modal.style.opacity = '0';
                setTimeout(() => {
                    modal.style.opacity = '1';
                    modal.style.transition = 'opacity 0.2s ease';
                }, 10);
            }
        }
        
        function closeAminoAcidModal() {
            const modal = document.getElementById('amino-acid-modal');
            if (modal) {
                modal.style.opacity = '0';
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 200);
            }
        }
        
        function getAminoAcidData(resn) {
            const aminoAcidData = {
                'ALA': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚ƒ)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Nonpolar, hydrophobic',
                    description: 'Alanine is the simplest amino acid after glycine. Its methyl side chain is nonpolar and hydrophobic, making it commonly found in the interior of proteins.'
                },
                'ARG': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚â‚ƒ-NH-C(NHâ‚‚)â‚‚âº)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Positively charged, basic',
                    description: 'Arginine has a positively charged guanidino group, making it basic and hydrophilic. Often found on protein surfaces and involved in binding negatively charged molecules.'
                },
                'ASN': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚-CONHâ‚‚)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Polar, uncharged',
                    description: 'Asparagine has an amide group that can form hydrogen bonds. Common in protein surfaces and often involved in protein-protein interactions.'
                },
                'ASP': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚-COOâ»)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Negatively charged, acidic',
                    description: 'Aspartic acid has a carboxyl group that is negatively charged at physiological pH. Often found on protein surfaces and involved in binding positively charged molecules.'
                },
                'CYS': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚-SH)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Polar, forms disulfide bonds',
                    description: 'Cysteine contains a sulfur atom that can form disulfide bonds with other cysteines, providing structural stability to proteins.'
                },
                'GLN': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚â‚‚-CONHâ‚‚)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Polar, uncharged',
                    description: 'Glutamine has an amide group and is similar to asparagine but with a longer side chain. Important for protein folding and stability.'
                },
                'GLU': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚â‚‚-COOâ»)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Negatively charged, acidic',
                    description: 'Glutamic acid is similar to aspartic acid but with a longer side chain. Key in enzyme active sites and protein-protein interactions.'
                },
                'GLY': {
                    structure: 'Hâ‚ƒNâº-CHâ‚‚-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Flexible, smallest',
                    description: 'Glycine is the smallest amino acid with just a hydrogen atom as its side chain. Provides flexibility in protein structures and often found in turns.'
                },
                'HIS': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚-imidazole)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Positively charged, basic',
                    description: 'Histidine has an imidazole ring that can be positively charged. Often found in enzyme active sites due to its ability to donate and accept protons.'
                },
                'ILE': {
                    structure: 'Hâ‚ƒNâº-CH(CH(CHâ‚ƒ)CHâ‚‚CHâ‚ƒ)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Nonpolar, hydrophobic',
                    description: 'Isoleucine is a branched, hydrophobic amino acid. Important for protein structure and commonly found in the hydrophobic core of proteins.'
                },
                'LEU': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚CH(CHâ‚ƒ)â‚‚)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Nonpolar, hydrophobic',
                    description: 'Leucine is a branched, hydrophobic amino acid. Very common in proteins and important for maintaining protein structure through hydrophobic interactions.'
                },
                'LYS': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚â‚„-NHâ‚ƒâº)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Positively charged, basic',
                    description: 'Lysine has a positively charged amino group. Often found on protein surfaces and involved in binding DNA and other negatively charged molecules.'
                },
                'MET': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚â‚‚-S-CHâ‚ƒ)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Nonpolar, hydrophobic',
                    description: 'Methionine contains sulfur and is often the starting amino acid in protein synthesis. Important for protein folding and structure.'
                },
                'PHE': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚-benzene)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Nonpolar, aromatic',
                    description: 'Phenylalanine has a large aromatic benzene ring. Hydrophobic and often involved in protein-protein interactions through Ï€-Ï€ stacking.'
                },
                'PRO': {
                    structure: 'Hâ‚‚Nâº-cyclic-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Rigid, cyclic',
                    description: 'Proline has a unique cyclic structure that restricts backbone flexibility. Often found in turns and can disrupt secondary structures.'
                },
                'SER': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚-OH)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Polar, uncharged',
                    description: 'Serine has a hydroxyl group that can form hydrogen bonds. Often phosphorylated for regulatory purposes and common in enzyme active sites.'
                },
                'THR': {
                    structure: 'Hâ‚ƒNâº-CH(CH(OH)CHâ‚ƒ)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Polar, uncharged',
                    description: 'Threonine has a hydroxyl group like serine but with an additional methyl group. Can be phosphorylated and involved in protein regulation.'
                },
                'TRP': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚-indole)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Nonpolar, aromatic',
                    description: 'Tryptophan has the largest side chain with an indole ring. Highly hydrophobic and often involved in protein-membrane interactions.'
                },
                'TYR': {
                    structure: 'Hâ‚ƒNâº-CH(CHâ‚‚-phenol)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Polar, aromatic',
                    description: 'Tyrosine has a phenol group that can form hydrogen bonds. Can be phosphorylated for signaling and involved in protein-protein interactions.'
                },
                'VAL': {
                    structure: 'Hâ‚ƒNâº-CH(CH(CHâ‚ƒ)â‚‚)-COOâ»',
                    type: 'Amino Acid',
                    properties: 'Nonpolar, hydrophobic',
                    description: 'Valine is a branched, hydrophobic amino acid. Important for protein structure and commonly found in the hydrophobic core of proteins.'
                },
                'A': {
                    structure: 'Adenine-Ribose-POâ‚„',
                    type: 'RNA Nucleotide',
                    properties: 'Purine base',
                    description: 'Adenine nucleotide in RNA. Forms two hydrogen bonds with uracil. Essential for genetic information storage and protein synthesis.'
                },
                'U': {
                    structure: 'Uracil-Ribose-POâ‚„',
                    type: 'RNA Nucleotide',
                    properties: 'Pyrimidine base',
                    description: 'Uracil nucleotide in RNA. Forms two hydrogen bonds with adenine. Replaces thymine in RNA molecules.'
                },
                'G': {
                    structure: 'Guanine-Ribose-POâ‚„',
                    type: 'RNA Nucleotide',
                    properties: 'Purine base',
                    description: 'Guanine nucleotide in RNA. Forms three hydrogen bonds with cytosine. Important for genetic stability and gene expression.'
                },
                'C': {
                    structure: 'Cytosine-Ribose-POâ‚„',
                    type: 'RNA Nucleotide',
                    properties: 'Pyrimidine base',
                    description: 'Cytosine nucleotide in RNA. Forms three hydrogen bonds with guanine. Essential for genetic information and protein synthesis.'
                },
                'DA': {
                    structure: 'Adenine-Deoxyribose-POâ‚„',
                    type: 'DNA Nucleotide',
                    properties: 'Purine base',
                    description: 'Deoxyadenosine in DNA. Forms two hydrogen bonds with thymine. Essential for genetic information storage.'
                },
                'DT': {
                    structure: 'Thymine-Deoxyribose-POâ‚„',
                    type: 'DNA Nucleotide',
                    properties: 'Pyrimidine base',
                    description: 'Deoxythymidine in DNA. Forms two hydrogen bonds with adenine. Unique to DNA, replaced by uracil in RNA.'
                },
                'DG': {
                    structure: 'Guanine-Deoxyribose-POâ‚„',
                    type: 'DNA Nucleotide',
                    properties: 'Purine base',
                    description: 'Deoxyguanosine in DNA. Forms three hydrogen bonds with cytosine. Important for genetic stability.'
                },
                'DC': {
                    structure: 'Cytosine-Deoxyribose-POâ‚„',
                    type: 'DNA Nucleotide',
                    properties: 'Pyrimidine base',
                    description: 'Deoxycytidine in DNA. Forms three hydrogen bonds with guanine. Essential for genetic information storage.'
                }
            };
            
            return aminoAcidData[resn] || {
                structure: 'Structure not available',
                type: 'Unknown',
                properties: 'Unknown',
                description: 'No detailed information available for this residue.'
            };
        }
        
        function getResidueFullName(resn) {
            const residueNames = {
                'ALA': 'Alanine', 'ARG': 'Arginine', 'ASN': 'Asparagine', 'ASP': 'Aspartic Acid',
                'CYS': 'Cysteine', 'GLN': 'Glutamine', 'GLU': 'Glutamic Acid', 'GLY': 'Glycine',
                'HIS': 'Histidine', 'ILE': 'Isoleucine', 'LEU': 'Leucine', 'LYS': 'Lysine',
                'MET': 'Methionine', 'PHE': 'Phenylalanine', 'PRO': 'Proline', 'SER': 'Serine',
                'THR': 'Threonine', 'TRP': 'Tryptophan', 'TYR': 'Tyrosine', 'VAL': 'Valine',
                'A': 'Adenine', 'T': 'Thymine', 'G': 'Guanine', 'C': 'Cytosine',
                'U': 'Uracil', 'DA': 'Deoxyadenosine', 'DT': 'Deoxythymidine', 
                'DG': 'Deoxyguanosine', 'DC': 'Deoxycytidine'
            };
            
            return residueNames[resn] || resn;
        }
        
        // File input handling (optimized)
        function setupFileInputHandler() {
            const fileInput = document.getElementById('pdb-file');
            const fileLabel = document.querySelector('.file-label');
            
            if (fileInput && fileLabel) {
                fileInput.addEventListener('change', function() {
                    const fileName = this.files[0] ? this.files[0].name : 'Choose PDB File';
                    const displayName = fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName;
                    fileLabel.textContent = displayName;
                });
            }
        }
        
        // Initialize file input handler after DOM loads
        document.addEventListener('DOMContentLoaded', function() {
            setupFileInputHandler();
            setupPdbInputHandler();
        });
        
        // Setup PDB input handler with real-time validation
        function setupPdbInputHandler() {
            const pdbInput = document.getElementById('pdb-id');
            if (pdbInput) {
                pdbInput.addEventListener('input', function() {
                    const value = this.value.trim().toUpperCase();
                    
                    // Clear errors and validation indicators as user types
                    clearPdbError();
                    hidePdbValidationIndicator();
                    
                    // Update input to uppercase for consistency
                    if (this.value !== value) {
                        this.value = value;
                    }
                    
                    // Trigger real-time validation if input looks complete
                    if (value.length === 4) {
                        debouncedPDBValidation(value);
                    }
                });
                
                // Also validate on blur (when user leaves the field)
                pdbInput.addEventListener('blur', function() {
                    const value = this.value.trim().toUpperCase();
                    if (value.length === 4 && /^[A-Z0-9]{4}$/.test(value)) {
                        debouncedPDBValidation(value);
                    }
                });
            }
        }
        
        // tab switching functions
        function switchTab(tabName) {
            // update tab buttons efficiently
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelector(`button[onclick="switchTab('${tabName}')"]`)?.classList.add('active');
            
            // update tab panels efficiently
            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
            document.getElementById(`${tabName}-panel`)?.classList.add('active');
            
            // if switching to 3d view, resize viewer efficiently
            if (tabName === '3d-view' && viewer) {
                requestAnimationFrame(() => {
                    viewer.resize();
                    throttledRender();
                });
            }
            
            // if switching to raw pdb, update grid dimensions
            if (tabName === 'rawpdb' && fastGrid.viewport) {
                setTimeout(() => {
                    updateFastGridDimensions();
                    updateFastGridView();
                }, 100);
            }
            
                    // if switching to atoms tab, initialize and update table
        if (tabName === 'atoms') {
            setTimeout(() => {
                if (atomTable.data.length > 0) {
                    initializeAtomTable();
                    // Force dimension update after tab is fully visible
                    setTimeout(() => {
                        updateAtomTableDimensions();
                        updateAtomTableView();
                    }, 50);
                    console.log('Atoms tab activated with data');
                } else {
                    console.log('Atoms tab activated but no data available');
                }
            }, 100);
        }
        }
        
        // Literature functions
        function clearLiterature() {
            const titleElement = document.getElementById('literature-title');
            const infoElement = document.getElementById('literature-info');
            const listElement = document.getElementById('papers-list');
            
            if (titleElement) titleElement.textContent = 'Related Publications';
            if (infoElement) infoElement.textContent = 'Select a protein structure to view related research papers';
            if (listElement) listElement.innerHTML = '<div class="no-literature">No structure loaded</div>';
        }
        
        async function fetchLiterature(pdbId) {
            // Check cache first
            const cachedData = literatureCache.get(pdbId);
            if (cachedData) {
                displayLiterature(pdbId, cachedData);
                return;
            }
            
            const titleElement = document.getElementById('literature-title');
            const infoElement = document.getElementById('literature-info');
            const listElement = document.getElementById('papers-list');
            
            if (titleElement) titleElement.textContent = `Related Publications for ${pdbId}`;
            if (infoElement) infoElement.textContent = 'Loading publications...';
            if (listElement) listElement.innerHTML = '<div class="loading-literature">Fetching literature from RCSB database...</div>';
            
            try {
                // Fetch entry data from RCSB API using modern fetch
                const response = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                const citations = data.citation || [];
                
                if (citations.length === 0) {
                    displayNoLiterature(pdbId);
                    return;
                }
                
                // Fetch detailed publication info for each citation
                const publicationPromises = citations.map(citation => {
                    if (citation.pdbx_database_id_pubmed) {
                        return fetchPubMedDetails(citation.pdbx_database_id_pubmed, citation);
                    }
                    return Promise.resolve(citation);
                });
                
                const publications = await Promise.all(publicationPromises);
                const filteredPublications = publications.filter(pub => pub !== null);
                
                // Cache the results
                literatureCache.set(pdbId, filteredPublications);
                
                displayLiterature(pdbId, filteredPublications);
                
            } catch (error) {
                console.error('Literature fetch error:', error);
                displayNoLiterature(pdbId, 'Failed to fetch publication data');
            }
        }
        
        async function fetchPubMedDetails(pubmedId, citation) {
            try {
                const response = await fetch(`https://data.rcsb.org/rest/v1/core/pubmed/${pubmedId}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                
                return {
                    ...citation,
                    pubmed_id: pubmedId,
                    title: data.title || citation.title,
                    authors: data.author || [],
                    journal: data.journal_abbrev || citation.journal_abbrev,
                    year: data.year || citation.year,
                    abstract: data.abstract || null,
                    doi: data.doi || citation.pdbx_database_id_doi,
                    pubmed_data: data
                };
            } catch (error) {
                console.warn(`Failed to fetch PubMed details for ${pubmedId}:`, error);
                return citation;
            }
        }
        
        function displayLiterature(pdbId, publications) {
            const infoElement = document.getElementById('literature-info');
            const listElement = document.getElementById('papers-list');
            
            if (infoElement) {
                infoElement.textContent = `Found ${publications.length} publication(s) related to ${pdbId}`;
            }
            
            if (publications.length === 0) {
                displayNoLiterature(pdbId);
                return;
            }
            
            // Use virtual scrolling for better performance with many publications
            if (virtualScrollManager && publications.length > 5) {
                // Store publications globally for viewPaper function access
                window.currentPublications = publications;
                virtualScrollManager.setItems(publications);
            } else {
                // Use regular rendering for small lists
                displayLiteratureRegular(publications, listElement);
            }
        }
        
        function displayLiteratureRegular(publications, container) {
            if (!container) return;
            
            const fragment = document.createDocumentFragment();
            
            publications.forEach((pub, index) => {
                const authors = Array.isArray(pub.authors) ? 
                    pub.authors.slice(0, 3).map(a => a.name || a).join(', ') + 
                    (pub.authors.length > 3 ? ' et al.' : '') : 
                    (pub.rcsb_authors || []).slice(0, 3).join(', ') + 
                    (pub.rcsb_authors && pub.rcsb_authors.length > 3 ? ' et al.' : '');
                
                const paperItem = document.createElement('div');
                paperItem.className = 'paper-item';
                paperItem.onclick = () => viewPaper(index);
                
                paperItem.innerHTML = `
                    <div class="paper-title">${pub.title || 'Untitled'}</div>
                    <div class="paper-authors">${authors || 'Unknown authors'}</div>
                    <div class="paper-journal">${pub.journal || 'Unknown journal'} ${pub.year ? `(${pub.year})` : ''}</div>
                    <div class="paper-abstract">${pub.abstract || 'No abstract available.'}</div>
                    <div class="paper-actions" style="margin-top: 8px; display: flex; gap: 8px;">
                        ${pub.doi ? `<button onclick="event.stopPropagation(); window.open('https://doi.org/${pub.doi}', '_blank')" style="background: #51cf66; border: none; color: white; padding: 4px 8px; border-radius: 3px; font-size: 10px; cursor: pointer;">View Paper</button>` : ''}
                        ${pub.pubmed_id ? `<button onclick="event.stopPropagation(); window.open('https://pubmed.ncbi.nlm.nih.gov/${pub.pubmed_id}/', '_blank')" style="background: #4a9eff; border: none; color: white; padding: 4px 8px; border-radius: 3px; font-size: 10px; cursor: pointer;">PubMed</button>` : ''}
                    </div>
                `;
                
                fragment.appendChild(paperItem);
            });
            
            container.innerHTML = '';
            container.appendChild(fragment);
            
            // Store for viewPaper function
            window.currentPublications = publications;
        }
        
        function displayNoLiterature(pdbId, message = null) {
            const infoElement = document.getElementById('literature-info');
            const listElement = document.getElementById('papers-list');
            
            if (infoElement) {
                infoElement.textContent = `No publications found for ${pdbId}`;
            }
            
            if (listElement) {
                listElement.innerHTML = `
                    <div class="no-literature">
                        <div>${message || 'No related publications found'}</div>
                        <div style="margin-top: 5px; font-size: 10px;">This structure may not have associated research papers in the database</div>
                    </div>
                `;
            }
        }
        
        function viewPaper(index) {
            // Get publications from global variable or cache
            const publications = window.currentPublications || 
                                (currentPdbId ? literatureCache.get(currentPdbId) : null);
            
            if (!publications || !publications[index]) {
                return;
            }
            
            const paper = publications[index];
            
            const titleElement = document.getElementById('paper-viewer-title');
            const bodyElement = document.getElementById('paper-viewer-body');
            const viewerElement = document.getElementById('paper-viewer');
            
            if (titleElement) {
                titleElement.textContent = paper.title || 'Paper Details';
            }
            
            if (bodyElement) {
                const content = `
                    <div class="paper-detail">
                        <h3>${paper.title || 'Untitled'}</h3>
                        
                        <div class="detail-section">
                            <div class="detail-label">Authors</div>
                            <div class="detail-value">
                                ${Array.isArray(paper.authors) ? 
                                    paper.authors.map(a => a.name || a).join(', ') : 
                                    (paper.rcsb_authors || []).join(', ') || 'Unknown authors'}
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <div class="detail-label">Journal</div>
                            <div class="detail-value">${paper.journal || 'Unknown journal'}</div>
                        </div>
                        
                        <div class="detail-section">
                            <div class="detail-label">Year</div>
                            <div class="detail-value">${paper.year || 'Unknown'}</div>
                        </div>
                        
                        ${paper.doi ? `
                            <div class="detail-section">
                                <div class="detail-label">DOI</div>
                                <div class="detail-value">
                                    <a href="https://doi.org/${paper.doi}" target="_blank" style="color: #51cf66;">
                                        ${paper.doi}
                                    </a>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${paper.pubmed_id ? `
                            <div class="detail-section">
                                <div class="detail-label">PubMed ID</div>
                                <div class="detail-value">
                                    <a href="https://pubmed.ncbi.nlm.nih.gov/${paper.pubmed_id}/" target="_blank" style="color: #51cf66;">
                                        ${paper.pubmed_id}
                                    </a>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${paper.abstract ? `
                            <div class="detail-section">
                                <div class="detail-label">Abstract</div>
                                <div class="detail-value" style="line-height: 1.6; color: #cccccc;">
                                    ${paper.abstract}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
                bodyElement.innerHTML = content;
            }
            
            // Show with fade effect
            if (viewerElement) {
                viewerElement.style.display = 'block';
                viewerElement.style.opacity = '0';
                setTimeout(() => {
                    viewerElement.style.opacity = '1';
                    viewerElement.style.transition = 'opacity 0.2s ease';
                }, 10);
            }
        }
        
        function closePaperViewer() {
            const viewerElement = document.getElementById('paper-viewer');
            if (viewerElement) {
                viewerElement.style.opacity = '0';
                setTimeout(() => {
                    viewerElement.style.display = 'none';
                }, 200);
            }
        }

        // raw pdb functions
        function clearRawPdb() {
            $('#rawpdb-title').text('Raw PDB Data');
            $('#rawpdb-info').text('Load a structure to view formatted PDB data');
            $('#rawpdb-content').html('<div class="no-rawpdb"><div>No structure loaded</div><div style="margin-top: 5px; font-size: 10px;">Load a PDB structure to view formatted data</div></div>');
            rawPdbData = null;
        }

        function displayRawPdb(pdbData, pdbId = null) {
            rawPdbData = pdbData;
            const title = pdbId ? `Raw PDB Data - ${pdbId}` : 'Raw PDB Data - Uploaded File';
            $('#rawpdb-title').text(title);
            
            const lines = pdbData.split('\n').filter(line => line.trim());
            $('#rawpdb-info').text(`${lines.length} lines of PDB data`);
            
            // initialize fast grid for performance
            initializeFastPdbGrid(lines);
        }

        function getRecordClass(recordType) {
            switch(recordType) {
                case 'HEADER':
                case 'TITLE':
                case 'COMPND':
                case 'SOURCE':
                case 'KEYWDS':
                case 'EXPDTA':
                case 'AUTHOR':
                case 'REVDAT':
                case 'JRNL':
                case 'REMARK':
                    return 'record-header';
                case 'ATOM':
                    return 'record-atom';
                case 'HETATM':
                    return 'record-hetatm';
                case 'CONECT':
                    return 'record-conect';
                default:
                    return '';
            }
        }

        // fast grid implementation inspired by gabrielpetersson/fast-grid
        function initializeFastPdbGrid(lines) {
            const startTime = performance.now();
            
            // parse data
            fastGrid.data = lines.map((line, index) => ({
                lineNumber: index + 1,
                recordType: line.substring(0, 6).trim(),
                content: line.substring(6),
                originalLine: line
            }));
            
            fastGrid.filteredData = [...fastGrid.data];
            
            // get unique record types for filters
            const recordTypes = [...new Set(fastGrid.data.map(row => row.recordType))].filter(Boolean);
            
            // create grid html structure
            const gridHtml = `
                <div class="fast-grid-container">
                    <div class="pdb-filters">
                        <span style="font-size: 11px; color: #888;">Filter by record type:</span>
                        <select class="pdb-filter-dropdown" id="pdb-filter-select" onchange="fastGridFilter(this.value)">
                            <option value="all">All Records</option>
                            ${recordTypes.sort().map(type => `<option value="${type}">${type}</option>`).join('')}
                        </select>
                        <span style="font-size: 11px; color: #888; margin-left: 15px;">Zoom:</span>
                        <button class="zoom-btn" onclick="zoomPdbTable('out')" title="Zoom Out">ðŸ”âˆ’</button>
                        <button class="zoom-btn" onclick="zoomPdbTable('in')" title="Zoom In">ðŸ”+</button>
                        <span class="zoom-level" id="pdb-zoom-level">100%</span>
                    </div>
                    <div class="fast-grid-stats">
                        <span>Showing <span id="grid-visible-count">${fastGrid.filteredData.length}</span> of ${fastGrid.data.length} records</span>
                        <span class="fast-grid-performance" id="grid-performance">120 FPS</span>
                    </div>
                    <div class="fast-grid-header">
                        <div class="fast-grid-header-cell">Line</div>
                        <div class="fast-grid-header-cell">Record</div>
                        <div class="fast-grid-header-cell">Content</div>
                    </div>
                    <div class="fast-grid-viewport" id="fast-grid-viewport">
                        <div class="fast-grid-content" id="fast-grid-content"></div>
                    </div>
                </div>
            `;
            
            $('#rawpdb-content').html(gridHtml);
            
            // initialize grid components
            fastGrid.container = document.getElementById('fast-grid-content');
            fastGrid.viewport = document.getElementById('fast-grid-viewport');
            
            // setup scroll listener with throttling for performance
            let scrollTimeout;
            fastGrid.viewport.addEventListener('scroll', () => {
                if (scrollTimeout) clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(updateFastGridView, 0);
            });
            
            // initial render
            updateFastGridDimensions();
            updateFastGridView();
            
            const loadTime = (performance.now() - startTime).toFixed(1);
            $('#grid-performance').text(`Loaded in ${loadTime}ms`);
        }

        function updateFastGridDimensions() {
            fastGrid.containerHeight = fastGrid.viewport.clientHeight;
            fastGrid.visibleRowCount = Math.ceil(fastGrid.containerHeight / fastGrid.rowHeight) + fastGrid.buffer;
        }

        function updateFastGridView() {
            const scrollTop = fastGrid.viewport.scrollTop;
            const totalHeight = fastGrid.filteredData.length * fastGrid.rowHeight;
            
            // calculate visible range
            fastGrid.startIndex = Math.floor(scrollTop / fastGrid.rowHeight);
            fastGrid.endIndex = Math.min(
                fastGrid.startIndex + fastGrid.visibleRowCount,
                fastGrid.filteredData.length
            );
            
            // set container height to create proper scrollbar
            fastGrid.container.style.height = `${totalHeight}px`;
            
            // clear existing rows
            fastGrid.container.innerHTML = '';
            
            // render visible rows only
            for (let i = fastGrid.startIndex; i < fastGrid.endIndex; i++) {
                const row = fastGrid.filteredData[i];
                if (!row) continue;
                
                const rowElement = createFastGridRow(row, i);
                fastGrid.container.appendChild(rowElement);
            }
            
            // update performance indicator
            const fps = Math.min(120, 1000 / (performance.now() - (fastGrid.lastRender || performance.now())));
            $('#grid-performance').text(`${Math.round(fps)} FPS`);
            fastGrid.lastRender = performance.now();
        }

        function createFastGridRow(rowData, index) {
            const row = document.createElement('div');
            row.className = 'fast-grid-row';
            row.style.top = `${index * fastGrid.rowHeight}px`;
            
            const recordClass = getRecordClass(rowData.recordType);
            
            row.innerHTML = `
                <div class="fast-grid-cell">${rowData.lineNumber}</div>
                <div class="fast-grid-cell record-type ${recordClass}">${rowData.recordType}</div>
                <div class="fast-grid-cell">${rowData.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            `;
            
            return row;
        }

        function fastGridFilter(recordType) {
            const startTime = performance.now();
            
            // update dropdown selection
            const dropdown = document.getElementById('pdb-filter-select');
            if (dropdown && dropdown.value !== recordType) {
                dropdown.value = recordType;
            }
            
            // filter data
            if (recordType === 'all') {
                fastGrid.filteredData = [...fastGrid.data];
            } else {
                fastGrid.filteredData = fastGrid.data.filter(row => row.recordType === recordType);
            }
            
            fastGrid.currentFilter = recordType;
            
            // reset scroll position
            fastGrid.viewport.scrollTop = 0;
            
            // update view
            updateFastGridView();
            
            // update stats
            $('#grid-visible-count').text(fastGrid.filteredData.length);
            
            const filterTime = (performance.now() - startTime).toFixed(1);
            $('#grid-performance').text(`Filtered in ${filterTime}ms`);
        }

        function filterPdbRecords(recordType) {
            // legacy function - redirect to fast grid
            fastGridFilter(recordType);
        }

        // Atom table functions
        function parseAtomData(pdbData) {
            // Prevent duplicate parsing
            if (atomTable.isParsing) {
                console.log('parseAtomData called while already parsing, skipping...');
                return;
            }
            
            atomTable.isParsing = true;
            const lines = pdbData.split('\n');
            
            // Clear any existing atom data to prevent duplication
            atomTable.data = [];
            atomTable.filteredData = [];
            
            console.log(`Starting parseAtomData with ${lines.length} lines`);
            
            lines.forEach((line, index) => {
                // Skip empty lines
                if (!line.trim()) return;
                
                const recordType = line.substring(0, 6).trim();
                
                if (recordType === 'ATOM' || recordType === 'HETATM') {
                    try {
                        // Validate line length (PDB format requires at least 80 characters for ATOM/HETATM)
                        if (line.length < 30) {
                            console.warn(`Line ${index + 1} too short for ATOM/HETATM record: "${line}"`);
                            return;
                        }
                        
                        // Parse PDB ATOM/HETATM record format
                        const atomRecord = {
                            lineNumber: index + 1,
                            recordType: recordType,
                            serial: parseInt(line.substring(6, 11).trim()) || 0,
                            atomName: line.substring(12, 16).trim(),
                            altLoc: line.substring(16, 17).trim(),
                            resName: line.substring(17, 20).trim(),
                            chainId: line.substring(21, 22).trim(),
                            resSeq: parseInt(line.substring(22, 26).trim()) || 0,
                            iCode: line.substring(26, 27).trim(),
                            x: parseFloat(line.substring(30, 38).trim()) || 0.0,
                            y: parseFloat(line.substring(38, 46).trim()) || 0.0,
                            z: parseFloat(line.substring(46, 54).trim()) || 0.0,
                            occupancy: line.length >= 60 ? (parseFloat(line.substring(54, 60).trim()) || 1.0) : 1.0,
                            tempFactor: line.length >= 66 ? (parseFloat(line.substring(60, 66).trim()) || 0.0) : 0.0,
                            element: line.length >= 78 ? line.substring(76, 78).trim() : 
                                    line.substring(12, 14).trim().replace(/[0-9]/g, '').trim(),
                            charge: line.length >= 80 ? line.substring(78, 80).trim() : ''
                        };
                        
                        // Validate that we have meaningful data
                        if (atomRecord.atomName && atomRecord.resName) {
                            atomTable.data.push(atomRecord);
                        } else {
                            console.warn(`Invalid atom record at line ${index + 1}: missing atomName or resName`);
                        }
                    } catch (error) {
                        console.warn(`Error parsing atom record at line ${index + 1}:`, error);
                    }
                }
            });
            
            atomTable.filteredData = [...atomTable.data];
            
            // Count records by type
            const atomCount = atomTable.data.filter(a => a.recordType === 'ATOM').length;
            const hetatmCount = atomTable.data.filter(a => a.recordType === 'HETATM').length;
            
            console.log(`Parsed ${atomTable.data.length} total atom records: ${atomCount} ATOM, ${hetatmCount} HETATM`);
            
            // Update atoms tab with data
            const atomsTitle = document.getElementById('atoms-title');
            const atomsInfo = document.getElementById('atoms-info');
            const atomsContent = document.getElementById('atom-table-content');
            
            if (atomsTitle && atomTable.data.length > 0) {
                atomsTitle.textContent = `Atom Data - ${atomTable.data.length.toLocaleString()} atoms`;
            }
            
            if (atomsInfo && atomTable.data.length > 0) {
                atomsInfo.textContent = `${atomCount.toLocaleString()} ATOM records, ${hetatmCount.toLocaleString()} HETATM records`;
            }
            
            // Clear the "no data" message
            if (atomsContent && atomTable.data.length > 0) {
                atomsContent.innerHTML = '';
            }
            
            // Initialize the atom table and update stats after parsing
            if (atomTable.data.length > 0) {
                initializeAtomTable();
            }
            
            // Reset parsing flag
            atomTable.isParsing = false;
        }
        

        
        function initializeAtomTable() {
            const container = document.getElementById('atom-table-content');
            const viewport = document.getElementById('atom-table-viewport');
            
            if (!container || !viewport || atomTable.data.length === 0) return;
            
            atomTable.container = container;
            atomTable.viewport = viewport;
            
            // Clear any existing scroll listeners
            viewport.onscroll = null;
            
            // Ensure viewport has proper styling for scrolling
            viewport.style.overflow = 'auto';
            viewport.style.height = '100%';
            viewport.style.minHeight = '300px';
            
            // Set up scroll listener with throttling
            let isScrolling = false;
            const scrollHandler = () => {
                if (!isScrolling) {
                    requestAnimationFrame(() => {
                        updateAtomTableView();
                        isScrolling = false;
                    });
                    isScrolling = true;
                }
            };
            
            viewport.addEventListener('scroll', scrollHandler, { passive: true });
            
            // Store the handler for cleanup
            atomTable.scrollHandler = scrollHandler;
            
            // Initialize filter options
            populateAtomFilters();
            
            // Wait for layout to stabilize before initial render
            requestAnimationFrame(() => {
                updateAtomTableDimensions();
                updateAtomTableView();
                updateAtomStats();
            });
            
            console.log(`Initialized atom table with ${atomTable.data.length} atoms`);
        }
        
        function populateAtomFilters() {
            // Get unique chains
            const chains = [...new Set(atomTable.data.map(atom => atom.chainId))].filter(Boolean).sort();
            const chainSelect = document.getElementById('atom-chain-filter');
            if (chainSelect) {
                chainSelect.innerHTML = '<option value="all">All Chains</option>' +
                    chains.map(chain => `<option value="${chain}">Chain ${chain}</option>`).join('');
            }
            
            // Get unique elements
            const elements = [...new Set(atomTable.data.map(atom => atom.element))].filter(Boolean).sort();
            const elementSelect = document.getElementById('atom-element-filter');
            if (elementSelect) {
                elementSelect.innerHTML = '<option value="all">All Elements</option>' +
                    elements.map(element => `<option value="${element}">${element}</option>`).join('');
            }
        }
        
        function updateAtomTableDimensions() {
            if (!atomTable.viewport) return;
            
            // Force a layout recalculation
            atomTable.viewport.style.display = 'none';
            atomTable.viewport.offsetHeight; // Trigger reflow
            atomTable.viewport.style.display = '';
            
            atomTable.containerHeight = atomTable.viewport.clientHeight;
            
            console.log(`Atom table viewport dimensions: ${atomTable.viewport.clientWidth}x${atomTable.containerHeight}`);
            
            // If still no height, try to get from parent
            if (atomTable.containerHeight === 0) {
                const parent = atomTable.viewport.parentElement;
                if (parent) {
                    atomTable.containerHeight = parent.clientHeight - 100; // Account for header and controls
                    atomTable.viewport.style.height = `${atomTable.containerHeight}px`;
                }
            }
        }
        
        function updateAtomTableView() {
            if (!atomTable.viewport || !atomTable.container || atomTable.filteredData.length === 0) {
                console.log('Atom table view update skipped - missing elements or no data');
                return;
            }
            
            const scrollTop = atomTable.viewport.scrollTop;
            const viewportHeight = atomTable.viewport.clientHeight;
            const totalHeight = atomTable.filteredData.length * atomTable.rowHeight;
            
            // Ensure viewport has proper height
            if (viewportHeight === 0) {
                console.log('Viewport height is 0, deferring update');
                setTimeout(() => updateAtomTableView(), 50);
                return;
            }
            
            // Calculate visible range
            const visibleRows = Math.ceil(viewportHeight / atomTable.rowHeight);
            const startRow = Math.floor(scrollTop / atomTable.rowHeight);
            const endRow = Math.min(atomTable.filteredData.length - 1, startRow + visibleRows);
            
            // Add buffer
            atomTable.startIndex = Math.max(0, startRow - atomTable.buffer);
            atomTable.endIndex = Math.min(atomTable.filteredData.length, endRow + atomTable.buffer);
            
            // Set container height to create proper scrollable area
            atomTable.container.style.height = `${totalHeight}px`;
            atomTable.container.style.position = 'relative';
            atomTable.container.style.width = '100%';
            
            // Clear existing rows
            atomTable.container.innerHTML = '';
            
            // Create a document fragment for better performance
            const fragment = document.createDocumentFragment();
            
            // Render visible rows
            for (let i = atomTable.startIndex; i < atomTable.endIndex; i++) {
                const atom = atomTable.filteredData[i];
                if (!atom) continue;
                
                const rowElement = createAtomTableRow(atom, i);
                fragment.appendChild(rowElement);
            }
            
            atomTable.container.appendChild(fragment);
            
            // Debug info (only log occasionally to avoid spam)
            if (Math.random() < 0.1) {
                console.log(`Atom table: rows ${atomTable.startIndex}-${atomTable.endIndex} of ${atomTable.filteredData.length}, viewport: ${viewportHeight}px, scroll: ${scrollTop}px`);
            }
        }
        
        function createAtomTableRow(atom, index) {
            const row = document.createElement('div');
            row.className = `atom-table-row ${atom.recordType.toLowerCase()}-type`;
            row.style.top = `${index * atomTable.rowHeight}px`;
            
            // Format coordinates to 3 decimal places
            const x = atom.x.toFixed(3);
            const y = atom.y.toFixed(3);
            const z = atom.z.toFixed(3);
            
            row.innerHTML = `
                <div class="atom-table-cell atom-serial">${atom.serial}</div>
                <div class="atom-table-cell">${atom.recordType}</div>
                <div class="atom-table-cell atom-name">${atom.atomName}</div>
                <div class="atom-table-cell residue-name">${atom.resName}</div>
                <div class="atom-table-cell chain-id">${atom.chainId || '-'}</div>
                <div class="atom-table-cell">${atom.resSeq}</div>
                <div class="atom-table-cell coordinate">${x}</div>
                <div class="atom-table-cell coordinate">${y}</div>
                <div class="atom-table-cell coordinate">${z}</div>
                <div class="atom-table-cell factor">${atom.occupancy.toFixed(2)}</div>
                <div class="atom-table-cell factor">${atom.tempFactor.toFixed(2)}</div>
                <div class="atom-table-cell element">${atom.element}</div>
            `;
            
            return row;
        }
        
        function filterAtomTable() {
            const typeFilter = document.getElementById('atom-type-filter')?.value || 'all';
            const chainFilter = document.getElementById('atom-chain-filter')?.value || 'all';
            const elementFilter = document.getElementById('atom-element-filter')?.value || 'all';
            
            atomTable.currentTypeFilter = typeFilter;
            atomTable.currentChainFilter = chainFilter;
            atomTable.currentElementFilter = elementFilter;
            
            // Apply filters
            atomTable.filteredData = atomTable.data.filter(atom => {
                if (typeFilter !== 'all' && atom.recordType !== typeFilter) return false;
                if (chainFilter !== 'all' && atom.chainId !== chainFilter) return false;
                if (elementFilter !== 'all' && atom.element !== elementFilter) return false;
                return true;
            });
            
            console.log(`Filtered atoms: ${atomTable.filteredData.length} of ${atomTable.data.length}`);
            
            // Update stats immediately - before view update
            updateAtomStats();
            
            // Reset scroll position
            if (atomTable.viewport) {
                atomTable.viewport.scrollTop = 0;
            }
            
            // Update view
            updateAtomTableView();
        }
        
        function updateAtomStats() {
            const statsElement = document.getElementById('atom-stats');
            if (!statsElement) {
                console.warn('Stats element not found');
                return;
            }
            
            const totalAtoms = atomTable.data.length;
            const filteredAtoms = atomTable.filteredData.length;
            
            // Count filtered records by type for more accurate stats
            const filteredAtomCount = atomTable.filteredData.filter(a => a.recordType === 'ATOM').length;
            const filteredHetatmCount = atomTable.filteredData.filter(a => a.recordType === 'HETATM').length;
            
            let statsText;
            if (filteredAtoms !== totalAtoms) {
                statsText = `Showing ${filteredAtoms.toLocaleString()} of ${totalAtoms.toLocaleString()} atoms (${filteredAtomCount.toLocaleString()} ATOM, ${filteredHetatmCount.toLocaleString()} HETATM)`;
            } else {
                statsText = `${totalAtoms.toLocaleString()} atoms (${filteredAtomCount.toLocaleString()} ATOM, ${filteredHetatmCount.toLocaleString()} HETATM)`;
            }
            
            statsElement.textContent = statsText;
            console.log('Stats updated:', statsText);
        }
        
        // Debug function to check atom table state
        function debugAtomTable() {
            console.log('=== Atom Table Debug ===');
            console.log('Data length:', atomTable.data.length);
            console.log('Filtered data length:', atomTable.filteredData.length);
            console.log('Viewport element:', atomTable.viewport);
            console.log('Container element:', atomTable.container);
            
            if (atomTable.viewport) {
                console.log('Viewport height:', atomTable.viewport.clientHeight);
                console.log('Viewport scroll:', atomTable.viewport.scrollTop);
            }
            
            if (atomTable.container) {
                console.log('Container height:', atomTable.container.style.height);
                console.log('Container children:', atomTable.container.children.length);
            }
            
            console.log('Start index:', atomTable.startIndex);
            console.log('End index:', atomTable.endIndex);
            console.log('========================');
        }
        
        // Zoom functionality for tables
        let atomZoomLevel = 100;
        let pdbZoomLevel = 100;
        
        function zoomAtomTable(direction) {
            if (direction === 'in') {
                atomZoomLevel = Math.min(200, atomZoomLevel + 25);
            } else if (direction === 'out') {
                atomZoomLevel = Math.max(50, atomZoomLevel - 25);
            }
            
            const container = document.getElementById('atom-table-viewport');
            const header = document.querySelector('.atom-table-header');
            const levelDisplay = document.getElementById('atom-zoom-level');
            
            if (container) {
                container.style.transform = `scale(${atomZoomLevel / 100})`;
                container.style.transformOrigin = 'top left';
                // Force repaint to fix blurry text
                container.style.display = 'none';
                container.offsetHeight; // Trigger reflow
                container.style.display = '';
                console.log(`Atom table zoom: ${atomZoomLevel}%`);
            }
            
            if (header) {
                header.style.transform = `scale(${atomZoomLevel / 100})`;
                header.style.transformOrigin = 'top left';
                // Force repaint for header too
                header.style.display = 'none';
                header.offsetHeight; // Trigger reflow
                header.style.display = '';
            }
            
            if (levelDisplay) {
                levelDisplay.textContent = `${atomZoomLevel}%`;
            }
        }
        
        function zoomPdbTable(direction) {
            if (direction === 'in') {
                pdbZoomLevel = Math.min(200, pdbZoomLevel + 25);
            } else if (direction === 'out') {
                pdbZoomLevel = Math.max(50, pdbZoomLevel - 25);
            }
            
            const container = document.getElementById('fast-grid-viewport');
            const header = document.querySelector('.fast-grid-header');
            const levelDisplay = document.getElementById('pdb-zoom-level');
            
            if (container) {
                container.style.transform = `scale(${pdbZoomLevel / 100})`;
                container.style.transformOrigin = 'top left';
                // Force repaint to fix blurry text
                container.style.display = 'none';
                container.offsetHeight; // Trigger reflow
                container.style.display = '';
                console.log(`PDB table zoom: ${pdbZoomLevel}%`);
            }
            
            if (header) {
                header.style.transform = `scale(${pdbZoomLevel / 100})`;
                header.style.transformOrigin = 'top left';
                // Force repaint for header too
                header.style.display = 'none';
                header.offsetHeight; // Trigger reflow
                header.style.display = '';
            }
            
            if (levelDisplay) {
                levelDisplay.textContent = `${pdbZoomLevel}%`;
            }
        }
