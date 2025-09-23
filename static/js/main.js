// MixingCompass Main JavaScript

class MixingCompass {
    constructor() {
        this.currentSection = 'hsp-experimental';
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        console.log('MixingCompass initialized');
    }

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');

        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetSection = e.target.getAttribute('data-section');
                this.switchSection(targetSection);
            });
        });
    }

    switchSection(sectionId) {
        // Update active navigation button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

        // Update active content section
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');

        this.currentSection = sectionId;
        console.log(`Switched to section: ${sectionId}`);
    }

    setupEventListeners() {
        // Test API connectivity
        this.testAPIConnectivity();
    }

    async testAPIConnectivity() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            console.log('API Health Check:', data);
        } catch (error) {
            console.error('API connectivity test failed:', error);
        }
    }

    // Utility method for making API calls
    async apiCall(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(endpoint, options);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // Show notification to user
    showNotification(message, type = 'info') {
        // Simple notification - can be enhanced later
        console.log(`${type.toUpperCase()}: ${message}`);

        // TODO: Implement proper notification UI
        if (type === 'error') {
            alert(`Error: ${message}`);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mixingCompass = new MixingCompass();
});