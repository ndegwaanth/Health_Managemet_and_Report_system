document.addEventListener('DOMContentLoaded', function() {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('recordDate').value = today;

    // File upload handling
    const fileUpload = document.getElementById('fileUpload');
    const filePreview = document.getElementById('filePreview');
    const fileList = document.getElementById('fileList');
    const sizeError = document.getElementById('sizeError');
    const maxFileSize = {{ max_file_size }}; // From Flask config

    fileUpload.addEventListener('change', function() {
        fileList.innerHTML = '';
        sizeError.classList.add('d-none');
        let totalSize = 0;
        let hasInvalidFiles = false;

        if (this.files.length > 0) {
            filePreview.classList.remove('d-none');
            
            for (const file of this.files) {
                totalSize += file.size;
                
                // Check individual file size
                if (file.size > maxFileSize) {
                    hasInvalidFiles = true;
                    sizeError.classList.remove('d-none');
                    sizeError.textContent = `File "${file.name}" exceeds maximum size limit`;
                    continue;
                }

                // Check file extension
                const fileName = file.name.toLowerCase();
                const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.doc', '.docx'];
                const isValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
                
                if (!isValidExtension) {
                    hasInvalidFiles = true;
                    sizeError.classList.remove('d-none');
                    sizeError.textContent = `File "${file.name}" has invalid extension`;
                    continue;
                }

                const listItem = document.createElement('li');
                listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                
                const fileInfo = document.createElement('div');
                fileInfo.className = 'd-flex align-items-center';
                
                const fileIcon = document.createElement('i');
                fileIcon.className = getFileIconClass(file.name);
                fileInfo.appendChild(fileIcon);
                
                const fileNameSpan = document.createElement('span');
                fileNameSpan.className = 'ms-2 file-item-name';
                fileNameSpan.textContent = file.name;
                fileInfo.appendChild(fileNameSpan);
                
                const fileSize = document.createElement('span');
                fileSize.className = 'badge bg-secondary rounded-pill';
                fileSize.textContent = formatFileSize(file.size);
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn btn-sm btn-outline-danger';
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                removeBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    listItem.remove();
                    if (fileList.children.length === 0) {
                        filePreview.classList.add('d-none');
                    }
                });
                
                listItem.appendChild(fileInfo);
                listItem.appendChild(fileSize);
                listItem.appendChild(removeBtn);
                fileList.appendChild(listItem);
            }
            
            // Check total size
            if (totalSize > maxFileSize * 3) { // Allow some buffer for multiple files
                hasInvalidFiles = true;
                sizeError.classList.remove('d-none');
                sizeError.textContent = 'Total size of all files exceeds limit';
            }
            
            if (hasInvalidFiles) {
                document.getElementById('submitBtn').disabled = true;
            } else {
                document.getElementById('submitBtn').disabled = false;
            }
        } else {
            filePreview.classList.add('d-none');
        }
    });

    // Form submission handling
    const recordForm = document.getElementById('recordForm');
    if (recordForm) {
        recordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validate form
            if (!this.checkValidity()) {
                e.stopPropagation();
                this.classList.add('was-validated');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            
            // Show loading state
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Saving...';
            
            // Create FormData object
            const formData = new FormData(this);
            
            // Get CSRF token from meta tag
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            
            // Submit form via AJAX
            fetch(this.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': csrfToken  // Add CSRF token to headers
                }
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Show success modal
                    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
                    document.getElementById('successMessage').textContent = data.message || 'Record added successfully!';
                    successModal.show();
                    
                    // Redirect after modal is closed
                    document.getElementById('successModal').addEventListener('hidden.bs.modal', function() {
                        window.location.href = data.redirect || '/medical-records';
                    });
                } else {
                    throw new Error(data.message || 'Error saving record');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i> Save Record';
            });
        });
    }

    // Helper function to format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Helper function to get file icon class
    function getFileIconClass(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch(ext) {
            case 'pdf': return 'fas fa-file-pdf text-danger';
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif': return 'fas fa-file-image text-primary';
            case 'doc':
            case 'docx': return 'fas fa-file-word text-primary';
            default: return 'fas fa-file text-secondary';
        }
    }
});