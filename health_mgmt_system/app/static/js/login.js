document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.querySelector('form');
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm me-2';
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-hidden', 'true');
    
    // Add loading spinner on form submission
    loginForm.addEventListener('submit', function() {
        submitBtn.disabled = true;
        submitBtn.insertBefore(spinner, submitBtn.firstChild);
        submitBtn.innerHTML = 'Signing In...';
    });
    
    // Input validation effects
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    emailInput.addEventListener('input', function() {
        if (this.checkValidity()) {
            this.classList.add('is-valid');
            this.classList.remove('is-invalid');
        } else {
            this.classList.add('is-invalid');
            this.classList.remove('is-valid');
        }
    });
    
    passwordInput.addEventListener('input', function() {
        if (this.value.length >= 8) {
            this.classList.add('is-valid');
            this.classList.remove('is-invalid');
        } else {
            this.classList.add('is-invalid');
            this.classList.remove('is-valid');
        }
    });
    
    // Show/hide password functionality
    const showPasswordBtn = document.createElement('button');
    showPasswordBtn.type = 'button';
    showPasswordBtn.className = 'btn btn-sm btn-outline-secondary position-absolute end-0 top-50 translate-middle-y me-3';
    showPasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
    
    const passwordField = document.querySelector('.form-floating:has(#password)');
    passwordField.style.position = 'relative';
    passwordField.appendChild(showPasswordBtn);
    
    showPasswordBtn.addEventListener('click', function() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            this.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            passwordInput.type = 'password';
            this.innerHTML = '<i class="fas fa-eye"></i>';
        }
    });
});