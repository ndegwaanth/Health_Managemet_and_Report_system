document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    const healthTrendsCtx = document.getElementById('healthTrendsChart').getContext('2d');
    
    // Sample data - replace with actual data from your backend
    const healthTrendsChart = new Chart(healthTrendsCtx, {
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

    // Add event listener for the modal to fetch data when opened
    const addMetricModal = document.getElementById('addMetricModal');
    if (addMetricModal) {
        addMetricModal.addEventListener('show.bs.modal', function() {
            // Set today's date as default
            const today = new Date().toISOString().split('T')[0];
            document.querySelector('#addMetricModal input[name="date"]').value = today;
        });
    }

    // Delete metric button handlers
    document.querySelectorAll('.btn-outline-danger').forEach(button => {
        button.addEventListener('click', function() {
            const metricId = this.dataset.metricId;
            if (confirm('Are you sure you want to delete this metric?')) {
                fetch(`/delete-metric/${metricId}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.closest('tr').remove();
                    }
                });
            }
        });
    });
});