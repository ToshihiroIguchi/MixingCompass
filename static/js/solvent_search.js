/**
 * Solvent Search Module
 * Search for single solvents or solvent blends based on target HSP values
 */

class SolventSearch {
    constructor() {
        this.searchResults = [];
        this.currentSort = 'distance';
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('Solvent Search initialized');
    }

    setupEventListeners() {
        // Target HSP inputs - enable search button when all are filled
        const targetInputs = ['target-delta-d', 'target-delta-p', 'target-delta-h'];
        targetInputs.forEach(id => {
            const input = document.querySelector(`#${id}`);
            if (input) {
                input.addEventListener('input', () => this.validateSearchButton());
            }
        });

        // Search button
        const searchBtn = document.querySelector('#search-solvents-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }

        // Toggle filters
        const toggleFiltersBtn = document.querySelector('#toggle-filters');
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', () => this.toggleFilters());
        }

        // Sort selector
        const sortSelect = document.querySelector('#sort-results');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.sortAndDisplayResults();
            });
        }
    }

    validateSearchButton() {
        const deltaD = document.querySelector('#target-delta-d').value;
        const deltaP = document.querySelector('#target-delta-p').value;
        const deltaH = document.querySelector('#target-delta-h').value;
        const searchBtn = document.querySelector('#search-solvents-btn');

        if (deltaD && deltaP && deltaH) {
            searchBtn.disabled = false;
            searchBtn.title = 'Search for suitable solvents';
        } else {
            searchBtn.disabled = true;
            searchBtn.title = 'Please enter all target HSP values';
        }
    }

    toggleFilters() {
        const filterOptions = document.querySelector('#filter-options');
        if (filterOptions) {
            filterOptions.style.display = filterOptions.style.display === 'none' ? 'block' : 'none';
        }
    }

    async performSearch() {
        // Get target values
        const targetDeltaD = parseFloat(document.querySelector('#target-delta-d').value);
        const targetDeltaP = parseFloat(document.querySelector('#target-delta-p').value);
        const targetDeltaH = parseFloat(document.querySelector('#target-delta-h').value);
        const targetRadius = parseFloat(document.querySelector('#target-radius').value) || null;

        // Get filter values
        const bpMin = parseFloat(document.querySelector('#bp-min').value) || null;
        const bpMax = parseFloat(document.querySelector('#bp-max').value) || null;
        const costMin = parseFloat(document.querySelector('#cost-min').value) || null;
        const costMax = parseFloat(document.querySelector('#cost-max').value) || null;

        // Get WGK filter
        const wgkSelect = document.querySelector('#wgk-filter');
        const wgkFilter = Array.from(wgkSelect.selectedOptions).map(opt => opt.value);

        // Get search mode
        const searchMode = document.querySelector('input[name="search-mode"]:checked').value;

        // Show loading
        const searchBtn = document.querySelector('#search-solvents-btn');
        const originalText = searchBtn.textContent;
        searchBtn.textContent = 'Searching...';
        searchBtn.disabled = true;

        try {
            let results;

            if (searchMode === 'single') {
                results = await this.searchSingleSolvents(
                    targetDeltaD, targetDeltaP, targetDeltaH, targetRadius,
                    bpMin, bpMax, costMin, costMax, wgkFilter
                );
            } else {
                results = await this.searchBlendSolvents(
                    targetDeltaD, targetDeltaP, targetDeltaH, targetRadius
                );
            }

            this.searchResults = results.results;
            this.displayResults(searchMode);
            this.updateResultsCount(results.count);

        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            searchBtn.textContent = originalText;
            searchBtn.disabled = false;
        }
    }

    async searchSingleSolvents(deltaD, deltaP, deltaH, radius, bpMin, bpMax, costMin, costMax, wgkFilter) {
        const params = new URLSearchParams({
            target_delta_d: deltaD,
            target_delta_p: deltaP,
            target_delta_h: deltaH,
        });

        if (radius) params.append('target_radius', radius);
        if (bpMin) params.append('bp_min', bpMin);
        if (bpMax) params.append('bp_max', bpMax);
        if (costMin) params.append('cost_min', costMin);
        if (costMax) params.append('cost_max', costMax);

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
                case 'cost':
                    if (searchMode === 'single') {
                        return (a.cost || 999) - (b.cost || 999);
                    }
                    return 0; // Blend mode doesn't have cost
                default:
                    return 0;
            }
        });

        this.displayResults(searchMode);
    }

    displayResults(searchMode) {
        const resultsList = document.querySelector('#search-results-list');

        if (this.searchResults.length === 0) {
            resultsList.innerHTML = `
                <div class="empty-state">
                    <p>No solvents found matching your criteria.</p>
                    <p>Try adjusting the search radius or removing some filters.</p>
                </div>
            `;
            return;
        }

        if (searchMode === 'single') {
            resultsList.innerHTML = this.searchResults.map(solvent => this.createSolventCardHTML(solvent)).join('');
        } else {
            resultsList.innerHTML = this.searchResults.map(blend => this.createBlendCardHTML(blend)).join('');
        }
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
                        ${solvent.cost !== null ? `<span>Cost: $${solvent.cost.toFixed(3)}/mL</span>` : ''}
                        ${solvent.wgk ? `<span>WGK: ${solvent.wgk}</span>` : ''}
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
        if (countDisplay) {
            countDisplay.textContent = `${count} result${count !== 1 ? 's' : ''}`;
        }
    }

    showError(message) {
        const resultsList = document.querySelector('#search-results-list');
        resultsList.innerHTML = `
            <div class="empty-state error">
                <p style="color: #ef4444;">❌ ${message}</p>
            </div>
        `;
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('solvent-search')) {
        window.solventSearch = new SolventSearch();
    }
});
