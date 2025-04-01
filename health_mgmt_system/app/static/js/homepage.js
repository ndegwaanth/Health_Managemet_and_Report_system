document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    const healthMetricsCtx = document.getElementById('healthMetricsChart').getContext('2d');
    const expensesCtx = document.getElementById('expensesChart').getContext('2d');

    // Health Metrics Chart
    const healthMetricsChart = new Chart(healthMetricsCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
                {
                    label: 'Blood Pressure (Systolic)',
                    data: [120, 118, 122, 125, 130, 128],
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Blood Pressure (Diastolic)',
                    data: [80, 78, 82, 85, 88, 84],
                    borderColor: '#fd7e14',
                    backgroundColor: 'rgba(253, 126, 20, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Heart Rate (bpm)',
                    data: [72, 70, 68, 75, 78, 74],
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });

    // Expenses Chart
    const expensesChart = new Chart(expensesCtx, {
        type: 'doughnut',
        data: {
            labels: ['Doctor Visits', 'Medications', 'Lab Tests', 'Procedures', 'Insurance'],
            datasets: [{
                data: [300, 500, 200, 150, 100],
                backgroundColor: [
                    '#0d6efd',
                    '#20c997',
                    '#ffc107',
                    '#fd7e14',
                    '#6f42c1'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += '$' + context.raw;
                            return label;
                        }
                    }
                }
            }
        }
    });

    // Toggle sidebar on mobile
    const sidebarToggle = document.querySelector('[data-bs-toggle="collapse"]');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            document.body.classList.toggle('sidebar-collapsed');
        });
    }

    // Mark notifications as read
    const notifications = document.querySelectorAll('.list-group-item-action');
    notifications.forEach(notification => {
        notification.addEventListener('click', function() {
            this.classList.remove('fw-bold');
        });
    });
});