/**
 * Notification System
 * Unified notification system for the application
 */

const Notification = {
    /**
     * Show notification message
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (info, success, warning, error)
     * @param {number} duration - Duration in milliseconds (default: 3000)
     */
    show(message, type = 'info', duration = 3000) {
        console.log(`${type.toUpperCase()}: ${message}`);

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Add to document
        document.body.appendChild(notification);

        // Auto-remove after duration
        setTimeout(() => {
            notification.classList.add('notification-fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    },

    /**
     * Show info notification
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    info(message, duration = 3000) {
        this.show(message, 'info', duration);
    },

    /**
     * Show success notification
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    success(message, duration = 3000) {
        this.show(message, 'success', duration);
    },

    /**
     * Show warning notification
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    warning(message, duration = 4000) {
        this.show(message, 'warning', duration);
    },

    /**
     * Show error notification
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    }
};

// Make available globally
window.Notification = Notification;
