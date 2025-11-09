/**
 * Solvent Table Manager
 * Shared data-driven table component for HSP sections
 * Replaces DOM-driven table management with clean array-based state
 */

class SolventTableManager {
    constructor(config) {
        this.containerId = config.containerId;
        this.columns = config.columns;
        this.rows = [];
        this.rowIdCounter = 0;
        this.datalistOptions = config.datalistOptions || [];
        this.datalistId = config.datalistId || 'solvent-datalist';

        // Callbacks
        this.onDataChange = config.onDataChange || (() => {});
        this.onSolventLookup = config.onSolventLookup || null;
        this.onRowAdd = config.onRowAdd || (() => {});
        this.onRowRemove = config.onRowRemove || (() => {});
        this.onModeToggle = config.onModeToggle || null;

        // Configuration
        this.emptyMessage = config.emptyMessage || 'Click "+ Add" to start';
        this.showHeader = config.showHeader !== false;
    }

    /**
     * Add a new row with optional initial data
     */
    addRow(initialData = {}) {
        const row = {
            id: this.rowIdCounter++,
            ...this.getDefaultRowData(),
            ...initialData
        };
        this.rows.push(row);
        this.render();
        this.onRowAdd(row);
        return row.id;
    }

    /**
     * Remove a row by ID
     */
    removeRow(rowId) {
        const index = this.rows.findIndex(r => r.id === rowId);
        if (index !== -1) {
            const removedRow = this.rows[index];
            this.rows.splice(index, 1);
            this.render();
            this.onRowRemove(removedRow);
        }
    }

    /**
     * Update a row's data
     */
    updateRow(rowId, updates) {
        const row = this.rows.find(r => r.id === rowId);
        if (row) {
            Object.assign(row, updates);
            this.render();
            this.onDataChange(this.rows);
        }
    }

    /**
     * Get all rows data
     */
    getData() {
        return this.rows;
    }

    /**
     * Set all rows data (for loading saved data)
     */
    setData(data) {
        this.rows = data.map((row, index) => ({
            id: this.rowIdCounter++,
            ...row
        }));
        this.render();
    }

    /**
     * Clear all rows
     */
    clear() {
        this.rows = [];
        this.rowIdCounter = 0;
        this.render();
    }

    /**
     * Get default data for a new row based on columns
     */
    getDefaultRowData() {
        const data = {};
        this.columns.forEach(col => {
            if (col.defaultValue !== undefined) {
                data[col.key] = col.defaultValue;
            } else {
                // Set default values based on type
                switch (col.type) {
                    case 'number':
                        data[col.key] = 0;
                        break;
                    case 'readonly-hsp':
                        data[col.key] = null;
                        break;
                    default:
                        data[col.key] = '';
                }
            }
        });
        return data;
    }

    /**
     * Render the entire table
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container ${this.containerId} not found`);
            return;
        }

        if (this.rows.length === 0) {
            container.innerHTML = `<div class="empty-state">${this.emptyMessage}</div>`;
            return;
        }

        const tableHTML = this.generateTableHTML();
        container.innerHTML = tableHTML;
        this.attachEventListeners();
    }

    /**
     * Generate complete table HTML
     */
    generateTableHTML() {
        const headerHTML = this.showHeader ? `
            <thead>
                <tr>
                    ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
                </tr>
            </thead>
        ` : '';

        const bodyHTML = `
            <tbody>
                ${this.rows.map(row => this.generateRowHTML(row)).join('')}
            </tbody>
        `;

        // Generate datalist once for all rows
        const datalistHTML = this.datalistOptions.length > 0 ? `
            <datalist id="${this.datalistId}">
                ${Utils.createDatalistOptions(this.datalistOptions)}
            </datalist>
        ` : '';

        return `
            <div class="mixture-table-wrapper">
                ${datalistHTML}
                <table class="mixture-table">
                    ${headerHTML}
                    ${bodyHTML}
                </table>
            </div>
        `;
    }

    /**
     * Generate HTML for a single row
     */
    generateRowHTML(row) {
        const cellsHTML = this.columns.map(col =>
            this.generateCellHTML(row, col)
        ).join('');

        return `<tr data-row-id="${row.id}">${cellsHTML}</tr>`;
    }

