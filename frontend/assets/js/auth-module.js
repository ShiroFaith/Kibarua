/**
 * Authentication Module
 * Handles login, registration, and user session management
 */

import apiService from './api-service.js';

class AuthModule {
    constructor() {
        this.user = null;
        this.isLoading = false;
        this.checkAuthStatus();
    }

    /**
     * Check if user is logged in on page load
     */
    async checkAuthStatus() {
        if (!apiService.isAuthenticated()) {
            return;
        }

        try {
            const result = await apiService.getCurrentUser();
            if (result.success) {
                this.user = result.user;
                this.dispatchEvent('authStatusChanged', { authenticated: true, user: this.user });
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            apiService.clearToken();
        }
    }

    /**
     * Handle user registration
     */
    async register(name, email, password, confirmPassword) {
        this.isLoading = true;
        this.dispatchEvent('loadingStateChanged', { isLoading: true });

        try {
            const result = await apiService.register(name, email, password, confirmPassword);

            if (result.success) {
                this.dispatchEvent('registrationSuccess', {
                    message: result.message,
                    email: email
                });
                return { success: true, message: result.message };
            } else {
                this.dispatchEvent('registrationError', { message: result.message });
                return { success: false, message: result.message };
            }
        } catch (error) {
            const message = error.message || 'Registration failed. Please try again.';
            this.dispatchEvent('registrationError', { message });
            return { success: false, message };
        } finally {
            this.isLoading = false;
            this.dispatchEvent('loadingStateChanged', { isLoading: false });
        }
    }

    /**
     * Handle user login
     */
    async login(email, password) {
        this.isLoading = true;
        this.dispatchEvent('loadingStateChanged', { isLoading: true });

        try {
            const result = await apiService.login(email, password);

            if (result.success && result.user) {
                this.user = result.user;
                this.dispatchEvent('loginSuccess', { user: this.user });
                return { success: true, user: this.user };
            } else {
                this.dispatchEvent('loginError', { message: result.message });
                return { success: false, message: result.message };
            }
        } catch (error) {
            const message = error.message || 'Login failed. Please try again.';
            this.dispatchEvent('loginError', { message });
            return { success: false, message };
        } finally {
            this.isLoading = false;
            this.dispatchEvent('loadingStateChanged', { isLoading: false });
        }
    }

    /**
     * Handle email verification
     */
    async verifyEmail(token) {
        this.isLoading = true;

        try {
            const result = await apiService.verifyEmail(token);

            if (result.success) {
                this.dispatchEvent('emailVerified', { message: result.message });
                return { success: true };
            } else {
                this.dispatchEvent('emailVerificationError', { message: result.message });
                return { success: false, message: result.message };
            }
        } catch (error) {
            const message = error.message || 'Email verification failed.';
            this.dispatchEvent('emailVerificationError', { message });
            return { success: false, message };
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email) {
        this.isLoading = true;

        try {
            const result = await apiService.requestPasswordReset(email);
            this.dispatchEvent('passwordResetRequested', {
                message: result.message || 'Password reset email sent if account exists'
            });
            return { success: true };
        } catch (error) {
            const message = error.message || 'Failed to request password reset.';
            this.dispatchEvent('passwordResetError', { message });
            return { success: false, message };
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Verify reset token and reset password
     */
    async resetPassword(token, password, confirmPassword) {
        this.isLoading = true;

        try {
            // First verify the token
            const verify = await apiService.verifyResetToken(token);
            if (!verify.success) {
                throw new Error(verify.message || 'Invalid reset token');
            }

            // Then reset the password
            const result = await apiService.resetPassword(token, password, confirmPassword);

            if (result.success) {
                this.dispatchEvent('passwordReset', { message: result.message });
                return { success: true };
            } else {
                this.dispatchEvent('passwordResetError', { message: result.message });
                return { success: false, message: result.message };
            }
        } catch (error) {
            const message = error.message || 'Password reset failed.';
            this.dispatchEvent('passwordResetError', { message });
            return { success: false, message };
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle logout
     */
    async logout() {
        try {
            await apiService.logout();
            this.user = null;
            this.dispatchEvent('logoutSuccess', {});
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            // Still clear local data even if API call fails
            this.user = null;
            apiService.clearToken();
            return { success: true };
        }
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return apiService.isAuthenticated();
    }

    /**
     * Dispatch custom events for UI updates
     */
    dispatchEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Listen for auth events
     */
    on(eventName, callback) {
        document.addEventListener(eventName, (event) => {
            callback(event.detail);
        });
    }
}

// Create singleton instance
export const auth = new AuthModule();

// Also export as default
export default auth;
