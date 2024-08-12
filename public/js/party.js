document.getElementById('partyRegistrationForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const partyData = new FormData(e.target);
    
    fetch('/create/party', {
        method: 'POST',
        body: partyData
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (response.ok) {
            Swal.fire({
                title: 'Party Successfully Created!',
                text: 'Your party has been registered.',
                icon: 'success',
                confirmButtonText: 'OK'
            }).then(() => {
                document.getElementById('partyRegistrationForm').reset();
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
        console.log('Error', error);
    });
});
