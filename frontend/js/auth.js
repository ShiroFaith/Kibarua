/**
 * Authentication Helper - Frontend API Client
 * Manages token storage, API requests, and user sessions
 */

class AuthManager {
    constructor() {
        this.API_BASE_URL = 'http://localhost/nirus/backend/api';
        this.TOKEN_KEY = 'authToken';
        this.USER_KEY = 'user';
    }

    /**
     * Get stored JWT token
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    /**
     * Get stored user data
     */
    getUser() {
        const user = localStorage.getItem(this.USER_KEY);
        return user ? JSON.parse(user) : null;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.getToken();
    }

    /**
     * Set authentication tokens
     */
    setAuth(token, user) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }

    /**
     * Clear authentication
     */
    clearAuth() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    }

    /**
     * Make authenticated API request
     */
    async apiRequest(endpoint, method = 'GET', body = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Add authorization header if token exists
        const token = this.getToken();
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        // Add body for POST/PUT requests
        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}${endpoint}`, options);
            const data = await response.json();

            // If token expired, logout user
            if (response.status === 401) {
                this.clearAuth();
                window.location.href = '/Nirus%20Plt/pages/auth/login.html';
                return null;
            }

            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    /**
     * Register new user
     */
    async register(userData) {
        try {
            const payload = new URLSearchParams({
                username: userData.username || '',
                email: userData.email || '',
                password: userData.password || '',
                confirm_password: userData.confirm_password || userData.password || '',
                full_name: userData.full_name || '',
                role: userData.role || 'worker',
                phone: userData.phone || ''
            });

            const response = await fetch(`${this.API_BASE_URL}/auth/register.php`, {
                method: 'POST',
                body: payload
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Registration Error:', error);
            throw error;
        }
    }

    /**
     * Login user
     */
    async login(email, password) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/login.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.setAuth(data.data.token, data.data.user);
            }

            return data;
        } catch (error) {
            console.error('Login Error:', error);
            throw error;
        }
    }

    /**
     * Get current user profile
     */
    async getProfile() {
        return await this.apiRequest('/auth/profile.php', 'GET');
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await this.apiRequest('/auth/logout.php', 'POST');
            this.clearAuth();
            window.location.href = '/Nirus%20Plt/pages/auth/login.html';
        } catch (error) {
            // Clear auth anyway
            this.clearAuth();
            console.error('Logout Error:', error);
        }
    }

    /**
     * Verify email with token
     */
    async verifyEmail(token) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/verify-email.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            return await response.json();
        } catch (error) {
            console.error('Email Verification Error:', error);
            throw error;
        }
    }

    /**
     * Request password reset
     */
    async forgotPassword(email) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/forgot-password.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            return await response.json();
        } catch (error) {
            console.error('Forgot Password Error:', error);
            throw error;
        }
    }

    /**
     * Reset password with token
     */
    async resetPassword(token, password, confirmPassword) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/reset-password.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token,
                    password,
                    confirm_password: confirmPassword
                })
            });

            return await response.json();
        } catch (error) {
            console.error('Reset Password Error:', error);
            throw error;
        }
    }

    /**
     * Redirect to login if not authenticated
     */
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/Nirus%20Plt/pages/auth/login.html';
        }
    }

    /**
     * Redirect to dashboard if already authenticated
     */
    requireGuest() {
        if (this.isAuthenticated()) {
            window.location.href = '/Nirus%20Plt/pages/dashboard/dashboard.html';
        }
    }

    /**
     * Get authorization header
     */
    getAuthHeader() {
        const token = this.getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }
}

// Create global instance
const auth = new AuthManager();

// Usage examples:
// auth.login('email@example.com', 'password123');
// auth.getProfile();
// auth.logout();
// auth.isAuthenticated(); // true/false
