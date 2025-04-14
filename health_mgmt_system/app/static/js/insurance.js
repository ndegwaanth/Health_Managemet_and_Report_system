document.addEventListener('DOMContentLoaded', function() {
    // Initialize any insurance page specific functionality
    console.log('Insurance management page loaded');
    
    // You can add more interactive features here like:
    // - Filtering claims by status
    // - Expanding claim details
    // - Insurance provider management
    
    // Example: Add click handlers for claim details
    document.querySelectorAll('.claim-details-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const claimId = this.dataset.claimId;
            // Implement claim details view
            console.log('Viewing claim:', claimId);
        });
    });
});