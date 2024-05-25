const url = "./data/containers.json";

function filterRecentContainers(data) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return data.filter(container => {
        const containerDate = new Date(container.DATE.substring(0, 4), container.DATE.substring(4, 6) - 1, container.DATE.substring(6, 8));
        return containerDate >= oneMonthAgo;
    });
}

function getUniqueAddresses(data) {
    const addresses = data.map(container => container.ADDRESS);
    return [...new Set(addresses)];
}

function populateDropdown(addresses) {
    const select = document.getElementById('address-select');

    addresses.sort((a, b) => a.localeCompare(b));

    addresses.forEach(address => {
        const option = document.createElement('option');
        option.value = address;
        option.textContent = address;
        select.appendChild(option);
    });
}

async function fetchAndModifySvg(fraction, fillHeight) {
    const svgFilename = getSvgFilename(fraction);
    try {
        const response = await fetch(svgFilename);
        if (!response.ok) throw new Error('Network response was not ok');
        const svgText = await response.text();

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.documentElement.cloneNode(true);

        const maxFillHeight = 2500;
        const adjustedHeight = (fillHeight / maxFillHeight) * 434.34;
        const fillYPosition = 251.58 + (434.34 - adjustedHeight);

        const fillRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fillRect.setAttribute('x', '.5');
        fillRect.setAttribute('y', fillYPosition);
        fillRect.setAttribute('width', '346.34');
        fillRect.setAttribute('height', adjustedHeight);
        fillRect.setAttribute('fill', getFillColor(fraction));
        fillRect.setAttribute('class', 'fill-rect');

        const fillText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        fillText.setAttribute('x', '10');
        fillText.setAttribute('y', fillYPosition - 5);
        fillText.setAttribute('fill', '#000');
        fillText.textContent = `Fyllingsgrad: ${fillHeight}`;

        const garbagebox = svgElement.getElementById('garbagebox');
        if (garbagebox) {
            garbagebox.insertBefore(fillRect, garbagebox.firstChild);
            garbagebox.insertBefore(fillText, garbagebox.firstChild);
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);
    } catch (error) {
        console.error('Error fetching or modifying SVG:', error);
        return '';
    }
}

function getSvgFilename(fraction) {
    switch (fraction.toLowerCase()) {
        case 'papir':
        case 'papir-næring':
            return './icons/papir.svg';
        case 'bio':
        case 'bio-næring':
            return './icons/bio.svg';
        case 'restavfall':
        case 'rest-næring':
            return './icons/restavfall.svg';
        case 'glass/metall':
        case 'glass/metall-næring':
            return './icons/metall.svg';
        default:
            return '';
    }
}

function getFillColor(fraction) {
    switch (fraction.toLowerCase()) {
        case 'papir':
        case 'papir-næring':
            return '#326431';
        case 'bio':
        case 'bio-næring':
            return '#635633';
        case 'restavfall':
        case 'rest-næring':
            return '#1c3664';
        case 'glass/metall':
        case 'glass/metall-næring':
            return '#c62232';
        default:
            return '#000';
    }
}

function openCoordinates(latitude, longitude) {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(url, '_blank');
}

async function displayContainers(address, data) {
    const containerDiv = document.getElementById('container-data');
    containerDiv.innerHTML = '';

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

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

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

async function fetchLastCommitTimestamp() {
    const repoOwner = 'hennamann';
    const repoName = 'nedgravde-containere-status';
    const commitMessage = 'Daglig oppdatering av Containers.json';

    try {
        const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/commits`);
        if (!response.ok) throw new Error('Network response was not ok');
        const commits = await response.json();

        const commit = commits.find(commit => commit.commit.message === commitMessage);
        if (!commit) throw new Error('Commit not found');

        const timestamp = new Date(commit.commit.author.date);
        return timestamp.toLocaleString();
    } catch (error) {
        console.error('Error fetching commit timestamp:', error);
        return 'Unknown';
    }
}

async function updateLastCommitTimestamp() {
    const timestampField = document.getElementById('last-commit-timestamp');
    if (!timestampField) return;

    const timestamp = await fetchLastCommitTimestamp();
    timestampField.textContent = `Data sist oppdatert: ${timestamp}`;
}

function calculateTimeUntilNextUpdate() {
    const now = new Date();
    const nextUpdate = new Date(now);
    nextUpdate.setUTCHours(5, 0, 0, 0);

    if (now.getUTCHours() >= 5) {
        nextUpdate.setDate(nextUpdate.getDate() + 1);
    }

    const timeUntilUpdate = nextUpdate - now;
    const hoursUntilUpdate = Math.ceil(timeUntilUpdate / (1000 * 60 * 60));

    return hoursUntilUpdate;
}
function updateNextUpdateText() {
    const nextUpdateField = document.getElementById('next-update');
    if (!nextUpdateField) return;

    const hoursUntilUpdate = calculateTimeUntilNextUpdate();
    nextUpdateField.textContent = `Data vil bli oppdatert igjen om rundt: ${hoursUntilUpdate} timer`;
}

updateLastCommitTimestamp();
updateNextUpdateText();

document.addEventListener('DOMContentLoaded', async () => {
    const loadingSpinner = document.getElementById('loading-spinner');

    fetch(url)
        .then(response => response.json())
        .then(async data => {
            const recentContainers = filterRecentContainers(data);
            const uniqueAddresses = getUniqueAddresses(recentContainers);

            populateDropdown(uniqueAddresses);

            loadingSpinner.style.display = 'block';

            try {
                const userLocation = await getUserLocation();
                const closestAddress = findClosestAddress(userLocation.latitude, userLocation.longitude, recentContainers);
                const select = document.getElementById('address-select');
                select.value = closestAddress;
                displayContainers(closestAddress, recentContainers);
            } catch (error) {
                console.error('Error getting user location:', error);
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

            $('#address-select').select2();

            $('#address-select').on('change', function () {
                const selectedAddress = $(this).val();
                displayContainers(selectedAddress, recentContainers);
            });

            loadingSpinner.style.display = 'none';
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            loadingSpinner.style.display = 'none';
        });
});
