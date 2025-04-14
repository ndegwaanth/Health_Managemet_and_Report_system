document.addEventListener('DOMContentLoaded', function() {
    // Set claim amount when expense is selected
    const expenseSelect = document.getElementById('expenseSelect');
    const claimAmount = document.getElementById('claimAmount');
    
    if (expenseSelect && claimAmount) {
        expenseSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.dataset.amount) {
                claimAmount.value = parseFloat(selectedOption.dataset.amount).toFixed(2);
            }
        });
    }
    
    // File upload preview
    const fileInput = document.getElementById('claimFiles');
    const filePreview = document.getElementById('filePreview');
    
    if (fileInput && filePreview) {
        fileInput.addEventListener('change', function() {
            filePreview.innerHTML = '';
            
            for (const file of this.files) {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-preview-item';
                
                // Determine icon based on file type
                let icon = 'fa-file';
                if (file.type.includes('image')) {
                    icon = 'fa-image';
                } else if (file.type.includes('pdf')) {
                    icon = 'fa-file-pdf';
                }
                
                fileItem.innerHTML = `
                    <i class="fas ${icon} text-primary"></i>
                    <span class="file-name">${file.name}</span>
                `;
                
                filePreview.appendChild(fileItem);
            }
        });
    }
    
    // Form submission handling
    const claimForm = document.getElementById('claimForm');
    if (claimForm) {
        claimForm.addEventListener('submit', function(e) {
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Submitting...';
            submitBtn.disabled = true;
        });
    }
});