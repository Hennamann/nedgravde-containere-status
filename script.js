const url = "./data/containers.json";

// Function to filter out containers older than one month
function filterRecentContainers(data) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return data.filter(container => {
        const containerDate = new Date(container.DATE.substring(0, 4), container.DATE.substring(4, 6) - 1, container.DATE.substring(6, 8));
        return containerDate >= oneMonthAgo;
    });
}

// Function to get unique addresses
function getUniqueAddresses(data) {
    const addresses = data.map(container => container.ADDRESS);
    return [...new Set(addresses)];
}

// Function to populate the dropdown list
function populateDropdown(addresses) {
    const select = document.getElementById('address-select');

    // Sort the addresses alphabetically
    addresses.sort((a, b) => a.localeCompare(b));

    addresses.forEach(address => {
        const option = document.createElement('option');
        option.value = address;
        option.textContent = address;
        select.appendChild(option);
    });
}

// Function to fetch and manipulate the SVG based on fill height
async function fetchAndModifySvg(fraction, fillHeight) {
    const svgFilename = getSvgFilename(fraction);
    try {
        const response = await fetch(svgFilename);
        if (!response.ok) throw new Error('Network response was not ok');
        const svgText = await response.text();

        // Create a temporary DOM element to manipulate the SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.documentElement.cloneNode(true);

        // Adjust the height of the new fill rectangle
        const maxFillHeight = 2500;
        const adjustedHeight = (fillHeight / maxFillHeight) * 434.34; // assuming 434.34 is the max height
        const fillYPosition = 251.58 + (434.34 - adjustedHeight); // Adjust y position to simulate fill from bottom

        // Create a new rectangle for the fill level
        const fillRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fillRect.setAttribute('x', '.5');
        fillRect.setAttribute('y', fillYPosition);
        fillRect.setAttribute('width', '346.34');
        fillRect.setAttribute('height', adjustedHeight);
        fillRect.setAttribute('fill', getFillColor(fraction));
        fillRect.setAttribute('class', 'fill-rect');

        // Create a text element for the fill height
        const fillText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        fillText.setAttribute('x', '10'); // Adjust x position as needed
        fillText.setAttribute('y', fillYPosition - 5); // Adjust y position to be just above the fill rect
        fillText.setAttribute('fill', '#000'); // Text color
        fillText.textContent = `Fyllingsgrad: ${fillHeight}`;

        // Find the parent group element
        const garbagebox = svgElement.getElementById('garbagebox');
        if (garbagebox) {
            garbagebox.insertBefore(fillRect, garbagebox.firstChild);
            garbagebox.insertBefore(fillText, garbagebox.firstChild); // Insert the text element
        }

        // Convert the updated SVG back to a string
        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);
    } catch (error) {
        console.error('Error fetching or modifying SVG:', error);
        return '';
    }
}

// Function to get SVG filename based on fraction
function getSvgFilename(fraction) {
    switch (fraction.toLowerCase()) {
        case 'papir':
            return './icons/papir.svg';
        case 'bio':
            return './icons/bio.svg';
        case 'restavfall':
            return './icons/restavfall.svg';
        case 'glass/metall':
            return './icons/metall.svg';
        default:
            return '';
    }
}

// Function to determine fill color based on fraction type
function getFillColor(fraction) {
    switch (fraction.toLowerCase()) {
        case 'papir':
            return '#326431';
        case 'bio':
            return '#635633';
        case 'restavfall':
            return '#1c3664';
        case 'glass/metall':
            return '#c62232';
        default:
            return '#000';
    }
}

// Function to open coordinates in a new browser tab
function openCoordinates(latitude, longitude) {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(url, '_blank');
}

// Function to display containers for the selected address
async function displayContainers(address, data) {
    const containerDiv = document.getElementById('container-data');
    containerDiv.innerHTML = ''; // Clear previous data

    const containers = data.filter(container => container.ADDRESS === address);
    for (const container of containers) {
        const containerInfo = document.createElement('div');
        containerInfo.classList.add('container');

        const modifiedSvg = await fetchAndModifySvg(container.FRACTION, container.FILLHEIGHT);

        const temperatureDisplay = container.TEMPERATURE !== undefined && container.TEMPERATURE !== ' ' ? `${container.TEMPERATURE}°C` : 'n/a';

        containerInfo.innerHTML = `
            <h3><i class="fa-solid fa-recycle"></i> ${container.FRACTION}</h3>
            <p><i class="fas fa-thermometer-three-quarters"></i> ${temperatureDisplay}</p>
            <button class="coordinates-btn" onclick="openCoordinates(${container.LATITUDE}, ${container.LONGITUDE})"><i class="fas fa-map-marker-alt"></i> Vis i Google Maps</button>
            <div class="svg-container">${modifiedSvg}</div>
        `;
        containerDiv.appendChild(containerInfo);
    }
}

// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

// Function to get user's current location
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                resolve({ latitude: userLat, longitude: userLon });
            }, error => {
                reject(error);
            });
        } else {
            reject(new Error("Geolocation is not supported by this browser."));
        }
    });
}

// Function to find the closest address to user's location
function findClosestAddress(userLat, userLon, data) {
    let closestAddress;
    let minDistance = Infinity;

    data.forEach(container => {
        const distance = calculateDistance(userLat, userLon, container.LATITUDE, container.LONGITUDE);
        if (distance < minDistance) {
            minDistance = distance;
            closestAddress = container.ADDRESS;
        }
    });

    return closestAddress;
}

// Main execution
document.addEventListener('DOMContentLoaded', async () => {
    const loadingSpinner = document.getElementById('loading-spinner');

    fetch(url)
        .then(response => response.json())
        .then(async data => {
            const recentContainers = filterRecentContainers(data);
            const uniqueAddresses = getUniqueAddresses(recentContainers);

            populateDropdown(uniqueAddresses);

            // Show loading spinner
            loadingSpinner.style.display = 'block';

            // Get user's current location
            try {
                const userLocation = await getUserLocation();
                const closestAddress = findClosestAddress(userLocation.latitude, userLocation.longitude, recentContainers);
                const select = document.getElementById('address-select');
                select.value = closestAddress;
                displayContainers(closestAddress, recentContainers);
            } catch (error) {
                console.error('Error getting user location:', error);
                // Fallback to the first address if user's location cannot be retrieved
                if (uniqueAddresses.length > 0) {
                    const select = document.getElementById('address-select');
                    select.value = uniqueAddresses[0];
                    displayContainers(uniqueAddresses[0], recentContainers);
                }
            }

            const select = document.getElementById('address-select');
            select.addEventListener('change', (event) => {
                displayContainers(event.target.value, recentContainers);
            });

            // Initialize Select2
            $('#address-select').select2();

            // Event listener for dropdown change
            $('#address-select').on('change', function () {
                const selectedAddress = $(this).val(); // Get the selected value
                displayContainers(selectedAddress, recentContainers);
            });

            // Hide loading spinner
            loadingSpinner.style.display = 'none';
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            // Hide loading spinner in case of error
            loadingSpinner.style.display = 'none';
        });
});
