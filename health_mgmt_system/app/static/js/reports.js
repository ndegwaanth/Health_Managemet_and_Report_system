document.addEventListener('DOMContentLoaded', function() {
    // Initialize elements only if they exist
    const categoryChartEl = document.getElementById('categoryChart');
    const monthlyTrendChartEl = document.getElementById('monthlyTrendChart');
    const exportPdfBtn = document.getElementById('exportPdf');
    const exportExcelBtn = document.getElementById('exportExcel');

    // Initialize charts if elements exist
    if (categoryChartEl || monthlyTrendChartEl) {
        initializeCharts();
    }

    // Set up export buttons with null checks
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportToPdf);
    }
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }
});

function initializeCharts() {
    // Category Chart - only initialize if element exists
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        try {
            const categoryLabels = JSON.parse(categoryCtx.dataset.labels || '[]');
            const categoryValues = JSON.parse(categoryCtx.dataset.values || '[]');

            if (categoryLabels.length > 0 && categoryValues.length > 0) {
                new Chart(categoryCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: categoryLabels,
                        datasets: [{
                            data: categoryValues,
                            backgroundColor: [
                                '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', 
                                '#e74a3b', '#858796', '#5a5c69', '#2e59d9'
                            ],
                            hoverBackgroundColor: [
                                '#2e59d9', '#17a673', '#2c9faf', '#dda20a',
                                '#be2617', '#656776', '#3a3d4d', '#1c3caa'
                            ],
                            hoverBorderColor: "rgba(234, 236, 244, 1)",
                        }]
                    },
                    options: getDoughnutChartOptions()
                });
            }
        } catch (error) {
            console.error('Error initializing category chart:', error);
        }
    }

    // Monthly Trend Chart - only initialize if element exists
    const monthlyCtx = document.getElementById('monthlyTrendChart');
    if (monthlyCtx) {
        try {
            const monthlyLabels = JSON.parse(monthlyCtx.dataset.labels || '[]');
            const monthlyValues = JSON.parse(monthlyCtx.dataset.values || '[]');

            if (monthlyLabels.length > 0 && monthlyValues.length > 0) {
                new Chart(monthlyCtx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: monthlyLabels,
                        datasets: [{
                            label: "Monthly Expenses",
                            backgroundColor: "#4e73df",
                            hoverBackgroundColor: "#2e59d9",
                            borderColor: "#4e73df",
                            data: monthlyValues,
                        }]
                    },
                    options: getBarChartOptions()
                });
            }
        } catch (error) {
            console.error('Error initializing monthly trend chart:', error);
        }
    }
}

function getDoughnutChartOptions() {
    return {
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        let value = context.raw || 0;
                        let total = context.dataset.data.reduce((a, b) => a + b, 0);
                        let percentage = Math.round((value / total) * 100);
                        return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                    }
                }
            },
            legend: {
                position: 'right',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 12
                    }
                }
            }
        },
        cutout: '70%'
    };
}

function getBarChartOptions() {
    return {
        maintainAspectRatio: false,
        responsive: true,
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Month',
                    font: {
                        weight: 'bold'
                    }
                },
                grid: {
                    display: false
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Amount ($)',
                    font: {
                        weight: 'bold'
                    }
                },
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return '$' + value.toLocaleString();
                    }
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `$${context.raw.toFixed(2)}`;
                    }
                }
            },
            legend: {
                display: false
            }
        }
    };
}

async function exportToPdf() {
    try {
        // Show loading state
        const btn = document.getElementById('exportPdf');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Generating...';
        btn.disabled = true;

        // Dynamic import of jsPDF to reduce initial bundle size
        const { jsPDF } = await import('jspdf');
        await import('jspdf-autotable');

        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(18);
        doc.text('Medical Expense Report', 105, 20, { align: 'center' });
        
        // Add date
        doc.setFontSize(12);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });
        
        // Get chart images
        const categoryChartImg = await getChartImage('categoryChart');
        const monthlyChartImg = await getChartImage('monthlyTrendChart');
        
        // Add charts to PDF
        if (categoryChartImg) {
            doc.addImage(categoryChartImg, 'PNG', 15, 40, 80, 80);
        }
        if (monthlyChartImg) {
            doc.addImage(monthlyChartImg, 'PNG', 105, 40, 80, 80);
        }
        
        // Add expense data table
        const expenses = JSON.parse(document.getElementById('expenseData').dataset.expenses || '[]');
        if (expenses.length > 0) {
            doc.autoTable({
                startY: 130,
                head: [['Date', 'Category', 'Description', 'Amount', 'Status']],
                body: expenses.map(expense => [
                    expense.date,
                    expense.category,
                    expense.description,
                    '$' + parseFloat(expense.amount).toFixed(2),
                    expense.status
                ]),
                theme: 'grid',
                headStyles: {
                    fillColor: [78, 115, 223],
                    textColor: 255
                }
            });
        }
        
        // Save the PDF
        doc.save('medical_expense_report.pdf');
        
    } catch (error) {
        console.error('PDF export failed:', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        // Reset button state
        const btn = document.getElementById('exportPdf');
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

async function exportToExcel() {
    try {
        // Show loading state
        const btn = document.getElementById('exportExcel');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Generating...';
        btn.disabled = true;

        // Dynamic import of SheetJS to reduce initial bundle size
        const XLSX = await import('xlsx');

        // Create a new workbook
        const workbook = XLSX.utils.book_new();
        
        // Add expenses worksheet
        const expenses = JSON.parse(document.getElementById('expenseData').dataset.expenses || '[]');
        if (expenses.length > 0) {
            const expenseWS = XLSX.utils.json_to_sheet(expenses.map(expense => ({
                Date: expense.date,
                Category: expense.category,
                Description: expense.description,
                Amount: parseFloat(expense.amount),
                Status: expense.status,
                Provider: expense.provider || '',
                'Reimbursed Amount': parseFloat(expense.reimbursement_amount || 0)
            })));
            XLSX.utils.book_append_sheet(workbook, expenseWS, "Expenses");
        }
        
        // Add summary worksheet
        const summaryData = [
            ['Total Expenses', parseFloat(document.getElementById('totalExpenses').textContent.replace('$', '')) || 0],
            ['Average Monthly', parseFloat(document.getElementById('totalExpenses').textContent.replace('$', '')) / 12 || 0],
            ['Categories', document.getElementById('expenseData').dataset.categoryCount || 0]
        ];
        const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summaryWS, "Summary");
        
        // Generate and download the Excel file
        XLSX.writeFile(workbook, "medical_expenses.xlsx");
        
    } catch (error) {
        console.error('Excel export failed:', error);
        alert('Failed to generate Excel file. Please try again.');
    } finally {
        // Reset button state
        const btn = document.getElementById('exportExcel');
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

async function getChartImage(chartId) {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) return null;

    // Get the Chart.js instance
    const chart = Chart.getChart(chartElement);
    if (!chart) return null;

    // Create a canvas to render the chart
    const canvas = document.createElement('canvas');
    canvas.width = chart.width;
    canvas.height = chart.height;
    
    // Clone the chart to the new canvas
    const tempChart = new Chart(canvas.getContext('2d'), {
        type: chart.config.type,
        data: chart.config.data,
        options: chart.config.options
    });
    
    // Get the image data URL
    const imageUrl = canvas.toDataURL('image/png');
    
    // Destroy the temporary chart
    tempChart.destroy();
    
    return imageUrl;
}