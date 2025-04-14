document.addEventListener('DOMContentLoaded', function() {
    // Doctor Selection
    const doctorCards = document.querySelectorAll('.doctor-card');
    doctorCards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove selected class from all cards
            doctorCards.forEach(c => c.classList.remove('selected'));
            
            // Add selected class to clicked card
            this.classList.add('selected');
            
            // Check the radio button
            const radio = this.querySelector('.doctor-radio');
            radio.checked = true;
            
            // Update available time slots if date is selected
            const selectedDate = document.getElementById('appointmentDate').value;
            if (selectedDate) {
                updateTimeSlots(selectedDate);
            }
        });
    });
    
    // Date Selection
    const dateInput = document.getElementById('appointmentDate');
    const dateOptions = document.querySelectorAll('.date-option');
    
    dateInput.addEventListener('change', function() {
        updateTimeSlots(this.value);
    });
    
    dateOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Set the date input value
            dateInput.value = this.dataset.date;
            
            // Highlight selected date
            dateOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            // Update time slots
            updateTimeSlots(this.dataset.date);
        });
    });
    
    // Form Submission
    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validate form
            if (!this.checkValidity()) {
                this.classList.add('was-validated');
                return;
            }
            
            // Show loading state
            const submitBtn = document.getElementById('submitAppointment');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Scheduling...';
            submitBtn.disabled = true;
            
            // Submit form via AJAX
            fetch(this.action, {
                method: 'POST',
                body: new FormData(this),
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success modal
                    document.getElementById('modalDoctorName').textContent = 
                        document.querySelector('input[name="doctor_name"]').value;
                    document.getElementById('modalAppointmentTime').textContent = 
                        `${document.getElementById('appointmentDate').value} at ${document.querySelector('.time-slot.selected')?.textContent || ''}`;
                    
                    const modal = new bootstrap.Modal(document.getElementById('confirmationModal'));
                    modal.show();
                } else {
                    throw new Error(data.error || 'Failed to schedule appointment');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(error.message);
            })
            .finally(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
        });
    }
});

function updateTimeSlots(selectedDate) {
    const timeSlotsContainer = document.getElementById('timeSlots');
    const doctorId = document.querySelector('.doctor-radio:checked')?.value;
    
    if (!selectedDate || !doctorId) {
        timeSlotsContainer.innerHTML = '<p class="text-muted">Please select both doctor and date</p>';
        return;
    }
    
    // Show loading state
    timeSlotsContainer.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    // In a real app, you would fetch available slots from the server
    // For this example, we'll simulate it with a timeout
    setTimeout(() => {
        // Generate sample time slots (in a real app, this would come from the server)
        const slots = [
            '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
            '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM',
            '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM'
        ];
        
        // Mark some slots as unavailable randomly (simulation)
        const availableSlots = slots.map(slot => {
            return {
                time: slot,
                available: Math.random() > 0.3  // 70% chance of being available
            };
        });
        
        // Render time slots
        let html = '';
        availableSlots.forEach(slot => {
            html += `
                <div class="time-slot ${slot.available ? '' : 'unavailable'}" 
                     data-time="${slot.time}" ${slot.available ? '' : 'disabled'}>
                    ${slot.time}
                </div>
            `;
        });
        
        timeSlotsContainer.innerHTML = html;
        
        // Add click handlers for time slots
        document.querySelectorAll('.time-slot:not(.unavailable)').forEach(slot => {
            slot.addEventListener('click', function() {
                document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
                this.classList.add('selected');
                
                // Update hidden time input
                const timeInput = document.createElement('input');
                timeInput.type = 'hidden';
                timeInput.name = 'appointment_time';
                timeInput.value = this.dataset.time;
                
                const existingInput = document.querySelector('input[name="appointment_time"]');
                if (existingInput) {
                    existingInput.remove();
                }
                
                this.appendChild(timeInput);
            });
        });
    }, 800);
}