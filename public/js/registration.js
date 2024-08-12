 document.getElementById('registrationForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
    const formData = new FormData(e.target);

    fetch('/voters', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            Swal.fire({
                title: 'Registration Successful',
                text: 'Your information has been recorded!',
                icon: 'success',
                confirmButtonText: 'OK'
            }).then(() => {
                document.getElementById('registrationForm').reset();
            });
        } else {
            Swal.fire({
                title: 'Error',
                text: 'There was a problem sending your information. Please try again later.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    })
    .catch(error => {
        Swal.fire({
            title: 'Error',
            text: 'There was a problem sending your information. Please try again later.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    });
        console.error('Error:', error);
    });

