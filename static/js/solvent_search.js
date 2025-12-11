/**
 * Solvent Search Module
 * Search for single solvents or solvent blends based on target HSP values
 */

// Min-Max Filter Editor for Tabulator (Vertical Layout)
function minMaxFilterEditor(cell, onRendered, success, cancel, editorParams) {
    const container = document.createElement("div");
    container.style.cssText = `
        display: flex !important;
        flex-direction: column !important;
        gap: 2px;
        width: 100%;
        min-height: 42px;
        height: auto;
    `;

    const minInput = document.createElement("input");
    minInput.setAttribute("type", "number");
    minInput.setAttribute("placeholder", "Min");
    minInput.style.cssText = `
        width: 100%;
        padding: 1px 2px;
        box-sizing: border-box;
        font-size: 0.65rem;
        height: 18px;
        margin: 0;
        display: block;
    `;

    const maxInput = document.createElement("input");
    maxInput.setAttribute("type", "number");
    maxInput.setAttribute("placeholder", "Max");
    maxInput.style.cssText = `
        width: 100%;
        padding: 1px 2px;
        box-sizing: border-box;
        font-size: 0.65rem;
        height: 18px;
        margin: 0;
        display: block;
    `;

    const buildValues = () => {
        return {
            start: minInput.value !== "" ? parseFloat(minInput.value) : null,
            end: maxInput.value !== "" ? parseFloat(maxInput.value) : null
        };
    };

    const update = () => {
        success(buildValues());
    };

    minInput.addEventListener("change", update);
    minInput.addEventListener("blur", update);
    maxInput.addEventListener("change", update);
    maxInput.addEventListener("blur", update);

    container.appendChild(minInput);
    container.appendChild(maxInput);

    return container;
}

// Min-Max Filter Function for Tabulator
function minMaxFilterFunction(headerValue, rowValue, rowData, filterParams) {
    if (!headerValue || (headerValue.start === null && headerValue.end === null)) {
        return true;
    }

    if (rowValue === null || rowValue === undefined || rowValue === 999) {
        return false;
    }

    if (headerValue.start !== null && headerValue.end !== null) {
        return rowValue >= headerValue.start && rowValue <= headerValue.end;
    }

    if (headerValue.start !== null) {
        return rowValue >= headerValue.start;
    }

    if (headerValue.end !== null) {
        return rowValue <= headerValue.end;
    }

    return true;
}

class SolventSearch {
    constructor() {
        this.searchResults = [];
        this.currentSort = 'distance';
        this.visualization = null;
        this.currentTarget1 = null;
        this.currentTarget2 = null;
        this.currentTarget3 = null;
        this.filteredResults = [];
        this.resultsTable = null; // Tabulator instance
        this.selectedSolvents = new Set(); // Track selected solvents for set creation
        this.searchScope = 'all'; // 'all' or 'set'
        this.selectedSetId = null; // Selected solvent set ID for filtering
        this.init();
    }

    async init() {
        // Initialize visualization module
        this.visualization = new HSPVisualization('search-plotly-visualization');
        this.visualization.showPlaceholder('Configure targets and search solvents to display visualization');

        // Load polymer data using shared cache
        await window.sharedPolymerCache.ensureLoaded();

        this.setupEventListeners();
        this.setupPanelToggle(); // Setup panel collapse/expand
        this.setupVisualizationToggle(); // Setup visualization panel collapse
        this.setupResultsToggle(); // Setup results panel collapse
        this.updateTargetContent('target1', 'polymer'); // Initialize with polymer mode
        this.updateTargetContent('target2', 'polymer'); // Initialize with polymer mode
        this.updateTargetContent('target3', 'polymer'); // Initialize with polymer mode
        console.log('Solvent Search initialized');

        // Initialize Tabulator
        this.initializeResultsTable();

        // Log computed CSS styles for debugging
        this.logLayoutStyles();

        // Auto-perform initial search if Target 1 has a value
        setTimeout(() => {
            this.performInitialSearch();
        }, 500);
    }

    async performInitialSearch() {
        // Always load all solvents on initial page load for browsing
        console.log('Loading all solvents for initial display');
        await this.loadAllSolventsInitial();
    }

    async loadAllSolventsInitial() {
        try {
            // Use shared solvent cache to get all solvents (includes CSV, User Solvents, and Saved Mixtures)
            await window.sharedSolventCache.ensureLoaded();
            const allNames = window.sharedSolventCache.getNames();

            // Build search results array from cache
            this.searchResults = allNames.map(name => {
                const solvent = window.sharedSolventCache.get(name);
                return {
                    name: solvent.name,
                    delta_d: solvent.delta_d,
                    delta_p: solvent.delta_p,
                    delta_h: solvent.delta_h,
                    source_url: solvent.source_url,
                    cas: solvent.cas,
                    boiling_point: solvent.boiling_point,
                    density: solvent.density,
                    molecular_weight: solvent.molecular_weight,
                    cost: solvent.cost,
                    cho: solvent.cho,
                    wgk: solvent.wgk,
                    ghs: solvent.ghs,
                    source: solvent.source
                };
            }).filter(s => s !== null);

            // Clear any previous filtering (show all solvents initially)
            this.currentFilteredResults = null;

            // Display in table (will sort by name since no target is set)
            this.populateResultsTable();
            this.updateResultsCount(this.searchResults.length);

            // Show selection controls
            this.showSelectionUI(this.searchResults.length > 0);

            // Generate visualization with all solvents (no targets initially)
            this.generateVisualization(null, null, this.searchResults, null);

            console.log(`[Solvent Search] Using shared cache with ${this.searchResults.length} solvents for initial display`);
        } catch (error) {
            console.error('[Solvent Search] Error loading initial solvents:', error);
        }
    }

    logLayoutStyles() {
        const solventSection = document.querySelector('#solvent-search');
        const layout = document.querySelector('#solvent-search .split-layout');

        if (layout) {
            const computedStyle = window.getComputedStyle(layout);
            console.log('=== Split Layout CSS Debug ===');
            console.log('grid-template-columns:', computedStyle.gridTemplateColumns);
            console.log('display:', computedStyle.display);
            console.log('width:', computedStyle.width);
            console.log('gap:', computedStyle.gap);
            console.log('padding:', computedStyle.padding);

            // Check if there are any inline styles
            console.log('Inline style:', layout.getAttribute('style'));

            // Log screen width to check media query
            console.log('Screen width:', window.innerWidth);
            console.log('===========================');
        } else {
            console.warn('Split layout element not found');
        }
    }


