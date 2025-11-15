/**
 * Common Utilities
 * Shared utility functions for the application
 */

const Utils = {
    /**
     * Generate unique ID
     * @param {string} prefix - Prefix for the ID
     * @returns {string} Unique ID
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Format date to localized string
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        return new Date(date).toLocaleDateString();
    },

    /**
     * Format datetime to localized string
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted datetime string
     */
    formatDateTime(date) {
        const d = new Date(date);
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    },

    /**
     * Format date to ISO string
     * @param {Date} date - Date to format (defaults to now)
     * @returns {string} ISO formatted date string
     */
    formatISO(date = new Date()) {
        return date.toISOString();
    },

    /**
     * Deep clone an object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Download JSON file
     * @param {Object} data - Data to download
     * @param {string} filename - Name of the file
     */
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Truncate string to specified length
     * @param {string} str - String to truncate
     * @param {number} length - Maximum length
     * @returns {string} Truncated string
     */
    truncate(str, length) {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + '...';
    },

    /**
     * Check if value is empty (null, undefined, empty string, empty array)
     * @param {*} value - Value to check
     * @returns {boolean} True if empty
     */
    isEmpty(value) {
        return value === null ||
               value === undefined ||
               (typeof value === 'string' && value.trim() === '') ||
               (Array.isArray(value) && value.length === 0);
    },

    /**
     * Format HSP value with specified decimal places
     * @param {number|null} value - HSP value to format
     * @param {number} decimals - Number of decimal places (default: 1)
     * @returns {string} Formatted value or '-' if null
     */
    formatHSPValue(value, decimals = 1) {
        return value !== null ? value.toFixed(decimals) : '-';
    },

    /**
     * Create HTML for solvent status icons (warning, reference link, and Google search)
     * @param {boolean} hasHSP - Whether HSP values are available
     * @param {string} solventName - Name of the solvent
     * @param {string|null} sourceUrl - URL to the reference source
     * @returns {string} HTML string for status icons
     */
    createSolventStatusIcons(hasHSP, solventName, sourceUrl) {
        let html = '';
        if (!hasHSP && solventName) {
            html += '<span class="error-icon" title="Solvent not found in database">⚠️</span>';
        }
        if (sourceUrl) {
            html += `<a href="${sourceUrl}" class="ref-link" title="View source" target="_blank" rel="noopener noreferrer">🔗</a>`;
        }
        if (solventName) {
            html += `<a href="https://www.google.com/search?q=${encodeURIComponent(solventName)}" class="google-search-link" title="Search on Google" target="_blank" rel="noopener noreferrer">🔍</a>`;
        }
        return html;
    },

    /**
     * Create HTML for datalist element
     * @param {Array<string>} options - Array of option values
     * @param {string} id - ID for the datalist element (default: 'solvent-datalist')
     * @returns {string} HTML string for datalist
     */
    createDatalistHTML(options, id = 'solvent-datalist') {
        const optionsHTML = options.map(opt => `<option value="${opt}">`).join('');
        return `<datalist id="${id}">${optionsHTML}</datalist>`;
    },

    /**
     * Create options HTML for datalist (without datalist wrapper)
     * @param {Array<string>} options - Array of option values
     * @returns {string} HTML string for options
     */
    createDatalistOptions(options) {
        return options.map(opt => `<option value="${opt}">`).join('');
    }
};

/**
 * Modal Management Utilities
 * Provides consistent modal behavior across the application (Esc key, autofocus, background click)
 */
const ModalManager = {
    /**
     * Open modal with common features (Esc key, autofocus, background click)
     * @param {string} modalId - ID of the modal element
     * @param {Object} options - Options
     * @param {string} options.focusSelector - Selector for element to focus (optional)
     * @param {boolean} options.selectText - Whether to select text in focused element (default: false)
     * @param {Function} options.onClose - Callback when modal closes (optional)
     */
    open(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`Modal with id "${modalId}" not found`);
            return;
        }

        modal.style.display = 'flex';

        // Autofocus on specified element
        if (options.focusSelector) {
            const focusElement = modal.querySelector(options.focusSelector);
            if (focusElement) {
                setTimeout(() => {
                    focusElement.focus();
                    if (options.selectText && typeof focusElement.select === 'function') {
                        focusElement.select();
                    }
                }, 100);
            }
        }

        // Escape key handler
        const escHandler = (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                this.close(modalId, options.onClose);
            }
        };

        // Store handler reference on modal element for cleanup
        modal._escHandler = escHandler;
        document.addEventListener('keydown', escHandler);

        // Background click handler (already handled by existing modal code in most cases)
        // This is optional and can be skipped if modal already has background click handling
    },

    /**
     * Close modal and cleanup listeners
     * @param {string} modalId - ID of the modal element
     * @param {Function} onClose - Callback when modal closes (optional)
     */
    close(modalId, onClose) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`Modal with id "${modalId}" not found`);
            return;
        }

        modal.style.display = 'none';

        // Remove Escape key listener
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
            delete modal._escHandler;
        }

        // Execute callback if provided
        if (typeof onClose === 'function') {
            onClose();
        }
    }
};

// Make available globally
window.Utils = Utils;
window.ModalManager = ModalManager;
