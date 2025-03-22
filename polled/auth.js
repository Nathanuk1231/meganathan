
const redirectUri = "https://nathanuk1231.github.io/meganathan/polled/timeline.html";
const clientId = "9504be431db31b01c4c1738b6edff281"; 
const clientSecret = "b84bff0ec7b6a9e83b36217faecd44722d2e172d8dc90547533ca08f0b542c4d";  

// Get the authorization code from the query string
const urlParams = new URLSearchParams(window.location.search);  // Get parameters from the URL query string
const code = urlParams.get("code");

if (code) {
    const formData = new FormData();
    formData.append("grant_type", "authorization_code");
    formData.append("code", code);  
    formData.append("redirect_uri", redirectUri); 
    formData.append("client_id", clientId);  
    formData.append("client_secret", clientSecret);  

    // Send a POST request to authorization_code.php
    fetch('https://wokki20.nl/polled/api/v1/authorization_code', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        // Check if the response is OK (status 200)
        if (!response.ok) {
            throw new Error('HTTP error!');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            // Handle error response
            console.error('Error:', data.error);
        } else {
            localStorage.setItem("accessToken", data.access_token);
            localStorage.setItem("refreshToken", data.refresh_token);

            // Clear the authorization code from the query string
            const params = new URLSearchParams(window.location.search);
            params.delete('code');
            window.history.replaceState({}, '', `${window.location.pathname}${params.toString()}`);

        
            // Handle success response
            console.log('Success:', data);
            

        }
    })
    .catch(error => {
        // Handle fetch errors (e.g., network issues or other exceptions)
        console.error('Request failed', error);
    });
}
                                    