    /**
     * Generate HTML for a single cell based on column type
     */
    generateCellHTML(row, col) {
        const value = row[col.key];

        switch (col.type) {
            case 'text-autocomplete':
                return this.generateTextAutocompleteCell(row, col, value);

            case 'readonly-hsp':
                // Check if row has mode property (Experimental section)
                const isManualMode = row.mode === 'manual';
                const readonlyAttr = isManualMode ? '' : 'readonly';
                const manualClass = isManualMode ? 'manual-entry' : '';
                const displayValue = value !== null && value !== undefined ? value : '';
                return `
                    <td>
                        <input type="number"
                               class="hsp-input ${col.key} ${manualClass}"
                               value="${displayValue}"
                               step="0.1"
                               min="0"
                               ${readonlyAttr}
                               data-row-id="${row.id}"
                               data-col-key="${col.key}">
                    </td>
                `;

            case 'number':
                return this.generateNumberCell(row, col, value);

            case 'solubility-select':
                return this.generateSolubilityCell(row, col, value);

            case 'text':
                return this.generateTextCell(row, col, value);

            case 'actions':
                return this.generateActionsCell(row, col);

            case 'actions-with-mode':
                return this.generateActionsWithModeCell(row, col);

            default:
                return `<td>${value || ''}</td>`;
        }
    }

    /**
     * Generate text input cell with autocomplete
     */
    generateTextAutocompleteCell(row, col, value) {
        const hasHSP = row.delta_d !== null && row.delta_p !== null && row.delta_h !== null;
        const notFoundClass = !hasHSP && value ? 'solvent-not-found' : '';
        const isManualMode = row.mode === 'manual';

        // Disable autocomplete in manual mode to allow arbitrary solvent names
        const listAttr = isManualMode ? '' : `list="${this.datalistId}"`;

        return `
            <td class="solvent-cell">
                <div class="solvent-input-container ${notFoundClass}">
                    <input
                        type="text"
                        class="solvent-input"
                        placeholder="${col.placeholder || 'Enter solvent name'}"
                        value="${value || ''}"
                        ${listAttr}
                        data-row-id="${row.id}"
                        data-key="${col.key}"
                    >
                    ${Utils.createSolventStatusIcons(hasHSP, value, row.source_url)}
                </div>
            </td>
        `;
    }

    /**
     * Generate number input cell
     */
    generateNumberCell(row, col, value) {
        return `
            <td class="ratio-cell">
                <input
                    type="number"
                    class="volume-input"
                    placeholder="${col.placeholder || '0'}"
                    min="${col.min || 0}"
                    max="${col.max || ''}"
                    step="${col.step || '0.1'}"
                    value="${value || ''}"
                    data-row-id="${row.id}"
                    data-key="${col.key}"
                >
            </td>
        `;
    }

    /**
     * Generate solubility select cell (Experimental specific)
     */
    generateSolubilityCell(row, col, value) {
        const isCustom = typeof value === 'number' && !['soluble', 'partial', 'insoluble'].includes(value);
        const selectValue = isCustom ? 'custom' : value;
        const customDisplay = isCustom ? 'block' : 'none';
        const customValue = isCustom ? value : '';

        return `
            <td>
                <div class="solubility-input-group">
                    <select class="solubility-select" data-row-id="${row.id}" data-key="${col.key}">
                        <option value="">Choose solubility level</option>
                        <option value="soluble" ${selectValue === 'soluble' ? 'selected' : ''}>Soluble (1.0)</option>
                        <option value="partial" ${selectValue === 'partial' ? 'selected' : ''}>Partial (0.5)</option>
                        <option value="insoluble" ${selectValue === 'insoluble' ? 'selected' : ''}>Insoluble (0.0)</option>
                        <option value="custom" ${selectValue === 'custom' ? 'selected' : ''}>Custom...</option>
                    </select>
                    <input
                        type="number"
                        class="custom-solubility-input"
                        min="0"
                        max="1"
                        step="0.1"
                        placeholder="0.0-1.0"
                        value="${customValue}"
                        data-row-id="${row.id}"
                        data-key="${col.key}_custom"
                        style="display: ${customDisplay};"
                    >
                </div>
            </td>
        `;
    }

    /**
     * Generate text input cell
     */
    generateTextCell(row, col, value) {
        return `
            <td>
                <input
                    type="text"
                    class="notes-input"
                    placeholder="${col.placeholder || ''}"
                    value="${value || ''}"
                    data-row-id="${row.id}"
                    data-key="${col.key}"
                >
            </td>
        `;
    }

    /**
     * Generate actions cell (delete button only)
     */
    generateActionsCell(row, col) {
        return `
            <td class="action-cell">
                <button class="btn-small btn-danger remove-btn"
                        data-row-id="${row.id}"
                        title="Remove">×</button>
            </td>
        `;
    }

    /**
     * Generate actions cell with mode toggle (Experimental specific)
     */
    generateActionsWithModeCell(row, col) {
        const mode = row.mode || 'auto';
        const modeLabel = mode === 'auto' ? 'Auto' : 'Manual';
        const activeClass = mode === 'manual' ? 'active' : '';

        return `
            <td>
                <div class="action-buttons">
                    <button class="btn-small btn-secondary mode-btn ${activeClass}"
                            data-row-id="${row.id}"
                            data-mode="${mode}"
                            title="Toggle input mode">${modeLabel}</button>
                    <button class="btn-small btn-danger remove-btn"
                            data-row-id="${row.id}"
                            title="Remove row">×</button>
                </div>
            </td>
        `;
    }

