document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentMedications = [];
    let currentPage = 1;
    const medicationsPerPage = 10;
    let currentFilters = {
        status: '',
        type: '',
        search: ''
    };

    // DOM elements
    const medicationsTableBody = document.getElementById('medicationsTableBody');
    const pagination = document.getElementById('medicationPagination');
    const filterForm = document.getElementById('medicationFilterForm');
    const searchInput = document.getElementById('searchInput');
    const addMedicationForm = document.getElementById('addMedicationForm');
    const medicationDetailsModal = new bootstrap.Modal(document.getElementById('medicationDetailsModal'));

    // Initialize the page
    init();

    function init() {
        loadMedications();
        setupEventListeners();
        setDefaultDates();
    }

    function setupEventListeners() {
        // Filter form submission
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            currentFilters = {
                status: document.getElementById('statusFilter').value,
                type: document.getElementById('typeFilter').value,
                search: searchInput.value.trim()
            };
            currentPage = 1;
            loadMedications();
        });

        // Search input
        searchInput.addEventListener('input', debounce(function() {
            currentFilters.search = searchInput.value.trim();
            currentPage = 1;
            loadMedications();
        }, 300));

        // Add medication form submission
        addMedicationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addMedication();
        });
    }

    function setDefaultDates() {
        // Set today's date as default for start date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').value = today;
    }

    function loadMedications() {
        // Build query parameters
        const params = new URLSearchParams();
        params.append('status', currentFilters.status);
        params.append('type', currentFilters.type);
        params.append('search', currentFilters.search);
        params.append('page', currentPage);
        params.append('perPage', medicationsPerPage);

        fetch(`/medications?${params.toString()}`, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
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
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            currentMedications = data.medications;
            renderMedications();
            renderPagination(data.total);
        })
        .catch(error => {
            console.error('Error loading medications:', error);
            showToast('Error loading medications. Please try again.', 'danger');
        });
    }

    function renderMedications() {
        medicationsTableBody.innerHTML = '';
        
        if (currentMedications.length === 0) {
            medicationsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-pills fa-2x mb-2 text-muted"></i>
                        <p class="mb-0">No medications found</p>
                        <button class="btn btn-sm btn-primary mt-2" data-bs-toggle="modal" data-bs-target="#addMedicationModal">
                            <i class="fas fa-plus me-1"></i> Add Your First Medication
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        currentMedications.forEach(med => {
            const row = document.createElement('tr');
            row.dataset.id = med._id;
            row.innerHTML = `
                <td>
                    <span class="medication-type type-${med.type}">${med.name}</span>
                </td>
                <td>${med.dosage}</td>
                <td>${med.frequency}</td>
                <td>${formatDate(med.start_date)}</td>
                <td>${med.end_date ? formatDate(med.end_date) : 'N/A'}</td>
                <td><span class="medication-status status-${med.status}">${formatStatus(med.status)}</span></td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary view-medication" data-id="${med._id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary edit-medication" data-id="${med._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            medicationsTableBody.appendChild(row);
        });

        // Add event listeners to view buttons
        document.querySelectorAll('.view-medication').forEach(btn => {
            btn.addEventListener('click', function() {
                const medicationId = this.dataset.id;
                viewMedicationDetails(medicationId);
            });
        });

        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-medication').forEach(btn => {
            btn.addEventListener('click', function() {
                const medicationId = this.dataset.id;
                editMedication(medicationId);
            });
        });
    }

    function renderPagination(totalMedications) {
        pagination.innerHTML = '';
        const totalPages = Math.ceil(totalMedications / medicationsPerPage);
        
        if (totalPages <= 1) return;

        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>`;
        prevLi.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                loadMedications();
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
                loadMedications();
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
                loadMedications();
            }
        });
        pagination.appendChild(nextLi);
    }

    function viewMedicationDetails(medicationId) {
        const medication = currentMedications.find(m => m._id === medicationId);
        if (!medication) return;

        // Format the details for display
        const doctorInfo = medication.prescribing_doctor ? 
            `Dr. ${medication.prescribing_doctor.last_name}, ${medication.prescribing_doctor.specialization}` : 
            'Not specified';
        
        const endDate = medication.end_date ? formatDate(medication.end_date) : 'Not specified';
        const instructions = medication.instructions || 'No special instructions';

        // Set modal content
        document.getElementById('medicationDetailsTitle').textContent = medication.name;
        document.getElementById('medicationDetailsContent').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <h6>Medication Type</h6>
                        <p><span class="medication-type type-${medication.type}">${formatType(medication.type)}</span></p>
                    </div>
                    <div class="mb-3">
                        <h6>Dosage</h6>
                        <p>${medication.dosage}</p>
                    </div>
                    <div class="mb-3">
                        <h6>Frequency</h6>
                        <p>${medication.frequency}</p>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <h6>Status</h6>
                        <p><span class="medication-status status-${medication.status}">${formatStatus(medication.status)}</span></p>
                    </div>
                    <div class="mb-3">
                        <h6>Start Date</h6>
                        <p>${formatDate(medication.start_date)}</p>
                    </div>
                    <div class="mb-3">
                        <h6>End Date</h6>
                        <p>${endDate}</p>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <h6>Prescribing Doctor</h6>
                <p>${doctorInfo}</p>
            </div>
            <div class="mb-3">
                <h6>Special Instructions</h6>
                <p>${instructions}</p>
            </div>
        `;

        // Set edit and delete buttons
        document.getElementById('editMedicationBtn').dataset.id = medicationId;
        document.getElementById('deleteMedicationBtn').dataset.id = medicationId;

        // Show modal
        medicationDetailsModal.show();
    }

    function addMedication() {
        const formData = new FormData(addMedicationForm);
        const medicationData = {
            name: formData.get('name'),
            type: formData.get('type'),
            dosage: formData.get('dosage'),
            frequency: formData.get('frequency'),
            status: formData.get('status'),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date') || null,
            instructions: formData.get('instructions') || null,
            prescribing_doctor: formData.get('prescribing_doctor') || null,
            patient_id: current_user.id  // Assuming current_user is available
        };

        fetch('/medications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('input[name="csrf_token"]').value
            },
            body: JSON.stringify(medicationData),
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showToast('Medication added successfully', 'success');
                $('#addMedicationModal').modal('hide');
                addMedicationForm.reset();
                loadMedications();
            } else {
                throw new Error(data.message || 'Failed to add medication');
            }
        })
        .catch(error => {
            console.error('Error adding medication:', error);
            showToast(`Error: ${error.message}`, 'danger');
        });
    }

    function editMedication(medicationId) {
        // Implementation for editing medication
        console.log('Edit medication:', medicationId);
        // You would typically open an edit modal with the medication data
    }

    // Helper functions
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-US');
    }

    function formatStatus(status) {
        const statuses = {
            'active': 'Active',
            'completed': 'Completed',
            'on_hold': 'On Hold'
        };
        return statuses[status] || status;
    }

    function formatType(type) {
        const types = {
            'tablet': 'Tablet',
            'capsule': 'Capsule',
            'liquid': 'Liquid',
            'injection': 'Injection',
            'other': 'Other'
        };
        return types[type] || type;
    }

    function showToast(message, type = 'success') {
        // Implement toast notification
        const toast = document.createElement('div');
        toast.className = `toast show align-items-center text-white bg-${type}`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
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