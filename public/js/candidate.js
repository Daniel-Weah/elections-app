document.getElementById('candidateRegistrationForm').addEventListener('submit', (e) => {
    e.preventDefault();
    console.log("Form submission triggered");

    const formData = new FormData(e.target);
    console.log("Form data prepared");

    fetch('/candidate/registration', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log("Fetch response received");
        if (response.ok) {
            Swal.fire({
                title: 'Candidate Successfully Registered!',
                text: 'Your information has been recorded!',
                icon: 'success',
                confirmButtonText: 'OK'
            }).then(() => {
                document.getElementById('candidateRegistrationForm').reset();
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
        console.error('Error:', error);
    });
});
