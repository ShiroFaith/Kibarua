/**
 * API Service - Handles all backend communication
 * Usage: import { apiCall, auth } from 'api-service.js'
 */

// Local development backend - direct folder-structure, no .htaccess rewriting needed.
const API_BASE = 'http://localhost:5050/api';

class APIService {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('authToken');
    }

    /**
     * Generic API call handler
     */
    async call(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'API error');
            }

            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    /**
     * Store token in localStorage and update instance
     */
    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    /**
     * Clear token from storage
     */
    clearToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    // ============ Auth Endpoints ============

    /**
     * Register new user
     */
    async register(name, email, password, confirm_password) {
        return this.call('/auth/register.php', 'POST', {
            name,
            email,
            password,
            confirm_password
        });
    }

    /**
     * Login user
     */
    async login(email, password) {
        const result = await this.call('/auth/login.php', 'POST', {
            email,
            password
        });

        if (result.success && result.token) {
            this.setToken(result.token);
        }

        return result;
    }

    /**
     * Verify email with token
     */
    async verifyEmail(token) {
        return this.call('/auth/verify-email.php', 'POST', { token });
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email) {
        return this.call('/auth/request-reset.php', 'POST', { email });
    }

    /**
     * Verify reset token
     */
    async verifyResetToken(token) {
        return this.call('/auth/verify-reset-token.php', 'POST', { token });
    }

    /**
     * Reset password
     */
    async resetPassword(token, password, confirm_password) {
        return this.call('/auth/reset-password.php', 'POST', {
            token,
            password,
            confirm_password
        });
    }

    /**
     * Get current logged in user
     */
    async getCurrentUser() {
        return this.call('/auth/me.php', 'GET');
    }

    /**
     * Logout user
     */
    async logout() {
        this.clearToken();
        return this.call('/auth/logout.php', 'POST');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.token;
    }
}

// Create singleton instance
const apiService = new APIService(API_BASE);

export default apiService;