    setupEventListeners() {
        // Target toggle buttons (common for both Target 1 and Target 2)
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const source = e.target.dataset.source;
                const target = e.target.dataset.target;

                // Update active state
                const parentToggle = e.target.closest('.source-toggle');
                parentToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Update content
                this.updateTargetContent(target, source);
                this.validateSearchButton();
            });
        });

        // Search button
        const searchBtn = document.querySelector('#search-solvents-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }

        // Sort selector
        const sortSelect = document.querySelector('#sort-results');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.sortAndDisplayResults();
            });
        }

        // Visualization tabs (3D/2D/RED switching)
        const tab3D = document.querySelector('#search-tab-3d');
        const tab2D = document.querySelector('#search-tab-2d');
        const tabRED = document.querySelector('#search-tab-red');

        if (tab3D) {
            tab3D.addEventListener('click', () => this.switchVisualizationTab('3d'));
        }
        if (tab2D) {
            tab2D.addEventListener('click', () => this.switchVisualizationTab('2d'));
        }
        if (tabRED) {
            tabRED.addEventListener('click', () => this.switchVisualizationTab('red'));
        }

        // CSV Export button
        const exportCsvBtn = document.querySelector('#export-csv-btn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                if (this.resultsTable) {
                    this.resultsTable.download("csv", "solvent_results.csv");
                }
            });
        }

        // Copy Names button
        const copyNamesBtn = document.querySelector('#copy-names-btn');
        if (copyNamesBtn) {
            copyNamesBtn.addEventListener('click', () => {
                this.copySolventNames();
            });
        }

        // Export Search Package button
        const exportSearchPackageBtn = document.querySelector('#export-search-package-btn');
        if (exportSearchPackageBtn) {
            exportSearchPackageBtn.addEventListener('click', () => {
                this.exportSearchPackage();
            });
        }

        // Search scope dropdown (unified selector)
        const scopeSelector = document.getElementById('search-scope-selector');
        if (scopeSelector) {
            // Populate with solvent sets on init
            this.populateSolventSetSelector();

            scopeSelector.addEventListener('change', async (e) => {
                const value = e.target.value;
                if (value === 'all') {
                    this.searchScope = 'all';
                    this.selectedSetId = null;
                } else {
                    this.searchScope = 'set';
                    this.selectedSetId = value;
                }

                // Apply the filter and update display
                if (this.searchResults.length === 0) {
                    // Load all solvents first if not loaded yet
                    await this.loadAllSolventsInitial();
                } else {
                    // Filter and display
                    const filteredResults = this.filterBySet(this.searchResults);
                    this.currentFilteredResults = filteredResults;
                    this.populateResultsTable();
                    this.updateResultsCount(filteredResults.length);
                    this.showSelectionUI(filteredResults.length > 0);

                    // Update visualization
                    this.generateVisualization(
                        this.currentTarget1,
                        this.currentTarget2,
                        filteredResults,
                        this.currentTarget3
                    );
                }
            });
        }

        // Row selection is now handled by Tabulator's built-in checkbox column

        // Create New Set button
        const createNewSetBtn = document.getElementById('create-new-set-btn');
        if (createNewSetBtn) {
            createNewSetBtn.addEventListener('click', () => this.showCreateSetModal());
        }
    }

    switchVisualizationTab(tabName) {
        // Update tab states
        const tab3D = document.querySelector('#search-tab-3d');
        const tab2D = document.querySelector('#search-tab-2d');
        const tabRED = document.querySelector('#search-tab-red');
        const view3D = document.querySelector('#search-view-3d');
        const view2D = document.querySelector('#search-view-2d');
        const viewRED = document.querySelector('#search-view-red');

        // Remove all active states
        tab3D?.classList.remove('active');
        tab2D?.classList.remove('active');
        tabRED?.classList.remove('active');

        // Hide all views
        if (view3D) view3D.style.display = 'none';
        if (view2D) view2D.style.display = 'none';
        if (viewRED) viewRED.style.display = 'none';

        // Activate selected tab
        if (tabName === '3d') {
            tab3D?.classList.add('active');
            if (view3D) view3D.style.display = 'flex';
        } else if (tabName === '2d') {
            tab2D?.classList.add('active');
            if (view2D) view2D.style.display = 'flex';
        } else if (tabName === 'red') {
            tabRED?.classList.add('active');
            if (viewRED) viewRED.style.display = 'flex';
        }
    }

    updateTargetContent(targetId, dataSource) {
        const contentDiv = document.querySelector(`#${targetId}-content`);
        if (!contentDiv) return;

        switch (dataSource) {
            case 'custom':
                contentDiv.innerHTML = HSPSelectorUtils.generateCustomHTML({
                    idPrefix: targetId,
                    includeR0: true,
                    includeName: true
                });
                HSPSelectorUtils.attachCustomInputListeners(
                    targetId,
                    () => this.validateSearchButton()
                );
                break;

            case 'polymer':
                const allNames = window.sharedPolymerCache.getNames();
                contentDiv.innerHTML = HSPSelectorUtils.generateSelectorHTML({
                    inputId: `${targetId}-solute-input`,
                    datalistId: `${targetId}-solute-datalist`,
                    displayId: `${targetId}-hsp-display`,
                    placeholder: 'Type to search polymer...',
                    dataOptions: allNames,
                    includeR0: true,
                    displayIdPrefix: `${targetId}-display`
                });

                HSPSelectorUtils.attachDebouncedListener(
                    `${targetId}-solute-input`,
                    () => this.updateSoluteHSPDisplay(targetId),
                    {
                        debounceDelay: 500,
                        onInput: () => this.validateSearchButton()
                    }
                );
                break;
        }
    }

    validateSearchButton() {
        const searchBtn = document.querySelector('#search-solvents-btn');
        const target1Valid = this.isTargetValid('target1');
        const target2Valid = this.isTargetValid('target2');
        const target3Valid = this.isTargetValid('target3');

        // At least one target must be valid
        if (target1Valid || target2Valid || target3Valid) {
            searchBtn.disabled = false;
            searchBtn.title = 'Search for suitable solvents';
            // Reset button to blue (action needed state)
            searchBtn.classList.remove('btn-secondary');
            searchBtn.classList.add('btn-primary');
            searchBtn.textContent = 'Update Results';
        } else {
            searchBtn.disabled = true;
            searchBtn.title = 'Please configure at least one target';
        }
    }

    isTargetValid(targetId) {
        // Get active source from toggle buttons
        const activeBtn = document.querySelector(`#${targetId}-source-toggle .toggle-btn.active`);
        if (!activeBtn) return false;

        const dataSource = activeBtn.dataset.source;

        if (dataSource === 'custom') {
            const deltaD = document.querySelector(`#${targetId}-delta-d`)?.value;
            const deltaP = document.querySelector(`#${targetId}-delta-p`)?.value;
            const deltaH = document.querySelector(`#${targetId}-delta-h`)?.value;
            return deltaD && deltaP && deltaH;
        }

        if (dataSource === 'polymer') {
            const soluteInput = document.querySelector(`#${targetId}-solute-input`)?.value;
            return soluteInput && soluteInput.trim() !== '';
        }

        return false;
    }

    async getTargetData(targetId) {
        if (!this.isTargetValid(targetId)) {
            return null;
        }

        // Get active source from toggle buttons
        const activeBtn = document.querySelector(`#${targetId}-source-toggle .toggle-btn.active`);
        if (!activeBtn) return null;

        const dataSource = activeBtn.dataset.source;

        if (dataSource === 'custom') {
            return {
                name: document.querySelector(`#${targetId}-name`)?.value || 'Target',
                delta_d: parseFloat(document.querySelector(`#${targetId}-delta-d`).value),
                delta_p: parseFloat(document.querySelector(`#${targetId}-delta-p`).value),
                delta_h: parseFloat(document.querySelector(`#${targetId}-delta-h`).value),
                r0: parseFloat(document.querySelector(`#${targetId}-r0`)?.value) || 5.0
            };
        }

        if (dataSource === 'polymer') {
            const soluteName = document.querySelector(`#${targetId}-solute-input`).value.trim();
            if (!soluteName) return null;

            // First check experimental results
            const allResults = window.experimentalResultsManager ?
                window.experimentalResultsManager.getExperimentalResults() : [];
            const expResult = allResults.find(r => r.sample_name === soluteName);

            if (expResult) {
                return {
                    name: expResult.sample_name,
                    delta_d: expResult.hsp_result.delta_d,
                    delta_p: expResult.hsp_result.delta_p,
                    delta_h: expResult.hsp_result.delta_h,
                    r0: expResult.hsp_result.radius
                };
            }

            // If not found in experimental results, fetch from polymer API
            try {
                const response = await fetch(`/api/polymer-data/polymer/${encodeURIComponent(soluteName)}`);
                if (response.ok) {
                    const polymerData = await response.json();
                    return {
                        name: polymerData.polymer,
                        delta_d: polymerData.delta_d,
                        delta_p: polymerData.delta_p,
                        delta_h: polymerData.delta_h,
                        r0: polymerData.ra
                    };
                }
            } catch (error) {
                console.error('Error fetching polymer data:', error);
            }

            return null;
        }

        return null;
    }

    async updateSoluteHSPDisplay(targetId) {
        await HSPSelectorUtils.updateHSPDisplay({
            inputId: `${targetId}-solute-input`,
            displayId: `${targetId}-hsp-display`,
            mode: 'polymer',
            displayOptions: {
                includeR0: true,
                cellIdPrefix: `${targetId}-display`
            }
        });
    }

    async performSearch() {
        const searchBtn = document.querySelector('#search-solvents-btn');
        
        // Show loading state
        searchBtn.disabled = true;
        searchBtn.textContent = 'Updating...';
        
        try {
            // Get target data (now async)
            const target1Data = await this.getTargetData('target1');
            const target2Data = await this.getTargetData('target2');
            const target3Data = await this.getTargetData('target3');

            // Store targets for RED calculations in results table
            this.currentTarget1 = target1Data;
            this.currentTarget2 = target2Data;
            this.currentTarget3 = target3Data;

            // If no data loaded yet, load all solvents first
            if (this.searchResults.length === 0) {
                await this.loadAllSolventsInitial();
                return; // loadAllSolventsInitial will call populateResultsTable
            }

            // Filter by solvent set if selected
            const filteredResults = this.filterBySet(this.searchResults);

            // Store filtered results for table display
            this.currentFilteredResults = filteredResults;

            // Re-populate table with filtered results (will re-calculate distances and re-sort)
            this.populateResultsTable();
            this.updateResultsCount(filteredResults.length);

            // Show selection controls if we have results
            this.showSelectionUI(filteredResults.length > 0);

            // Always generate visualization (shows filtered solvents)
            this.generateVisualization(target1Data, target2Data, filteredResults, target3Data);

            // Generate RED Plot if both Target 1 and Target 2 are set
            const tabRED = document.querySelector('#search-tab-red');
            if (target1Data && target2Data) {
                this.generateREDPlot(target1Data, target2Data, filteredResults);
                if (tabRED) tabRED.style.display = 'inline-block';
            } else {
                if (tabRED) tabRED.style.display = 'none';
            }
        } finally {
            // Update button to show completion (gray, up-to-date)
            searchBtn.classList.remove('btn-primary');
            searchBtn.classList.add('btn-secondary');
            searchBtn.textContent = 'Up-to-Date';
            searchBtn.disabled = false;
        }
    }

    generateVisualization(target1Data, target2Data, solventResults, target3Data = null) {
        // Prepare target data with proper field names
        const target1 = target1Data ? {
            name: target1Data.name,
            delta_d: target1Data.delta_d,
            delta_p: target1Data.delta_p,
            delta_h: target1Data.delta_h,
            radius: target1Data.r0
        } : null;

        const target2 = target2Data ? {
            name: target2Data.name,
            delta_d: target2Data.delta_d,
            delta_p: target2Data.delta_p,
            delta_h: target2Data.delta_h,
            radius: target2Data.r0
        } : null;

        const target3 = target3Data ? {
            name: target3Data.name,
            delta_d: target3Data.delta_d,
            delta_p: target3Data.delta_p,
            delta_h: target3Data.delta_h,
            radius: target3Data.r0
        } : null;

        // Prepare solvent data (all results for visualization, up to API limit)
        const solventsToVisualize = solventResults.map(s => ({
            name: s.name,
            delta_d: s.delta_d,
            delta_p: s.delta_p,
            delta_h: s.delta_h
        }));

        // Generate visualization - show all solvents even when no targets are set
        if (target1 && !target2 && !target3) {
            // Single target visualization
            this.visualization.generateDualTargetVisualization(target1, null, solventsToVisualize, null);
        } else if (target1 && target2 && !target3) {
            // Dual target visualization
            this.visualization.generateDualTargetVisualization(target1, target2, solventsToVisualize, null);
        } else if (target1 && !target2 && target3) {
            // Target 1 and 3
            this.visualization.generateDualTargetVisualization(target1, target3, solventsToVisualize, null);
        } else if (!target1 && target2 && target3) {
            // Target 2 and 3
            this.visualization.generateDualTargetVisualization(target2, target3, solventsToVisualize, null);
        } else if (target1 && target2 && target3) {
            // All three targets
            this.visualization.generateDualTargetVisualization(target1, target2, solventsToVisualize, target3);
        } else if (target2 && !target3) {
            // Only target2 is set
            this.visualization.generateDualTargetVisualization(target2, null, solventsToVisualize, null);
        } else if (target3) {
            // Only target3 is set
            this.visualization.generateDualTargetVisualization(target3, null, solventsToVisualize, null);
        } else {
            // No targets set - show all solvents in Hansen space
            this.visualization.generateDualTargetVisualization(null, null, solventsToVisualize, null);
        }
    }

    generateREDPlot(target1Data, target2Data, solventResults) {
        const containerId = 'search-plot-red-scatter';
        const element = document.getElementById(containerId);

        if (!element) {
            console.warn(`Container #${containerId} not found`);
            return;
        }

        // RED Plot requires both targets
        if (!target1Data || !target2Data) {
            element.innerHTML = '<div class="visualization-placeholder"><p>RED Plot requires both Target 1 and Target 2</p></div>';
            return;
        }

        // Prepare data
        const redX = [];
        const redY = [];
        const solventNames = [];
        const hoverTexts = [];
        const colors = [];

        solventResults.forEach(s => {
            const red1 = this.calculateRED(s, target1Data);
            const red2 = this.calculateRED(s, target2Data);

            if (red1 !== null && red2 !== null) {
                redX.push(red1);
                redY.push(red2);
                solventNames.push(s.name);

                // Determine solubility status
                let status = '';
                let color = '';
                if (red1 < 1.0 && red2 < 1.0) {
                    status = 'Both dissolve';
                    color = '#4CAF50'; // Material Green (both targets)
                } else if (red1 < 1.0) {
                    status = 'Target 1 only';
                    color = '#2196F3'; // Material Blue (matches Target 1 sphere)
                } else if (red2 < 1.0) {
                    status = 'Target 2 only';
                    color = '#FF9800'; // Material Orange (matches Target 2 sphere)
                } else {
                    status = 'Neither dissolve';
                    color = '#BDBDBD'; // Material Grey (neither target)
                }

                hoverTexts.push(
                    `<b>${s.name}</b><br>` +
                    `${target1Data.name} RED: ${red1.toFixed(2)}<br>` +
                    `${target2Data.name} RED: ${red2.toFixed(2)}<br>` +
                    `Status: ${status}`
                );
                colors.push(color);
            }
        });

        // Calculate axis range based on data
        const maxX = redX.length > 0 ? Math.max(...redX) : 1.5;
        const maxY = redY.length > 0 ? Math.max(...redY) : 1.5;
        const maxRED = Math.max(maxX, maxY, 1.5);
        const upperLimit = maxRED * 1.1; // Add 10% margin

        // Create traces
        const traces = [
            {
                type: 'scatter',
                mode: 'markers',
                x: redX,
                y: redY,
                marker: {
                    size: 6,
                    color: colors,
                    opacity: 0.7,
                    line: {
                        width: 1,
                        color: 'rgba(0,0,0,0.3)'
                    }
                },
                text: solventNames,
                hovertext: hoverTexts,
                hovertemplate: '%{hovertext}<extra></extra>',
                showlegend: false
            }
        ];

        // Layout with reference lines and quadrant shading
        const layout = {
            shapes: [
                // Vertical line at RED = 1.0
                {
                    type: 'line',
                    x0: 1.0,
                    y0: 0,
                    x1: 1.0,
                    y1: upperLimit,
                    line: {
                        color: '#ef4444',
                        width: 2,
                        dash: 'dash'
                    }
                },
                // Horizontal line at RED = 1.0
                {
                    type: 'line',
                    x0: 0,
                    y0: 1.0,
                    x1: upperLimit,
                    y1: 1.0,
                    line: {
                        color: '#ef4444',
                        width: 2,
                        dash: 'dash'
                    }
                },
                // Green shaded area (both dissolve)
                {
                    type: 'rect',
                    x0: 0,
                    y0: 0,
                    x1: 1.0,
                    y1: 1.0,
                    fillcolor: 'rgba(16, 185, 129, 0.1)',
                    line: {
                        width: 0
                    },
                    layer: 'below'
                }
            ],
            xaxis: {
                title: `${target1Data.name} RED`,
                range: [0, upperLimit],
                showgrid: true,
                zeroline: true
            },
            yaxis: {
                title: `${target2Data.name} RED`,
                range: [0, upperLimit],
                showgrid: true,
                zeroline: true
            },
            hovermode: 'closest',
            margin: {l: 60, r: 30, t: 30, b: 60}
        };

        // Render plot
        Plotly.newPlot(containerId, traces, layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false
        });
    }

    async searchSingleSolvents(deltaD, deltaP, deltaH, radius) {
        const params = new URLSearchParams({
            target_delta_d: deltaD,
            target_delta_p: deltaP,
            target_delta_h: deltaH,
            max_results: 10000  // Request up to 10000 results for visualization
        });

        if (radius) params.append('target_radius', radius);

        const response = await fetch(`/api/solvent-search/search?${params}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Search request failed');
        }

        return await response.json();
    }

    async searchBlendSolvents(deltaD, deltaP, deltaH, radius) {
        const params = new URLSearchParams({
            target_delta_d: deltaD,
            target_delta_p: deltaP,
            target_delta_h: deltaH,
        });

        if (radius) params.append('target_radius', radius);

        const response = await fetch(`/api/solvent-search/blend-search?${params}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Blend search request failed');
        }

        return await response.json();
    }

    sortAndDisplayResults() {
        const searchMode = document.querySelector('input[name="search-mode"]:checked').value;

        // Sort results
        this.searchResults.sort((a, b) => {
            switch (this.currentSort) {
                case 'distance':
                    return a.distance - b.distance;
                case 'name':
                    const nameA = searchMode === 'single' ? a.name : a.solvent1.name;
                    const nameB = searchMode === 'single' ? b.name : b.solvent1.name;
                    return nameA.localeCompare(nameB);
                case 'bp':
                    if (searchMode === 'single') {
                        return (a.boiling_point || 999) - (b.boiling_point || 999);
                    }
                    return 0; // Blend mode doesn't have BP
                default:
                    return 0;
            }
        });

        this.displayResults(searchMode);
    }

    displayResults(searchMode) {
        // Results are now displayed in the right panel table via populateResultsTable()
        // This method is kept for compatibility but does nothing
        return;
    }

    createSolventCardHTML(solvent) {
        const redColor = this.getREDColor(solvent.red);

        return `
            <div class="solvent-result-card">
                <div class="result-card-header">
                    <h4>${this.escapeHtml(solvent.name)}</h4>
                    <span class="red-badge" style="background-color: ${redColor}">RED: ${solvent.red.toFixed(3)}</span>
                </div>
                <div class="result-card-content">
                    <div class="hsp-values">
                        <span>δD: ${solvent.delta_d.toFixed(1)}</span>
                        <span>δP: ${solvent.delta_p.toFixed(1)}</span>
                        <span>δH: ${solvent.delta_h.toFixed(1)}</span>
                    </div>
                    <div class="solvent-properties">
                        ${solvent.boiling_point ? `<span>BP: ${solvent.boiling_point.toFixed(1)}°C</span>` : ''}
                        ${solvent.density ? `<span>ρ: ${solvent.density.toFixed(3)} g/cm³</span>` : ''}
                    </div>
                    ${solvent.cas ? `<div class="solvent-cas">CAS: ${solvent.cas}</div>` : ''}
                </div>
            </div>
        `;
    }

    createBlendCardHTML(blend) {
        const redColor = this.getREDColor(blend.red);
        const ratio1 = Math.round(blend.ratio * 100);
        const ratio2 = 100 - ratio1;

        return `
            <div class="blend-result-card">
                <div class="result-card-header">
                    <h4>Blend: ${ratio1}:${ratio2}</h4>
                    <span class="red-badge" style="background-color: ${redColor}">RED: ${blend.red.toFixed(3)}</span>
                </div>
                <div class="result-card-content">
                    <div class="blend-components">
                        <div class="component">
                            <strong>${this.escapeHtml(blend.solvent1.name)}</strong> (${ratio1}%)
                            <div class="hsp-mini">
                                δD: ${blend.solvent1.delta_d.toFixed(1)},
                                δP: ${blend.solvent1.delta_p.toFixed(1)},
                                δH: ${blend.solvent1.delta_h.toFixed(1)}
                            </div>
                        </div>
                        <div class="component">
                            <strong>${this.escapeHtml(blend.solvent2.name)}</strong> (${ratio2}%)
                            <div class="hsp-mini">
                                δD: ${blend.solvent2.delta_d.toFixed(1)},
                                δP: ${blend.solvent2.delta_p.toFixed(1)},
                                δH: ${blend.solvent2.delta_h.toFixed(1)}
                            </div>
                        </div>
                    </div>
                    <div class="blend-result-hsp">
                        <strong>Blend HSP:</strong>
                        δD: ${blend.blend_hsp.delta_d.toFixed(1)},
                        δP: ${blend.blend_hsp.delta_p.toFixed(1)},
                        δH: ${blend.blend_hsp.delta_h.toFixed(1)}
                    </div>
                </div>
            </div>
        `;
    }

    getREDColor(red) {
        if (red < 0.8) return '#10b981'; // Green - good
        if (red < 1.2) return '#f59e0b'; // Orange - partial
        return '#ef4444'; // Red - poor
    }

    updateResultsCount(count) {
        const countDisplay = document.querySelector('#results-count-display');
        if (!countDisplay) return;

        // Count by type
        const counts = {
            database: 0,
            user: 0,
            mixture: 0
        };

        if (this.searchResults) {
            this.searchResults.forEach(r => {
                if (r.source_file === 'user_added') {
                    counts.user++;
                } else if (r.source_file === 'saved_mixture') {
                    counts.mixture++;
                } else {
                    counts.database++;
                }
            });
        }

        // Build enhanced display
        let html = `
            <div class="results-count-container">
                <div class="results-count-main">
                    <span class="count-number">${count}</span>
                    <span class="count-label">solvent${count !== 1 ? 's' : ''} found</span>
                </div>`;

        // Show breakdown if there are multiple types
        if ((counts.database > 0 ? 1 : 0) + (counts.user > 0 ? 1 : 0) + (counts.mixture > 0 ? 1 : 0) > 1) {
            html += `
                <div class="results-breakdown">`;

            if (counts.database > 0) {
                html += `<span class="breakdown-badge badge-database" title="Database solvents">${counts.database} DB</span>`;
            }
            if (counts.user > 0) {
                html += `<span class="breakdown-badge badge-user" title="User-added solvents">👤 ${counts.user}</span>`;
            }
            if (counts.mixture > 0) {
                html += `<span class="breakdown-badge badge-mixture" title="Saved mixtures">${counts.mixture} Mix</span>`;
            }

            html += `
                </div>`;
        }

        html += `
            </div>`;

        countDisplay.innerHTML = html;
    }

    showError(message) {
        // Show error in right panel table
        const tbody = document.querySelector('#solvent-results-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-cell" style="color: #ef4444;">❌ ${message}</td>
                </tr>
            `;
        }
        this.updateResultsCountBadge(0);
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    /**
     * Get saved mixtures from localStorage and convert to search results format
     */
    getSavedMixturesAsResults(targetD, targetP, targetH, targetRadius) {
        try {
            const STORAGE_KEY = 'mixingcompass_saved_mixtures';
            const mixtures = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

            return mixtures.map(mixture => {
                const distance = Math.sqrt(
                    4 * Math.pow(mixture.hsp.delta_d - targetD, 2) +
                    Math.pow(mixture.hsp.delta_p - targetP, 2) +
                    Math.pow(mixture.hsp.delta_h - targetH, 2)
                );

                const red = targetRadius ? distance / targetRadius : distance;

                return {
                    name: `[Mixture] ${mixture.name}`,
                    delta_d: mixture.hsp.delta_d,
                    delta_p: mixture.hsp.delta_p,
                    delta_h: mixture.hsp.delta_h,
                    distance: red,
                    red: red,
                    source_file: 'saved_mixture',
                    cho: null,
                    boiling_point: null,
                    density: null,
                    molecular_weight: null,
                    cost: null,
                    cas: null,
                    wgk: null,
                    ghs: null,
                    source_url: null
                };
            });
        } catch (error) {
            console.warn('Could not load saved mixtures:', error);
            return [];
        }
    }

    getUserSolventsAsResults(targetD, targetP, targetH, targetRadius) {
        try {
            if (!window.userSolventsManager) {
                return [];
            }

            const userSolvents = window.userSolventsManager.getUserSolvents();

            return userSolvents.map(solvent => {
                const distance = Math.sqrt(
                    4 * Math.pow(solvent.delta_d - targetD, 2) +
                    Math.pow(solvent.delta_p - targetP, 2) +
                    Math.pow(solvent.delta_h - targetH, 2)
                );

                const red = targetRadius ? distance / targetRadius : distance;

                return {
                    name: solvent.name,
                    delta_d: solvent.delta_d,
                    delta_p: solvent.delta_p,
                    delta_h: solvent.delta_h,
                    distance: red,
                    red: red,
                    source_file: 'user_added',
                    cho: solvent.cho || null,
                    boiling_point: solvent.boiling_point || null,
                    density: solvent.density || null,
                    molecular_weight: solvent.molecular_weight || null,
                    cost: solvent.cost || null,
                    cas: solvent.cas || null,
                    wgk: solvent.wgk || null,
                    ghs: solvent.ghs || null,
                    source_url: solvent.source_url || null
                };
            });
        } catch (error) {
            console.warn('Could not load user-added solvents:', error);
            return [];
        }
    }

    /**
     * Calculate RED (Relative Energy Difference) between a solvent and target
     * RED = distance / R0
     */
    calculateDistance(solvent, target) {
        if (!target) return null;

        return Math.sqrt(
            4 * Math.pow(solvent.delta_d - target.delta_d, 2) +
            Math.pow(solvent.delta_p - target.delta_p, 2) +
            Math.pow(solvent.delta_h - target.delta_h, 2)
        );
    }

    calculateRED(solvent, target) {
        if (!target) return null;
        const distance = this.calculateDistance(solvent, target);
        return distance / target.r0;
    }

    /**
     * Get CSS class for RED value based on solubility
     */
    getREDClass(red) {
        if (red === null) return '';
        if (red < 0.8) return 'red-good';
        if (red < 1.2) return 'red-partial';
        return 'red-poor';
    }

    /**
     * Initialize Tabulator for results table
     */
    initializeResultsTable() {
        const container = document.querySelector('#solvent-results-table');
        if (!container) {
            console.error('Tabulator container not found');
            return;
        }

        // Tabulator configuration
        this.resultsTable = new Tabulator(container, {
            data: [],
            layout: "fitDataStretch",  // Better column width distribution
            height: "100%",
            placeholder: "Search solvents to see results",

            columns: [
                {
                    title: "",
                    field: "selected",
                    formatter: "rowSelection",
                    titleFormatter: "rowSelection",
                    hozAlign: "center",
                    headerSort: false,
                    width: 30,
                    cellClick: (e, cell) => {
                        cell.getRow().toggleSelect();
                    }
                },
                {
                    title: "Solvent<br>Name",
                    field: "name",
                    sorter: "string",
                    headerFilter: "input",
                    headerFilterPlaceholder: "Filter...",
                    minWidth: 200,  // Increased minimum width for names
                    widthGrow: 3,   // Grow more than other columns
                    formatter: (cell) => {
                        const data = cell.getRow().getData();
                        const sourceUrl = data.source_url;
                        const sourceFile = data.source_file;
                        const name = cell.getValue();
                        const cas = data.cas;

                        // Build Google search query
                        const searchQuery = cas
                            ? `${name} CAS ${cas}`
                            : name;
                        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

                        // Add visual marker for user-added solvents
                        let nameDisplay = name;
                        let nameStyle = '';

                        if (sourceFile === 'user_added') {
                            nameDisplay = `<span style="font-size: 14px;" title="User Solvent">👤</span> ${name}`;
                            nameStyle = 'color: #2196F3; font-weight: 500;';
                        } else if (sourceFile === 'saved_mixture') {
                            nameStyle = 'color: #FF9800;';
                        }

                        let html = `
                            <span style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; ${nameStyle}">${nameDisplay}</span>
                                <span style="display: flex; gap: 4px;">`;

                        // Data source link
                        if (sourceUrl) {
                            html += `<a href="${sourceUrl}"
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       title="View original data source"
                                       class="source-link-icon"
                                       onclick="event.stopPropagation()">🔗</a>`;
                        }

                        // Google search link (always show)
                        html += `<a href="${googleUrl}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   title="Search on Google"
                                   class="google-search-icon"
                                   onclick="event.stopPropagation()">🔍</a>`;

                        html += `</span></span>`;
                        return html;
                    }
                },
                {
                    title: "Target 1<br>RED",
                    field: "red1_value",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === null || value === 999) return '—';
                        const redClass = this.getREDClass(value);
                        return `<span class="${redClass}">${value.toFixed(2)}</span>`;
                    },
                    headerTooltip: "Target 1: Relative Energy Difference",
                    width: 90,
                    widthGrow: 1.5,  // Grow slightly
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "Target 2<br>RED",
                    field: "red2_value",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === null || value === 999) return '—';
                        const redClass = this.getREDClass(value);
                        return `<span class="${redClass}">${value.toFixed(2)}</span>`;
                    },
                    headerTooltip: "Target 2: Relative Energy Difference",
                    width: 90,
                    widthGrow: 1.5,  // Grow slightly
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "Target 3<br>RED",
                    field: "red3_value",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === null || value === 999) return '—';
                        const redClass = this.getREDClass(value);
                        return `<span class="${redClass}">${value.toFixed(2)}</span>`;
                    },
                    headerTooltip: "Target 3: Relative Energy Difference",
                    width: 90,
                    widthGrow: 1.5,  // Grow slightly
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "δD<br>(MPa<sup>0.5</sup>)",
                    field: "delta_d",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const val = cell.getValue();
                        return (val !== null && val !== undefined) ? val.toFixed(1) : '—';
                    },
                    headerTooltip: "Dispersion parameter (δD) in MPa^0.5",
                    width: 90,
                    minWidth: 90,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "δP<br>(MPa<sup>0.5</sup>)",
                    field: "delta_p",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const val = cell.getValue();
                        return (val !== null && val !== undefined) ? val.toFixed(1) : '—';
                    },
                    headerTooltip: "Polar parameter (δP) in MPa^0.5",
                    width: 90,
                    minWidth: 90,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "δH<br>(MPa<sup>0.5</sup>)",
                    field: "delta_h",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const val = cell.getValue();
                        return (val !== null && val !== undefined) ? val.toFixed(1) : '—';
                    },
                    headerTooltip: "Hydrogen bonding parameter (δH) in MPa^0.5",
                    width: 90,
                    minWidth: 90,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "C,H,O<br>Only",
                    field: "cho",
                    sorter: "boolean",
                    headerFilter: "tickCross",
                    headerFilterParams: {"tristate": true},
                    headerFilterEmptyCheck: (value) => value === null,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === true) {
                            return '<span class="cho-yes" title="Contains only C, H, O elements">✔</span>';
                        } else if (value === false) {
                            return '<span class="cho-no" title="Contains other elements">✘</span>';
                        }
                        return '—';
                    },
                    headerTooltip: "Contains only C, H, O elements",
                    width: 68,
                    hozAlign: "center",
                    headerHozAlign: "center"
                },
                {
                    title: "Tb<br>(°C)",
                    field: "boiling_point",
                    sorter: "number",
                    headerFilter: minMaxFilterEditor,
                    headerFilterFunc: minMaxFilterFunction,
                    headerFilterLiveFilter: false,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (value === null || value === undefined) {
                            return '—';
                        }
                        return value.toFixed(1);
                    },
                    headerTooltip: "Boiling point (Tb) in °C",
                    width: 70,
                    hozAlign: "center",
                    headerHozAlign: "center"
                }
            ],

            initialSort: [
                {column: "red1_value", dir: "asc"}
            ],

            // Row formatter for color-coding based on solubility
            rowFormatter: (row) => {
                const data = row.getData();
                const red1 = data.red1_value;
                const red2 = data.red2_value;

                // Only color-code when Target 2 is set
                if (red2 !== null && red2 !== 999) {
                    const element = row.getElement();

                    if (red1 < 1.0 && red2 < 1.0) {
                        // Both dissolve - Green
                        element.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
                    } else if (red1 < 1.0 && red2 >= 1.0) {
                        // Target 1 only - Blue
                        element.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
                    } else if (red1 >= 1.0 && red2 < 1.0) {
                        // Target 2 only - Orange
                        element.style.backgroundColor = "rgba(245, 158, 11, 0.1)";
                    } else {
                        // Neither dissolve - Light gray
                        element.style.backgroundColor = "rgba(156, 163, 175, 0.05)";
                    }
                } else {
                    // No color coding when Target 2 is not set
                    row.getElement().style.backgroundColor = "";
                }
            }
        });

        // Add dataFiltered event handler with debounce for visualization update
        let vizUpdateTimeout;
        this.resultsTable.on("dataFiltered", (filters, rows) => {
            // Update count badge with filtered count
            this.updateResultsCountBadge(rows.length);

            // Debounce visualization update (300ms delay)
            clearTimeout(vizUpdateTimeout);
            vizUpdateTimeout = setTimeout(() => {
                // Get filtered data from rows
                const filteredData = rows.map(row => {
                    const data = row.getData();
                    return {
                        name: data.name,
                        delta_d: data.delta_d,
                        delta_p: data.delta_p,
                        delta_h: data.delta_h
                    };
                });

                // Update visualization with filtered data
                this.generateVisualization(this.currentTarget1, this.currentTarget2, filteredData, this.currentTarget3);

                // Update RED Plot with filtered data if both targets are set
                if (this.currentTarget1 && this.currentTarget2) {
                    this.generateREDPlot(this.currentTarget1, this.currentTarget2, filteredData);
                }
            }, 300);
        });

        // Wait for table to be built before hiding columns
        this.resultsTable.on("tableBuilt", () => {
            // Initially hide Target 2 and Target 3 RED columns (will be shown when targets are set)
            this.resultsTable.hideColumn("red2_value");
            this.resultsTable.hideColumn("red3_value");
        });

        // Row selection changed event
        this.resultsTable.on("rowSelectionChanged", (data, rows) => {
            this.selectedSolvents = new Set(data.map(d => d.name));
            this.updateSelectionUI();
        });
    }

    /**
     * Populate the results table with solvent data (Tabulator version)
     */
    populateResultsTable() {
        if (!this.resultsTable) {
            console.error('Tabulator not initialized');
            return;
        }

        // Use filtered results if available, otherwise use all results
        const dataToDisplay = this.currentFilteredResults || this.searchResults;

        if (dataToDisplay.length === 0) {
            this.resultsTable.setData([]);
            this.updateResultsCountBadge(0);
            // Hide export and copy buttons
            const exportBtn = document.querySelector('#export-csv-btn');
            if (exportBtn) exportBtn.style.display = 'none';
            const copyNamesBtn = document.querySelector('#copy-names-btn');
            if (copyNamesBtn) copyNamesBtn.style.display = 'none';
            const exportPackageBtn = document.querySelector('#export-search-package-btn');
            if (exportPackageBtn) exportPackageBtn.style.display = 'none';
            return;
        }

        // Check if any target is set
        const hasTarget1 = this.currentTarget1 && this.currentTarget1.delta_d !== undefined;
        const hasTarget2 = this.currentTarget2 && this.currentTarget2.delta_d !== undefined;
        const hasTarget3 = this.currentTarget3 && this.currentTarget3.delta_d !== undefined;

        // Prepare data for Tabulator
        const tableData = dataToDisplay.map(solvent => {
            // Calculate distances only if targets are set
            const ra1 = hasTarget1 ? this.calculateDistance(solvent, this.currentTarget1) : null;
            const red1 = hasTarget1 ? this.calculateRED(solvent, this.currentTarget1) : null;
            const ra2 = hasTarget2 ? this.calculateDistance(solvent, this.currentTarget2) : null;
            const red2 = hasTarget2 ? this.calculateRED(solvent, this.currentTarget2) : null;
            const ra3 = hasTarget3 ? this.calculateDistance(solvent, this.currentTarget3) : null;
            const red3 = hasTarget3 ? this.calculateRED(solvent, this.currentTarget3) : null;

            return {
                name: solvent.name,
                cas: solvent.cas || '',
                ra1_value: ra1 !== null ? ra1 : 999,
                red1_value: red1 !== null ? red1 : 999,
                ra2_value: ra2 !== null ? ra2 : 999,
                red2_value: red2 !== null ? red2 : 999,
                ra3_value: ra3 !== null ? ra3 : 999,
                red3_value: red3 !== null ? red3 : 999,
                delta_d: solvent.delta_d,
                delta_p: solvent.delta_p,
                delta_h: solvent.delta_h,
                cho: solvent.cho,
                boiling_point: solvent.boiling_point,
                source_url: solvent.source_url || '',
                source_file: solvent.source_file || ''
            };
        });

        // Sort: by distance if target is set, by name otherwise
        if (hasTarget1) {
            tableData.sort((a, b) => a.ra1_value - b.ra1_value);
        } else {
            tableData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        // Update table
        this.resultsTable.setData(tableData);
        this.updateResultsCountBadge(dataToDisplay.length);

        // Show/hide RED columns based on whether targets are set
        if (this.currentTarget1 && this.currentTarget1.delta_d !== undefined) {
            this.resultsTable.showColumn("red1_value");
        } else {
            this.resultsTable.hideColumn("red1_value");
        }

        if (this.currentTarget2 && this.currentTarget2.delta_d !== undefined) {
            this.resultsTable.showColumn("red2_value");
        } else {
            this.resultsTable.hideColumn("red2_value");
        }

        if (this.currentTarget3 && this.currentTarget3.delta_d !== undefined) {
            this.resultsTable.showColumn("red3_value");
        } else {
            this.resultsTable.hideColumn("red3_value");
        }

        // Show export and copy buttons
        const exportBtn = document.querySelector('#export-csv-btn');
        if (exportBtn) exportBtn.style.display = 'inline-block';
        const copyNamesBtn = document.querySelector('#copy-names-btn');
        if (copyNamesBtn) copyNamesBtn.style.display = 'inline-block';
        const exportPackageBtn = document.querySelector('#export-search-package-btn');
        if (exportPackageBtn) exportPackageBtn.style.display = 'inline-block';
    }

    /**
     * Update the results count badge
     */
    updateResultsCountBadge(count) {
        // Use the enhanced results count display
        this.updateResultsCount(count);
    }

    setupPanelToggle() {
        const splitLayout = document.querySelector('#solvent-search .split-layout');
        const collapseBtn = document.getElementById('panel-collapse-btn');
        const boundaryBtn = document.getElementById('panel-boundary-btn');
        const expandBtn = document.getElementById('panel-expand-btn');

        if (!splitLayout || !collapseBtn || !boundaryBtn || !expandBtn) {
            console.warn('Panel toggle elements not found');
            return;
        }

        // Toggle function
        const togglePanel = () => {
            const isCollapsed = splitLayout.classList.contains('collapsed');

            if (isCollapsed) {
                // Expand
                splitLayout.classList.remove('collapsed');
                expandBtn.style.display = 'none';
                boundaryBtn.style.display = 'block';
                boundaryBtn.innerHTML = '◀';
            } else {
                // Collapse
                splitLayout.classList.add('collapsed');
                expandBtn.style.display = 'block';
                boundaryBtn.style.display = 'none';
            }
        };

        // Event listeners
        collapseBtn.addEventListener('click', togglePanel);
        boundaryBtn.addEventListener('click', togglePanel);
        expandBtn.addEventListener('click', togglePanel);

        console.log('Panel toggle setup complete');
    }

    setupVisualizationToggle() {
        const vizPanel = document.getElementById('visualization-panel');
        const vizCollapseBtn = document.getElementById('viz-collapse-btn');
        const vizExpandBtn = document.getElementById('viz-expand-btn');
        const searchResultsSplit = document.querySelector('#solvent-search .search-results-split');

        if (!vizPanel || !vizCollapseBtn || !vizExpandBtn) {
            console.warn('Visualization toggle elements not found');
            return;
        }

        // Toggle function
        const toggleVisualization = (forceState = null) => {
            const shouldCollapse = forceState !== null ? forceState : !vizPanel.classList.contains('collapsed');

            if (shouldCollapse) {
                vizPanel.classList.add('collapsed');
                if (searchResultsSplit) searchResultsSplit.classList.add('viz-collapsed');
                vizExpandBtn.style.display = 'flex';
            } else {
                vizPanel.classList.remove('collapsed');
                if (searchResultsSplit) searchResultsSplit.classList.remove('viz-collapsed');
                vizExpandBtn.style.display = 'none';

                // Resize Plotly chart if expanding
                if (this.visualization) {
                    setTimeout(() => {
                        const plotlyContainer = document.getElementById('search-plotly-visualization');
                        if (plotlyContainer && window.Plotly) {
                            window.Plotly.Plots.resize(plotlyContainer);
                        }
                    }, 350);
                }
            }

            localStorage.setItem('vizPanelCollapsed', shouldCollapse);
        };

        // Restore state from localStorage
        const savedState = localStorage.getItem('vizPanelCollapsed');
        if (savedState === 'true') {
            toggleVisualization(true);
        }

        vizCollapseBtn.addEventListener('click', () => toggleVisualization(true));
        vizExpandBtn.addEventListener('click', () => toggleVisualization(false));
        console.log('Visualization toggle setup complete');
    }

    setupResultsToggle() {
        const resultsPanel = document.getElementById('results-panel');
        const resultsCollapseBtn = document.getElementById('results-collapse-btn');
        const resultsExpandBtn = document.getElementById('results-expand-btn');
        const searchResultsSplit = document.querySelector('#solvent-search .search-results-split');

        if (!resultsPanel || !resultsCollapseBtn || !resultsExpandBtn) {
            console.warn('Results toggle elements not found');
            return;
        }

        // Toggle function
        const toggleResults = (forceState = null) => {
            const shouldCollapse = forceState !== null ? forceState : !resultsPanel.classList.contains('collapsed');

            if (shouldCollapse) {
                resultsPanel.classList.add('collapsed');
                if (searchResultsSplit) searchResultsSplit.classList.add('results-collapsed');
                resultsExpandBtn.style.display = 'flex';

                // Resize Plotly chart (more space for viz)
                if (this.visualization) {
                    setTimeout(() => {
                        const plotlyContainer = document.getElementById('search-plotly-visualization');
                        if (plotlyContainer && window.Plotly) {
                            window.Plotly.Plots.resize(plotlyContainer);
                        }
                    }, 350);
                }
            } else {
                resultsPanel.classList.remove('collapsed');
                if (searchResultsSplit) searchResultsSplit.classList.remove('results-collapsed');
                resultsExpandBtn.style.display = 'none';
            }

            localStorage.setItem('resultsPanelCollapsed', shouldCollapse);
        };

        // Restore state from localStorage
        const savedState = localStorage.getItem('resultsPanelCollapsed');
        if (savedState === 'true') {
            toggleResults(true);
        }

        resultsCollapseBtn.addEventListener('click', () => toggleResults(true));
        resultsExpandBtn.addEventListener('click', () => toggleResults(false));
        console.log('Results toggle setup complete');
    }

    showDefaultVisualization() {
        // Show a default Hansen sphere with common solvents
        if (this.visualization) {
            this.visualization.showPlaceholder('Search solvents to display Hansen sphere visualization');
        }
    }

    /**
     * Show/hide selection UI elements
     */
    showSelectionUI(show) {
        const selectionControls = document.getElementById('selection-controls');

        if (selectionControls) {
            selectionControls.style.display = show ? 'flex' : 'none';
        }

        // Reset selection state
        if (show) {
            this.selectedSolvents.clear();
            this.updateSelectionUI();
        }
    }

    /**
     * Populate solvent set selector dropdown
     */
    populateSolventSetSelector() {
        const selector = document.getElementById('search-scope-selector');
        if (!selector) return;

        // Get solvent sets from storage (use same key as solvent_set_manager.js)
        const solventSets = JSON.parse(localStorage.getItem('mixingCompass_solventSets') || '[]');

        // Clear options except "All Solvents" and separator
        selector.innerHTML = `
            <option value="all">All Solvents</option>
            <option disabled>──────────</option>
        `;

        // Add solvent sets
        solventSets.forEach(set => {
            const option = document.createElement('option');
            option.value = set.id;
            option.textContent = `${set.name} (${set.solvents.length} solvents)`;
            selector.appendChild(option);
        });
    }

    /**
     * Update selection UI (count display, buttons)
     */
    updateSelectionUI() {
        const countDisplay = document.getElementById('selection-count');
        if (countDisplay) {
            countDisplay.textContent = `${this.selectedSolvents.size} selected`;
        }

        // Show "+ New Set" button only when solvents are selected
        const createNewSetBtn = document.getElementById('create-new-set-btn');
        if (createNewSetBtn) {
            createNewSetBtn.style.display = this.selectedSolvents.size > 0 ? 'inline-block' : 'none';
        }
    }

    /**
     * Show create set modal (Smart integration - can save selection or create empty)
     */
    showCreateSetModal() {
        const modal = document.getElementById('create-set-modal');
        const nameInput = document.getElementById('create-set-name-input');
        const includeCheckbox = document.getElementById('include-selection-checkbox');
        const selectionText = document.getElementById('selection-count-text');
        const selectionGroup = document.getElementById('selection-option-group');
        const confirmBtn = document.getElementById('create-set-confirm');
        const cancelBtn = document.getElementById('create-set-cancel');
        const closeBtn = document.getElementById('create-set-modal-close');

        if (!modal || !nameInput) {
            return;
        }

        // Get current selection
        const selectedData = this.resultsTable ?
            this.resultsTable.getData().filter(d => this.selectedSolvents.has(d.name)) :
            [];
        const hasSelection = selectedData.length > 0;

        // Update UI based on selection
        if (hasSelection) {
            selectionText.textContent = selectedData.length;
            selectionGroup.style.display = 'block';
            includeCheckbox.checked = true;
            nameInput.value = `Search Results (${selectedData.length})`;
        } else {
            selectionGroup.style.display = 'none';
            nameInput.value = 'New Solvent Set';
        }

        // Show modal
        modal.style.display = 'flex';
        nameInput.focus();
        nameInput.select();

        // Save handler
        const handleSave = () => {
            const setName = nameInput.value.trim();

            if (!setName) {
                Notification.error('Please enter a set name');
                nameInput.focus();
                return;
            }

            // Determine which solvents to include
            let solventsToSave = [];
            if (hasSelection && includeCheckbox.checked) {
                // Include current selection
                solventsToSave = selectedData.map(s => ({
                    solvent_name: s.name,
                    delta_d: s.delta_d,
                    delta_p: s.delta_p,
                    delta_h: s.delta_h,
                    ratio: 100 / selectedData.length
                }));
            }
            // else: empty set

            // Save using SolventSetManager
            if (window.solventSetManager) {
                window.solventSetManager.saveSolventSet(setName, solventsToSave);

                // Update Search In dropdown
                this.populateSolventSetSelector();

                if (solventsToSave.length > 0) {
                    Notification.success(`Saved "${setName}" with ${solventsToSave.length} solvents`);
                    // Clear selection after save
                    this.resultsTable.deselectRow();
                    this.selectedSolvents.clear();
                    this.updateSelectionUI();
                } else {
                    Notification.success(`Created empty set "${setName}"`);
                }
            } else {
                Notification.error('Solvent Set Manager not available');
            }

            // Close modal
            this.closeCreateSetModal();
        };

        // Enter key support
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        };

        // Close handler
        const handleClose = () => {
            this.closeCreateSetModal();
        };

        // Attach event listeners
        confirmBtn.onclick = handleSave;
        cancelBtn.onclick = handleClose;
        closeBtn.onclick = handleClose;
        nameInput.onkeypress = handleKeyPress;

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                handleClose();
            }
        };
    }

    /**
     * Close create set modal
     */
    closeCreateSetModal() {
        const modal = document.getElementById('create-set-modal');
        const nameInput = document.getElementById('create-set-name-input');

        if (modal) {
            modal.style.display = 'none';
        }
        if (nameInput) {
            nameInput.value = '';
            nameInput.onkeypress = null;
        }

        // Remove event listeners
        const confirmBtn = document.getElementById('create-set-confirm');
        const cancelBtn = document.getElementById('create-set-cancel');
        const closeBtn = document.getElementById('create-set-modal-close');

        if (confirmBtn) confirmBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
        if (closeBtn) closeBtn.onclick = null;

        if (modal) modal.onclick = null;
    }

    /**
     * Save selected solvents as a new set (Legacy - kept for compatibility)
     */
    saveAsSet() {
        if (this.selectedSolvents.size === 0) {
            // If nothing selected, use all visible results
            const allData = this.resultsTable.getData("active");
            if (allData.length === 0) {
                window.showNotification && window.showNotification('No solvents to save', 'error');
                return;
            }
            allData.forEach(d => this.selectedSolvents.add(d.name));
        }

        const setName = prompt('Enter a name for this solvent set:', `Search Results (${this.selectedSolvents.size} solvents)`);
        if (!setName) return;

        // Get full solvent data for selected solvents
        const allData = this.resultsTable.getData();
        const selectedData = allData.filter(d => this.selectedSolvents.has(d.name));

        // Format for solvent set storage (use solvent_name for consistency with SolventSetManager)
        const solventsForSet = selectedData.map(s => ({
            solvent_name: s.name,
            delta_d: s.delta_d,
            delta_p: s.delta_p,
            delta_h: s.delta_h,
            ratio: 100 / selectedData.length // Equal ratio
        }));

        // Use solventSetManager if available
        if (window.solventSetManager) {
            window.solventSetManager.saveSolventSet(setName, solventsForSet);
            window.showNotification && window.showNotification(`Saved "${setName}" with ${solventsForSet.length} solvents`, 'success');

            // Event is dispatched by solvent_set_manager
        } else {
            // Fallback: Direct localStorage save (use same key as solvent_set_manager.js)
            const solventSets = JSON.parse(localStorage.getItem('mixingCompass_solventSets') || '[]');
            const newSet = {
                id: Date.now().toString(),
                name: setName,
                solvents: solventsForSet,
                created: new Date().toISOString()
            };
            solventSets.push(newSet);
            localStorage.setItem('mixingCompass_solventSets', JSON.stringify(solventSets));
            window.showNotification && window.showNotification(`Saved "${setName}" with ${solventsForSet.length} solvents`, 'success');

            // Dispatch event for data list manager
            window.dispatchEvent(new CustomEvent('solventSetsUpdated'));
        }

        // Clear selection
        this.resultsTable.deselectRow();
    }

    /**
     * Get solvent names from a solvent set by ID
     */
    getSolventSetNames(setId) {
        const solventSets = JSON.parse(localStorage.getItem('mixingCompass_solventSets') || '[]');
        const set = solventSets.find(s => s.id === setId);
        if (!set) return new Set();
        // Handle both field names: solvent_name (from SolventSetManager) and name (from saveAsSet)
        return new Set(set.solvents.map(s => s.solvent_name || s.name));
    }

    /**
     * Filter search results by solvent set
     */
    filterBySet(results) {
        if (this.searchScope !== 'set' || !this.selectedSetId) {
            return results;
        }

        const setNames = this.getSolventSetNames(this.selectedSetId);
        console.log('Filter by set - setNames:', [...setNames]);
        console.log('Filter by set - results sample names:', results.slice(0, 5).map(r => r.name));

        if (setNames.size === 0) return results;

        // Create lowercase set for case-insensitive matching
        const setNamesLower = new Set([...setNames].map(n => n.toLowerCase()));

        // Check multiple possible field names for solvent name (case-insensitive)
        const filtered = results.filter(r => {
            const solventName = r.solvent || r.Solvent || r.name;
            if (!solventName) return false;
            return setNamesLower.has(solventName.toLowerCase());
        });

        console.log('Filter by set - filtered count:', filtered.length);
        return filtered;
    }

    /**
     * Copy solvent names to clipboard
     */
    copySolventNames() {
        if (!this.resultsTable) return;

        // Get selected rows if any
        const selectedRows = this.resultsTable.getSelectedRows();
        let names = [];

        if (selectedRows.length > 0) {
            // Copy selected solvent names
            names = selectedRows.map(row => row.getData().solvent || row.getData().Solvent || row.getData().name);
        } else {
            // Copy all visible solvent names
            const allData = this.resultsTable.getData();
            names = allData.map(row => row.solvent || row.Solvent || row.name);
        }

        // Filter out undefined/null names
        names = names.filter(name => name);

        if (names.length === 0) {
            if (window.showNotification) {
                window.showNotification('No solvent names to copy', 'error');
            }
            return;
        }

        // Join with newlines and copy to clipboard
        const text = names.join('\n');

        navigator.clipboard.writeText(text).then(() => {
            const count = names.length;
            const message = selectedRows.length > 0
                ? `Copied ${count} selected solvent name${count > 1 ? 's' : ''}`
                : `Copied ${count} solvent name${count > 1 ? 's' : ''}`;

            if (window.showNotification) {
                window.showNotification(message, 'success');
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback method
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            if (window.showNotification) {
                window.showNotification('Solvent names copied to clipboard', 'success');
            }
        });
    }

    /**
     * Export search results as ZIP package
     */
    async exportSearchPackage() {
        if (!this.resultsTable) return;

        // Get visible columns only (same as CSV export)
        const visibleColumns = this.resultsTable.getColumns().filter(col => col.isVisible());
        const columnFields = visibleColumns.map(col => col.getField());

        // Get all data from the table
        const allData = this.resultsTable.getData();

        if (allData.length === 0) {
            if (window.showNotification) {
                window.showNotification('No search results to export', 'error');
            }
            return;
        }

        // Filter data to include only visible columns
        const filteredData = allData.map(row => {
            const filteredRow = {};
            columnFields.forEach(field => {
                if (row.hasOwnProperty(field)) {
                    filteredRow[field] = row[field];
                }
            });
            return filteredRow;
        });

        try {
            // Disable button during export
            const exportPackageBtn = document.querySelector('#export-search-package-btn');
            if (exportPackageBtn) {
                exportPackageBtn.disabled = true;
                exportPackageBtn.textContent = 'Exporting...';
            }

            if (window.showNotification) {
                window.showNotification('Generating package...', 'info');
            }

            // Prepare target configurations
            const target1 = this.currentTarget1 && this.currentTarget1.delta_d !== undefined
                ? {
                    name: this.currentTarget1.name || null,
                    delta_d: this.currentTarget1.delta_d,
                    delta_p: this.currentTarget1.delta_p,
                    delta_h: this.currentTarget1.delta_h,
                    r0: this.currentTarget1.r0 || null
                }
                : null;

            const target2 = this.currentTarget2 && this.currentTarget2.delta_d !== undefined
                ? {
                    name: this.currentTarget2.name || null,
                    delta_d: this.currentTarget2.delta_d,
                    delta_p: this.currentTarget2.delta_p,
                    delta_h: this.currentTarget2.delta_h,
                    r0: this.currentTarget2.r0 || null
                }
                : null;

            const target3 = this.currentTarget3 && this.currentTarget3.delta_d !== undefined
                ? {
                    name: this.currentTarget3.name || null,
                    delta_d: this.currentTarget3.delta_d,
                    delta_p: this.currentTarget3.delta_p,
                    delta_h: this.currentTarget3.delta_h,
                    r0: this.currentTarget3.r0 || null
                }
                : null;

            // Generate search name from targets or use default
            let searchName = 'Search Results';
            if (target1 && target1.name) {
                searchName = target1.name;
            } else if (target1) {
                searchName = `Target_${target1.delta_d.toFixed(1)}_${target1.delta_p.toFixed(1)}_${target1.delta_h.toFixed(1)}`;
            }

            // Prepare export data
            const exportData = {
                search_name: searchName,
                solvents: filteredData,
                target1: target1,
                target2: target2,
                target3: target3,
                search_scope: this.searchScope || 'all'
            };

            // Call export API
            const response = await fetch('/api/solvent-search/export-search-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(exportData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Export failed');
            }

            // Download ZIP file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Get filename from Content-Disposition header or generate one
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'search_results.zip';
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            if (window.showNotification) {
                window.showNotification('Package exported successfully', 'success');
            }

        } catch (error) {
            console.error('Export error:', error);
            if (window.showNotification) {
                window.showNotification(error.message || 'Failed to export package', 'error');
            }
        } finally {
            // Re-enable button
            const exportPackageBtn = document.querySelector('#export-search-package-btn');
            if (exportPackageBtn) {
                exportPackageBtn.disabled = false;
                exportPackageBtn.textContent = 'Export Package (ZIP)';
            }
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('solvent-search')) {
        window.solventSearch = new SolventSearch();
    }
});