    /**
     * Attach event listeners to rendered elements
     */
    attachEventListeners() {
        const container = document.getElementById(this.containerId);

        // Text autocomplete inputs
        container.querySelectorAll('.solvent-input').forEach(input => {
            input.addEventListener('input', (e) => this.handleInputChange(e));
            input.addEventListener('blur', (e) => this.handleSolventBlur(e));
        });

        // Number inputs
        container.querySelectorAll('.volume-input').forEach(input => {
            input.addEventListener('input', (e) => this.handleInputChange(e));
        });

        // HSP inputs (for Experimental section)
        container.querySelectorAll('.hsp-input').forEach(input => {
            input.addEventListener('change', (e) => this.handleHSPInputChange(e));
        });

        // Solubility selects
        container.querySelectorAll('.solubility-select').forEach(select => {
            select.addEventListener('change', (e) => this.handleSolubilityChange(e));
        });

        // Custom solubility inputs
        container.querySelectorAll('.custom-solubility-input').forEach(input => {
            input.addEventListener('input', (e) => this.handleCustomSolubilityChange(e));
        });

        // Text inputs
        container.querySelectorAll('.notes-input').forEach(input => {
            input.addEventListener('input', (e) => this.handleInputChange(e));
        });

        // Remove buttons
        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleRemoveClick(e));
        });

        // Mode toggle buttons
        container.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleModeToggle(e));
        });
    }

    /**
     * Handle generic input change
     */
    handleInputChange(event) {
        const rowId = parseInt(event.target.dataset.rowId);
        const key = event.target.dataset.key;
        let value = event.target.value;

        // Parse number inputs
        if (event.target.type === 'number') {
            value = parseFloat(value) || 0;
        }

        const row = this.rows.find(r => r.id === rowId);
        if (row) {
            row[key] = value;
            this.onDataChange(this.rows);
        }
    }

    /**
     * Handle HSP input change (for Experimental section manual mode)
     */
    handleHSPInputChange(event) {
        const rowId = parseInt(event.target.dataset.rowId);
        const colKey = event.target.dataset.colKey;
        const value = event.target.value ? parseFloat(event.target.value) : null;

        const row = this.rows.find(r => r.id === rowId);
        if (row) {
            row[colKey] = value;
            this.onDataChange(this.rows);
        }
    }

    /**
     * Handle solvent input blur (trigger lookup)
     */
    async handleSolventBlur(event) {
        const rowId = parseInt(event.target.dataset.rowId);
        const solventName = event.target.value.trim();

        if (this.onSolventLookup && solventName) {
            const row = this.rows.find(r => r.id === rowId);
            if (row) {
                await this.onSolventLookup(row, solventName);
                // Note: render() is called by updateRow() inside onSolventLookup callback
            }
        }
    }

    /**
     * Handle solubility select change
     */
    handleSolubilityChange(event) {
        const rowId = parseInt(event.target.dataset.rowId);
        const key = event.target.dataset.key;
        const selectValue = event.target.value;

        const row = this.rows.find(r => r.id === rowId);
        if (!row) return;

        if (selectValue === 'custom') {
            // Will be updated by custom input
            row[key] = 0.5; // default
        } else {
            row[key] = selectValue;
        }

        this.render(); // Re-render to show/hide custom input
        this.onDataChange(this.rows);
    }

    /**
     * Handle custom solubility input
     */
    handleCustomSolubilityChange(event) {
        const rowId = parseInt(event.target.dataset.rowId);
        const key = event.target.dataset.key.replace('_custom', '');
        const value = parseFloat(event.target.value) || 0.5;

        const row = this.rows.find(r => r.id === rowId);
        if (row) {
            row[key] = value;
            this.onDataChange(this.rows);
        }
    }

    /**
     * Handle remove button click
     */
    handleRemoveClick(event) {
        const rowId = parseInt(event.target.dataset.rowId);
        this.removeRow(rowId);
    }

    /**
     * Handle mode toggle button click
     */
    handleModeToggle(event) {
        const rowId = parseInt(event.target.dataset.rowId);
        const row = this.rows.find(r => r.id === rowId);

        if (row && this.onModeToggle) {
            // Toggle mode
            const currentMode = row.mode || 'auto';
            const newMode = currentMode === 'auto' ? 'manual' : 'auto';
            row.mode = newMode;

            // Call callback with row and new mode
            this.onModeToggle(row, newMode);
            this.render();
        }
    }

    /**
     * Update datalist options (for dynamic solvent lists)
     */
    updateDatalistOptions(options) {
        this.datalistOptions = options;
        this.render();
    }
}

// Make available globally
window.SolventTableManager = SolventTableManager;
