document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentRecords = [];
    let currentPage = 1;
    const recordsPerPage = 10;
    let currentSort = 'date-desc';
    let currentView = 'table';
    let currentFilters = {
        recordType: '',
        dateFrom: '',
        dateTo: '',
        status: '',
        searchQuery: ''
    };

    // DOM elements
    const recordsTableBody = document.getElementById('recordsTableBody');
    const recordsCards = document.getElementById('recordsCards');
    const pagination = document.getElementById('pagination');
    const filterForm = document.getElementById('filterForm');
    const searchInput = document.getElementById('searchInput');
    const recordDetailModal = new bootstrap.Modal(document.getElementById('recordDetailModal'));
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));

    // Initialize the page
    init();

    function init() {
        loadMedicalRecords();
        setupEventListeners();
    }

    function setupEventListeners() {
        // Filter form submission
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            currentFilters = {
                recordType: document.getElementById('recordTypeFilter').value,
                dateFrom: document.getElementById('dateFromFilter').value,
                dateTo: document.getElementById('dateToFilter').value,
                status: document.getElementById('statusFilter').value,
                searchQuery: searchInput.value.trim()
            };
            currentPage = 1;
            loadMedicalRecords();
        });

        // Reset filters
        filterForm.addEventListener('reset', function() {
            currentFilters = {
                recordType: '',
                dateFrom: '',
                dateTo: '',
                status: '',
                searchQuery: ''
            };
            currentPage = 1;
            loadMedicalRecords();
        });

        // Search input
        searchInput.addEventListener('input', debounce(function() {
            currentFilters.searchQuery = searchInput.value.trim();
            currentPage = 1;
            loadMedicalRecords();
        }, 300));

        // Sort options
        document.querySelectorAll('.sort-option').forEach(option => {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                currentSort = this.dataset.sort;
                loadMedicalRecords();
            });
        });

        // View options
        document.querySelectorAll('.view-option').forEach(option => {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelectorAll('.view-option').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');
                
                currentView = this.dataset.view;
                document.getElementById('recordsTable').classList.toggle('d-none', currentView !== 'table');
                document.getElementById('recordsCards').classList.toggle('d-none', currentView !== 'cards');
                renderRecords();
            });
        });

        // Delete record confirmation
        document.getElementById('confirmDeleteBtn').addEventListener('click', deleteRecord);
    }

    function loadMedicalRecords() {
        // Build query parameters
        const params = new URLSearchParams();
        params.append('recordType', currentFilters.recordType);
        params.append('status', currentFilters.status);
        params.append('dateFrom', currentFilters.dateFrom);
        params.append('dateTo', currentFilters.dateTo);
        params.append('searchQuery', currentFilters.searchQuery);
        params.append('sort', currentSort);
        params.append('page', currentPage);
        params.append('perPage', recordsPerPage);

        fetch(`/medical/records?${params.toString()}`, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || `HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            currentRecords = data.records;
            renderRecords();
            renderPagination(data.total);
        })
        .catch(error => {
            console.error('Error loading medical records:', error);
            showToast(`Error: ${error.message}`, 'danger');
            
            // Fallback UI for empty state
            recordsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-danger">
                        Failed to load records: ${error.message}
                    </td>
                </tr>
            `;
            recordsCards.innerHTML = `
                <div class="col-12 text-center py-4 text-danger">
                    Failed to load records: ${error.message}
                </div>
            `;
        });
    }

    function renderRecords() {
        if (currentView === 'table') {
            renderTable();
        } else {
            renderCards();
        }
    }

    function renderTable() {
        recordsTableBody.innerHTML = '';
        
        if (currentRecords.length === 0) {
            recordsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-folder-open fa-2x mb-2 text-muted"></i>
                        <p class="mb-0">No medical records found</p>
                        <a href="{{ url_for('main.add_record') }}" class="btn btn-sm btn-primary mt-2">
                            <i class="fas fa-plus me-1"></i> Add Your First Record
                        </a>
                    </td>
                </tr>
            `;
            return;
        }

        currentRecords.forEach(record => {
            const row = document.createElement('tr');
            row.dataset.id = record._id;
            row.innerHTML = `
                <td>${formatDate(record.date)}</td>
                <td><span class="badge record-type-badge badge-${record.record_type}">${formatRecordType(record.record_type)}</span></td>
                <td>${record.title}</td>
                <td>${record.doctor_info ? `Dr. ${record.doctor_info.last_name}` : 'N/A'}</td>
                <td><span class="badge status-badge status-${record.status}">${formatStatus(record.status)}</span></td>
                <td class="${record.priority === 'high' ? 'priority-high' : record.priority === 'urgent' ? 'priority-urgent' : ''}">${formatPriority(record.priority)}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary view-record" data-id="${record._id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <a href="/patient/edit-record/${record._id}" class="btn btn-sm btn-outline-secondary">
                        <i class="fas fa-edit"></i> Edit
                    </a>
                </td>
            `;
            recordsTableBody.appendChild(row);
        });

        // Add event listeners to view buttons
        document.querySelectorAll('.view-record').forEach(btn => {
            btn.addEventListener('click', function() {
                const recordId = this.dataset.id;
                viewRecordDetails(recordId);
            });
        });
    }

    function renderCards() {
        recordsCards.innerHTML = '';
        
        if (currentRecords.length === 0) {
            recordsCards.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="fas fa-folder-open fa-2x mb-2 text-muted"></i>
                    <p class="mb-0">No medical records found</p>
                    <a href="{{ url_for('main.add_record') }}" class="btn btn-sm btn-primary mt-2">
                        <i class="fas fa-plus me-1"></i> Add Your First Record
                    </a>
                </div>
            `;
            return;
        }

        currentRecords.forEach(record => {
            const cardCol = document.createElement('div');
            cardCol.className = 'col';
            cardCol.innerHTML = `
                <div class="card record-card h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge record-type-badge badge-${record.record_type}">${formatRecordType(record.record_type)}</span>
                            <span class="badge status-badge status-${record.status}">${formatStatus(record.status)}</span>
                        </div>
                        <h5 class="card-title">${record.title}</h5>
                        <p class="card-text"><small class="text-muted">${formatDate(record.date)}</small></p>
                        <p class="card-text text-truncate">${record.description}</p>
                        ${record.doctor_info ? `<p class="card-text"><small>Doctor: Dr. ${record.doctor_info.last_name}</small></p>` : ''}
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span class="${record.priority === 'high' ? 'priority-high' : record.priority === 'urgent' ? 'priority-urgent' : 'text-muted'}">
                                ${formatPriority(record.priority)}
                            </span>
                            <div>
                                <button class="btn btn-sm btn-outline-primary view-record" data-id="${record._id}">
                                    <i class="fas fa-eye me-1"></i> View
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            recordsCards.appendChild(cardCol);
        });

        // Add event listeners to view buttons
        document.querySelectorAll('.view-record').forEach(btn => {
            btn.addEventListener('click', function() {
                const recordId = this.dataset.id;
                viewRecordDetails(recordId);
            });
        });
    }

    function renderPagination(totalRecords) {
        pagination.innerHTML = '';
        const totalPages = Math.ceil(totalRecords / recordsPerPage);
        
        if (totalPages <= 1) return;

        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>`;
        prevLi.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                loadMedicalRecords();
            }
        });
        pagination.appendChild(prevLi);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageLi.addEventListener('click', function(e) {
                e.preventDefault();
                currentPage = i;
                loadMedicalRecords();
            });
            pagination.appendChild(pageLi);
        }

        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>`;
        nextLi.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                loadMedicalRecords();
            }
        });
        pagination.appendChild(nextLi);
    }

    function viewRecordDetails(recordId) {
        fetch(`/medical/records/${recordId}`, {
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(record => {
            // Format the record details for display
            const doctorName = record.doctor_id ? `Dr. ${record.doctor_id.last_name}` : 'Not specified';
            const facility = record.facility || 'Not specified';
            const notes = record.notes || 'No additional notes';
            
            // Build attachments list
            let attachmentsHtml = '';
            if (record.attachments && record.attachments.length > 0) {
                attachmentsHtml = `
                    <div class="mb-3">
                        <h6>Attachments</h6>
                        <div class="d-flex flex-wrap gap-2">
                            ${record.attachments.map(attachment => `
                                <a href="/static/${attachment.filepath}" 
                                   class="badge bg-primary text-white text-decoration-none attachment-badge" 
                                   target="_blank"
                                   data-bs-toggle="tooltip" 
                                   title="${attachment.original_name} (${formatFileSize(attachment.size)})">
                                    <i class="${getFileIconClass(attachment.original_name)} me-1"></i>
                                    ${attachment.original_name.length > 15 ? 
                                      attachment.original_name.substring(0, 15) + '...' : 
                                      attachment.original_name}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Set modal content
            document.getElementById('recordDetailModalLabel').textContent = record.title;
            document.getElementById('recordDetailContent').innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <h6>Record Type</h6>
                            <p><span class="badge record-type-badge badge-${record.record_type}">${formatRecordType(record.record_type)}</span></p>
                        </div>
                        <div class="mb-3">
                            <h6>Date</h6>
                            <p>${formatDate(record.date)}</p>
                        </div>
                        <div class="mb-3">
                            <h6>Doctor</h6>
                            <p>${doctorName}</p>
                        </div>
                        <div class="mb-3">
                            <h6>Facility</h6>
                            <p>${facility}</p>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <h6>Status</h6>
                            <p><span class="badge status-badge status-${record.status}">${formatStatus(record.status)}</span></p>
                        </div>
                        <div class="mb-3">
                            <h6>Priority</h6>
                            <p class="${record.priority === 'high' ? 'priority-high' : record.priority === 'urgent' ? 'priority-urgent' : ''}">
                                ${formatPriority(record.priority)}
                            </p>
                        </div>
                        <div class="mb-3">
                            <h6>Shared with Doctor</h6>
                            <p>${record.share_with_doctor ? 'Yes' : 'No'}</p>
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <h6>Description</h6>
                    <p>${record.description}</p>
                </div>
                ${attachmentsHtml}
                <div class="mb-3">
                    <h6>Additional Notes</h6>
                    <p>${notes}</p>
                </div>
            `;

            // Set edit and delete buttons
            document.getElementById('editRecordBtn').href = `/patient/edit-record/${record._id}`;
            document.getElementById('deleteRecordBtn').dataset.id = record._id;

            // Initialize tooltips
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });

            // Show modal
            recordDetailModal.show();
        })
        .catch(error => {
            console.error('Error loading record details:', error);
            showToast('Error loading record details. Please try again.', 'danger');
        });
    }

    function deleteRecord() {
        const recordId = document.getElementById('deleteRecordBtn').dataset.id;
        
        fetch(`/medical/records/${recordId}`, {
            method: 'DELETE',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete record');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showToast('Record deleted successfully', 'success');
                deleteConfirmModal.hide();
                recordDetailModal.hide();
                loadMedicalRecords();
            } else {
                throw new Error(data.message || 'Failed to delete record');
            }
        })
        .catch(error => {
            console.error('Error deleting record:', error);
            showToast('Error deleting record. Please try again.', 'danger');
        });
    }

    // Helper functions
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    function formatRecordType(type) {
        const types = {
            'diagnosis': 'Diagnosis',
            'lab_result': 'Lab Result',
            'prescription': 'Prescription',
            'procedure': 'Procedure',
            'vaccination': 'Vaccination',
            'other': 'Other'
        };
        return types[type] || type;
    }

    function formatStatus(status) {
        const statuses = {
            'active': 'Active',
            'resolved': 'Resolved',
            'chronic': 'Chronic',
            'monitoring': 'Monitoring'
        };
        return statuses[status] || status;
    }

    function formatPriority(priority) {
        const priorities = {
            'normal': 'Normal',
            'high': 'High',
            'urgent': 'Urgent'
        };
        return priorities[priority] || priority;
    }

    function formatFileSize(bytes) {
        if (typeof bytes !== 'number' || isNaN(bytes)) return '0 Bytes';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getFileIconClass(filename) {
        if (!filename) return 'fas fa-file text-secondary';
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

    function showToast(message, type = 'success') {
        // Check if Toast is available (Bootstrap 5)
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const toastEl = document.createElement('div');
            toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
            toastEl.setAttribute('role', 'alert');
            toastEl.setAttribute('aria-live', 'assertive');
            toastEl.setAttribute('aria-atomic', 'true');
            toastEl.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            `;
            document.body.appendChild(toastEl);
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
            
            // Remove toast after it's hidden
            toastEl.addEventListener('hidden.bs.toast', function() {
                document.body.removeChild(toastEl);
            });
        } else {
            // Fallback to console or alert
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
});