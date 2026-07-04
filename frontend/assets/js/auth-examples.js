/**
 * Example usage of Auth Module
 * Include this in your HTML pages to handle authentication flows
 */

// Example 1: Login Form
class LoginForm {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.submitBtn = document.getElementById('submitBtn');
        this.errorMessage = document.getElementById('errorMessage');

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Listen for auth events
        auth.on('loginSuccess', (detail) => {
            console.log('Login successful for user:', detail.user);
            // Redirect to dashboard
            window.location.href = 'pages/dashboard/dashboard.html';
        });

        auth.on('loginError', (detail) => {
            this.showError(detail.message);
        });

        auth.on('loadingStateChanged', (detail) => {
            this.submitBtn.disabled = detail.isLoading;
            this.submitBtn.textContent = detail.isLoading ? 'Logging in...' : 'Login';
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        const email = this.emailInput.value;
        const password = this.passwordInput.value;

        const result = await auth.login(email, password);
        if (!result.success) {
            this.showError(result.message);
        }
    }

    showError(message) {
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
            this.errorMessage.style.display = 'block';
        }
    }
}

// Example 2: Registration Form
class RegisterForm {
    constructor() {
        this.form = document.getElementById('registerForm');
        this.nameInput = document.getElementById('name');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.confirmPasswordInput = document.getElementById('confirmPassword');
        this.submitBtn = document.getElementById('submitBtn');
        this.successMessage = document.getElementById('successMessage');
        this.errorMessage = document.getElementById('errorMessage');

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        auth.on('registrationSuccess', (detail) => {
            this.showSuccess('Registration successful! Please check your email to verify your account.');
            this.form.reset();
            // Redirect after 3 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        });

        auth.on('registrationError', (detail) => {
            this.showError(detail.message);
        });

        auth.on('loadingStateChanged', (detail) => {
            this.submitBtn.disabled = detail.isLoading;
            this.submitBtn.textContent = detail.isLoading ? 'Registering...' : 'Register';
        });
    }

    async handleSubmit(e) {
        e.preventDefault();

        const name = this.nameInput.value;
        const email = this.emailInput.value;
        const password = this.passwordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        const result = await auth.register(name, email, password, confirmPassword);
        if (!result.success) {
            this.showError(result.message);
        }
    }

    showError(message) {
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
            this.errorMessage.style.display = 'block';
        }
        if (this.successMessage) {
            this.successMessage.style.display = 'none';
        }
    }

    showSuccess(message) {
        if (this.successMessage) {
            this.successMessage.textContent = message;
            this.successMessage.style.display = 'block';
        }
        if (this.errorMessage) {
            this.errorMessage.style.display = 'none';
        }
    }
}

// Example 3: Protected Page (Dashboard)
class ProtectedPage {
    constructor() {
        this.checkAuth();
    }

    checkAuth() {
        // Check if user is authenticated on protected pages
        if (!auth.isAuthenticated()) {
            console.log('User not authenticated, redirecting to login');
            window.location.href = 'pages/auth/login.html';
            return;
        }

        const user = auth.getCurrentUser();
        if (user) {
            console.log('Welcome back, ' + user.name);
            // Display user info
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = user.name;
            }
        }
    }
}

// Example 4: Email Verification Page
class EmailVerificationPage {
    constructor() {
        this.verifyEmail();
    }

    async verifyEmail() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
            this.showError('No verification token provided');
            return;
        }

        const result = await auth.verifyEmail(token);

        if (result.success) {
            this.showSuccess('Email verified successfully! You can now log in.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } else {
            this.showError(result.message || 'Email verification failed');
        }
    }

    showError(message) {
        const messagesEl = document.getElementById('messages');
        if (messagesEl) {
            messagesEl.innerHTML = `<div class="alert alert-danger">${message}</div>`;
        }
    }

    showSuccess(message) {
        const messagesEl = document.getElementById('messages');
        if (messagesEl) {
            messagesEl.innerHTML = `<div class="alert alert-success">${message}</div>`;
        }
    }
}

// Example 5: Password Reset Request
class PasswordResetRequest {
    constructor() {
        this.form = document.getElementById('resetRequestForm');
        this.emailInput = document.getElementById('email');
        this.submitBtn = document.getElementById('submitBtn');
        this.message = document.getElementById('message');

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        auth.on('passwordResetRequested', (detail) => {
            this.showSuccess(detail.message);
        });

        auth.on('passwordResetError', (detail) => {
            this.showError(detail.message);
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        const email = this.emailInput.value;
        await auth.requestPasswordReset(email);
    }

    showError(message) {
        if (this.message) {
            this.message.textContent = message;
            this.message.className = 'alert alert-danger';
            this.message.style.display = 'block';
        }
    }

    showSuccess(message) {
        if (this.message) {
            this.message.textContent = message;
            this.message.className = 'alert alert-success';
            this.message.style.display = 'block';
        }
    }
}

// Example 6: Password Reset Form
class PasswordResetForm {
    constructor() {
        this.form = document.getElementById('resetForm');
        this.passwordInput = document.getElementById('password');
        this.confirmPasswordInput = document.getElementById('confirmPassword');
        this.submitBtn = document.getElementById('submitBtn');
        this.message = document.getElementById('message');

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        auth.on('passwordReset', (detail) => {
            this.showSuccess('Password reset successful! Redirecting to login...');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        });

        auth.on('passwordResetError', (detail) => {
            this.showError(detail.message);
        });
    }

    async handleSubmit(e) {
        e.preventDefault();

        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
            this.showError('No reset token provided');
            return;
        }

        const password = this.passwordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        await auth.resetPassword(token, password, confirmPassword);
    }

    showError(message) {
        if (this.message) {
            this.message.textContent = message;
            this.message.className = 'alert alert-danger';
            this.message.style.display = 'block';
        }
    }

    showSuccess(message) {
        if (this.message) {
            this.message.textContent = message;
            this.message.className = 'alert alert-success';
            this.message.style.display = 'block';
        }
    }
}

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname;

    if (currentPage.includes('login.html')) {
        new LoginForm();
    } else if (currentPage.includes('register.html')) {
        new RegisterForm();
    } else if (currentPage.includes('verify-email.html')) {
        new EmailVerificationPage();
    } else if (currentPage.includes('forgot_password.html')) {
        new PasswordResetRequest();
    } else if (currentPage.includes('reset-password.html')) {
        new PasswordResetForm();
    } else if (currentPage.includes('dashboard')) {
        new ProtectedPage();
    }
});
