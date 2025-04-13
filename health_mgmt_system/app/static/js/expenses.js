document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentPage = 1;
    let perPage = 10;
    let currentFilters = {};
    let currentExpenseId = null;
    
    // Initialize the page
    initExpenses();
    
    // Initialize event listeners
    document.getElementById('filterForm').addEventListener('submit', function(e) {
        e.preventDefault();
        currentPage = 1;
        loadExpenses();
    });
    
    document.getElementById('filterForm').addEventListener('reset', function() {
        currentPage = 1;
        currentFilters = {};
        loadExpenses();
    });
    
    document.getElementById('addExpenseForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addExpense();
    });
    
    document.getElementById('editExpenseBtn').addEventListener('click', function() {
        editExpense(currentExpenseId);
    });
    
    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        deleteExpense(currentExpenseId);
    });
    
    // Export buttons
    document.getElementById('exportPDF').addEventListener('click', function() {
        exportExpenses('pdf');
    });
    
    document.getElementById('exportCSV').addEventListener('click', function() {
        exportExpenses('csv');
    });
    
    document.getElementById('exportExcel').addEventListener('click', function() {
        exportExpenses('excel');
    });
    
    // Initialize the page
    function initExpenses() {
        // Set default date filters to current month
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        document.getElementById('dateFromFilter').valueAsDate = firstDay;
        document.getElementById('dateToFilter').valueAsDate = lastDay;
        
        // Load initial data
        loadExpenses();
    }
    
    // Load expenses with current filters
    function loadExpenses() {
        // Get filter values
        currentFilters = {
            category: document.getElementById('categoryFilter').value,
            status: document.getElementById('statusFilter').value,
            date_from: document.getElementById('dateFromFilter').value,
            date_to: document.getElementById('dateToFilter').value,
            search: document.getElementById('searchFilter').value,
            sort: document.getElementById('sortFilter').value,
            page: currentPage,
            perPage: perPage
        };
        
        // Build query string
        const queryParams = new URLSearchParams();
        for (const key in currentFilters) {
            if (currentFilters[key]) {
                queryParams.append(key, currentFilters[key]);
            }
        }
        
        // Show loading state
        document.getElementById('expensesTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>
        `;
        
        // Fetch data from server
        fetch(`/expenses?${queryParams.toString()}`, {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showAlert('danger', data.error);
                return;
            }
            
            // Update summary cards
            updateSummaryCards(data.expenses);
            
            // Render expenses table
            renderExpensesTable(data.expenses);
            
            // Render pagination
            renderPagination(data.pagination);
        })
        .catch(error => {
            console.error('Error loading expenses:', error);
            showAlert('danger', 'Failed to load expenses. Please try again.');
        });
    }
    
    // Update summary cards with totals
    function updateSummaryCards(expenses) {
        let totalExpenses = 0;
        let totalReimbursed = 0;
        let pendingClaims = 0;
        
        expenses.forEach(expense => {
            totalExpenses += parseFloat(expense.amount);
            totalReimbursed += parseFloat(expense.reimbursement_amount || 0);
            
            if (expense.status === 'pending') {
                pendingClaims++;
            }
        });
        
        document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
        document.getElementById('totalReimbursed').textContent = `$${totalReimbursed.toFixed(2)}`;
        document.getElementById('pendingClaims').textContent = pendingClaims;
        document.getElementById('outOfPocket').textContent = `$${(totalExpenses - totalReimbursed).toFixed(2)}`;
    }
    
    // Render expenses table
    function renderExpensesTable(expenses) {
        const tbody = document.getElementById('expensesTableBody');
        
        if (expenses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">No expenses found matching your criteria.</td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        expenses.forEach(expense => {
            const date = new Date(expense.date);
            const formattedDate = date.toLocaleDateString();
            
            // Determine status badge color
            let statusClass = 'bg-secondary';
            if (expense.status === 'reimbursed') statusClass = 'bg-success';
            else if (expense.status === 'denied') statusClass = 'bg-danger';
            else if (expense.status === 'partially_reimbursed') statusClass = 'bg-warning';
            
            html += `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${expense.description}</td>
                    <td>${formatCategory(expense.category)}</td>
                    <td>$${parseFloat(expense.amount).toFixed(2)}</td>
                    <td><span class="badge ${statusClass}">${formatStatus(expense.status)}</span></td>
                    <td>$${parseFloat(expense.reimbursement_amount || 0).toFixed(2)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-expense" data-id="${expense._id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary edit-expense" data-id="${expense._id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-expense" data-id="${expense._id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Add event listeners to action buttons
        document.querySelectorAll('.view-expense').forEach(btn => {
            btn.addEventListener('click', function() {
                viewExpense(this.dataset.id);
            });
        });
        
        document.querySelectorAll('.edit-expense').forEach(btn => {
            btn.addEventListener('click', function() {
                editExpense(this.dataset.id);
            });
        });
        
        document.querySelectorAll('.delete-expense').forEach(btn => {
            btn.addEventListener('click', function() {
                confirmDeleteExpense(this.dataset.id);
            });
        });
    }
    
    // Render pagination controls
    function renderPagination(pagination) {
        const paginationControls = document.getElementById('paginationControls');
        
        if (pagination.total_pages <= 1) {
            paginationControls.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;
        
        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(pagination.total_pages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">1</a>
                </li>
                ${startPage > 2 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
            `;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        if (endPage < pagination.total_pages) {
            html += `
                ${endPage < pagination.total_pages - 1 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${pagination.total_pages}">${pagination.total_pages}</a>
                </li>
            `;
        }
        
        // Next button
        html += `
            <li class="page-item ${currentPage === pagination.total_pages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;
        
        paginationControls.innerHTML = html;
        
        // Add event listeners to pagination links
        document.querySelectorAll('.page-link').forEach(link => {
            if (!link.parentElement.classList.contains('disabled')) {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    currentPage = parseInt(this.dataset.page);
                    loadExpenses();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }
        });
    }
    
    // View expense details
    function viewExpense(expenseId) {
        fetch(`/expenses/${expenseId}`, {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(expense => {
            const date = new Date(expense.date);
            const formattedDate = date.toLocaleDateString();
            const createdDate = new Date(expense.created_at);
            const formattedCreatedDate = createdDate.toLocaleString();
            
            let insuranceInfo = 'None';
            if (expense.insurance_provider) {
                insuranceInfo = `${expense.insurance_provider.name} (${expense.insurance_provider.plan_name})`;
            }
            
            let statusClass = 'bg-secondary';
            if (expense.status === 'reimbursed') statusClass = 'bg-success';
            else if (expense.status === 'denied') statusClass = 'bg-danger';
            else if (expense.status === 'partially_reimbursed') statusClass = 'bg-warning';
            
            const html = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>Basic Information</h6>
                        <dl class="row">
                            <dt class="col-sm-4">Date</dt>
                            <dd class="col-sm-8">${formattedDate}</dd>
                            
                            <dt class="col-sm-4">Category</dt>
                            <dd class="col-sm-8">${formatCategory(expense.category)}</dd>
                            
                            <dt class="col-sm-4">Amount</dt>
                            <dd class="col-sm-8">$${parseFloat(expense.amount).toFixed(2)}</dd>
                            
                            <dt class="col-sm-4">Status</dt>
                            <dd class="col-sm-8"><span class="badge ${statusClass}">${formatStatus(expense.status)}</span></dd>
                        </dl>
                    </div>
                    <div class="col-md-6">
                        <h6>Additional Information</h6>
                        <dl class="row">
                            <dt class="col-sm-4">Provider</dt>
                            <dd class="col-sm-8">${expense.provider || 'Not specified'}</dd>
                            
                            <dt class="col-sm-4">Insurance</dt>
                            <dd class="col-sm-8">${insuranceInfo}</dd>
                            
                            <dt class="col-sm-4">Claim Submitted</dt>
                            <dd class="col-sm-8">${expense.claim_submitted ? 'Yes' : 'No'}</dd>
                            
                            <dt class="col-sm-4">Reimbursement</dt>
                            <dd class="col-sm-8">$${parseFloat(expense.reimbursement_amount || 0).toFixed(2)}</dd>
                        </dl>
                    </div>
                </div>
                
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>Description</h6>
                        <p>${expense.description}</p>
                    </div>
                </div>
                
                ${expense.notes ? `
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>Notes</h6>
                        <p>${expense.notes}</p>
                    </div>
                </div>
                ` : ''}
                
                <div class="row mt-3">
                    <div class="col-12">
                        <small class="text-muted">Record created: ${formattedCreatedDate}</small>
                    </div>
                </div>
            `;
            
            document.getElementById('expenseDetailContent').innerHTML = html;
            currentExpenseId = expenseId;
            
            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('expenseDetailModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error loading expense:', error);
            showAlert('danger', 'Failed to load expense details. Please try again.');
        });
    }
    
    // Add new expense
    function addExpense() {
        const form = document.getElementById('addExpenseForm');
        const formData = new FormData(form);
        
        // Convert FormData to JSON object
        const jsonData = {};
        formData.forEach((value, key) => {
            // Handle checkboxes
            if (key === 'claim_submitted') {
                jsonData[key] = document.getElementById('expenseClaimSubmitted').checked;
            } else {
                jsonData[key] = value;
            }
        });

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Saving...
        `;
        submitBtn.disabled = true;

        // Send request
        fetch('/expenses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(jsonData)
        })
        .then(response => {
            // First check if the response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Show success message
            showAlert('success', data.message || 'Expense added successfully!');
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addExpenseModal'));
            modal.hide();
            form.reset();
            
            // Reload expenses
            loadExpenses();
        })
        .catch(error => {
            console.error('Error adding expense:', error);
            showAlert('danger', error.message || 'Failed to add expense. Please try again.');
        })
        .finally(() => {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        });
    }
    
    // Edit expense
    function editExpense(expenseId) {
        // In a real implementation, you would fetch the expense data
        // and populate a form similar to the add form, then submit changes
        alert('Edit functionality would be implemented here for expense ID: ' + expenseId);
    }
    
    // Confirm delete expense
    function confirmDeleteExpense(expenseId) {
        currentExpenseId = expenseId;
        const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        modal.show();
    }
    
    // Delete expense
    function deleteExpense(expenseId) {
        fetch(`/expenses/${expenseId}`, {
            method: 'DELETE',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Show success message
            showAlert('success', 'Expense deleted successfully!');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
            modal.hide();
            
            // Reload expenses
            loadExpenses();
        })
        .catch(error => {
            console.error('Error deleting expense:', error);
            showAlert('danger', error.message || 'Failed to delete expense. Please try again.');
        });
    }
    
    // Export expenses
    function exportExpenses(format) {
        // Build query string with current filters
        const queryParams = new URLSearchParams();
        for (const key in currentFilters) {
            if (currentFilters[key] && key !== 'page' && key !== 'perPage') {
                queryParams.append(key, currentFilters[key]);
            }
        }
        
        // Trigger download
        window.location.href = `/expenses/export?${queryParams.toString()}&format=${format}`;
    }
    
    // Helper functions
    function formatCategory(category) {
        const categories = {
            'consultation': 'Consultation',
            'medication': 'Medication',
            'lab_test': 'Lab Test',
            'procedure': 'Procedure',
            'hospitalization': 'Hospitalization',
            'other': 'Other'
        };
        return categories[category] || category;
    }
    
    function formatStatus(status) {
        const statuses = {
            'pending': 'Pending',
            'reimbursed': 'Reimbursed',
            'denied': 'Denied',
            'partially_reimbursed': 'Partially Reimbursed'
        };
        return statuses[status] || status;
    }
    
    function showAlert(type, message) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.role = 'alert';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        const container = document.querySelector('.container-fluid');
        container.prepend(alert);
        
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 150);
        }, 5000);
    }
});