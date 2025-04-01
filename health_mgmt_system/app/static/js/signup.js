document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');
    const passwordMatchText = document.getElementById('password-match-text');
    
    // Password strength indicators
    const lengthIcon = document.getElementById('length-icon');
    const uppercaseIcon = document.getElementById('uppercase-icon');
    const lowercaseIcon = document.getElementById('lowercase-icon');
    const numberIcon = document.getElementById('number-icon');
    const specialIcon = document.getElementById('special-icon');
    
    // Check password strength in real-time
    passwordInput.addEventListener('input', function() {
        const password = passwordInput.value;
        let strength = 0;
        
        // Check length
        if (password.length >= 8) {
            strength += 20;
            lengthIcon.className = 'fas fa-circle-check text-success me-1';
        } else {
            lengthIcon.className = 'fas fa-circle-xmark text-danger me-1';
        }
        
        // Check uppercase letters
        if (/[A-Z]/.test(password)) {
            strength += 20;
            uppercaseIcon.className = 'fas fa-circle-check text-success me-1';
        } else {
            uppercaseIcon.className = 'fas fa-circle-xmark text-danger me-1';
        }
        
        // Check lowercase letters
        if (/[a-z]/.test(password)) {
            strength += 20;
            lowercaseIcon.className = 'fas fa-circle-check text-success me-1';
        } else {
            lowercaseIcon.className = 'fas fa-circle-xmark text-danger me-1';
        }
        
        // Check numbers
        if (/[0-9]/.test(password)) {
            strength += 20;
            numberIcon.className = 'fas fa-circle-check text-success me-1';
        } else {
            numberIcon.className = 'fas fa-circle-xmark text-danger me-1';
        }
        
        // Check special characters
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            strength += 20;
            specialIcon.className = 'fas fa-circle-check text-success me-1';
        } else {
            specialIcon.className = 'fas fa-circle-xmark text-danger me-1';
        }
        
        // Update strength bar and text
        strengthBar.style.width = strength + '%';
        
        if (strength < 40) {
            strengthBar.className = 'progress-bar bg-danger';
            strengthText.textContent = 'Password Strength: Weak';
        } else if (strength < 80) {
            strengthBar.className = 'progress-bar bg-warning';
            strengthText.textContent = 'Password Strength: Moderate';
        } else {
            strengthBar.className = 'progress-bar bg-success';
            strengthText.textContent = 'Password Strength: Strong';
        }
    });
    
    // Check password match in real-time
    confirmPasswordInput.addEventListener('input', function() {
        if (passwordInput.value === confirmPasswordInput.value && passwordInput.value !== '') {
            passwordMatchText.innerHTML = '<i class="fas fa-circle-check text-success me-1"></i> Passwords match';
        } else {
            passwordMatchText.innerHTML = '<i class="fas fa-circle-xmark text-danger me-1"></i> Passwords do not match';
        }
    });
});