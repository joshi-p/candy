// config
const API_URL = 'http://localhost:3000/api';

// state mgmt
let galleryImages = [];
let userState = {
    isLoggedIn: false,
    email: null,
    isPending: false
};

// initialization
function init() {
    checkSessionValidity();
    loadUserState();
    loadGallery();
    updateUI();
}

function checkSessionValidity() {
    // Check for fresh page load after server restart
    const sessionMarker = sessionStorage.getItem('candySession');

    if (!sessionMarker) {
        // New session
        localStorage.removeItem('candyUserState');
        userState = {
            isLoggedIn: false,
            email: null,
            isPending: false
        };
        sessionStorage.setItem('candySession', 'active');
    }
}

function loadUserState() {
    const saved = localStorage.getItem('candyUserState');
    if (saved) {
        userState = JSON.parse(saved);
    }
}

function saveUserState() {
    localStorage.setItem('candyUserState', JSON.stringify(userState));
}

function loadGallery() {
    const saved = localStorage.getItem('candyGallery');
    if (saved) {
        galleryImages = JSON.parse(saved);
        renderGallery();
    }
}

function updateUI() {
    const arrowText = document.getElementById('arrowText');
    const uploadBtn = document.getElementById('uploadBtn');

    if (userState.isLoggedIn) {
        arrowText.innerHTML = 'hurray!! you\'re candy certified.<br><span class="underline" onclick="handleArrowClick()">Add</span> your pictures now';
        uploadBtn.classList.remove('show');
    } else if (userState.isPending) {
        arrowText.innerHTML = '<span class="underline" onclick="handleArrowClick()">Check soon</span> for<br>your badge!';
        uploadBtn.classList.remove('show');
    } else {
        arrowText.innerHTML = '<span class="underline" onclick="handleArrowClick()">login</span> to add<br>your candy pictures';
        uploadBtn.classList.remove('show');
    }
}

function handleArrowClick() {
    if (userState.isLoggedIn) {
        document.getElementById('fileInput').click();
    } else {
        showLoginPage();
    }
}

function showLoginPage() {
    document.getElementById('mainPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('emailInput').value = '';
    document.getElementById('messageBox').classList.remove('show');
    document.getElementById('backButton').classList.add('hidden');
}

function goBackToMain() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainPage').classList.remove('hidden');
}

// api integration
async function sendApprovalRequest(email) {
    try {
        const response = await fetch(`${API_URL}/request-approval`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email })
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error sending approval request:', error);
        throw error;
    }
}

async function checkEmail() {
    const email = document.getElementById('emailInput').value.trim();

    if (!email || !email.includes('@')) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }

    try {
        // Check if email is already approved
        const checkResponse = await fetch(`${API_URL}/check-email?email=${encodeURIComponent(email)}`);
        const checkData = await checkResponse.json();

        if (checkData.approved) {
            // Email is approved
            userState.isLoggedIn = true;
            userState.email = email;
            userState.isPending = false;
            saveUserState();
            updateUI();
            goBackToMain();
        } else if (checkData.pending) {
            // Email is pending
            userState.isPending = true;
            userState.email = email;
            saveUserState();
            showMessage("Your request is pending approval. Check back soon!", 'success');
            document.getElementById('backButton').classList.remove('hidden');
            updateUI();
        } else {
            // Request approval
            const result = await sendApprovalRequest(email);

            if (result.success) {
                userState.isPending = true;
                userState.email = email;
                saveUserState();

                showMessage("We've delivered your details to Candy HQ. You'll be Candy Certified soon!", 'success');
                document.getElementById('backButton').classList.remove('hidden');
                updateUI();
            } else {
                showMessage('Error sending request. Please try again.', 'error');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error connecting to server. Please try again.', 'error');
    }
}

function showMessage(text, type) {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = text;
    messageBox.classList.add('show');
    messageBox.style.borderColor = type === 'error' ? '#ff6b6b' : '#FFB6C1';
}

// gallery functions
function renderGallery() {
    const track = document.getElementById('galleryTrack');

    if (galleryImages.length === 0) {
        if (userState.isLoggedIn) {
            track.innerHTML = '<div class="empty-gallery">Upload some pictures of Candy to see them here!</div>';
        } else {
            track.innerHTML = '<div class="empty-gallery">Login and get certified to add pictures of Candy!</div>';
        }
        return;
    }

    const duplicatedImages = [...galleryImages, ...galleryImages];

    track.innerHTML = duplicatedImages.map((img, index) => `
        <div class="gallery-item">
            <img src="${img}" alt="Candy ${index + 1}">
        </div>
    `).join('');
}

document.getElementById('fileInput').addEventListener('change', function (e) {
    if (!userState.isLoggedIn) {
        alert('Please log in first!');
        return;
    }

    const files = Array.from(e.target.files);

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (event) {
            galleryImages.push(event.target.result);
            localStorage.setItem('candyGallery', JSON.stringify(galleryImages));
            renderGallery();
        };
        reader.readAsDataURL(file);
    });
});

// animations
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.bg-layer');
    parallaxElements.forEach(el => {
        el.style.transform = `translateY(${scrolled * 0.5}px)`;
    });

    const contentBoxes = document.querySelectorAll('.content-box, .card');
    contentBoxes.forEach(box => {
        const boxTop = box.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        if (boxTop < windowHeight * 0.8) {
            box.style.opacity = '1';
            box.style.transform = 'translateY(0)';
        }
    });
});

document.querySelectorAll('.content-box, .card').forEach(box => {
    box.style.opacity = '0';
    box.style.transform = 'translateY(50px)';
    box.style.transition = 'all 0.8s ease';
});

document.addEventListener('mousemove', (e) => {
    const shapes = document.querySelectorAll('.shape');
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;

    shapes.forEach((shape, index) => {
        const speed = (index + 1) * 20;
        const xMove = (x - 0.5) * speed;
        const yMove = (y - 0.5) * speed;
        shape.style.transform = `translate(${xMove}px, ${yMove}px)`;
    });
});

document.getElementById('emailInput')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        checkEmail();
    }
});

// initialize
init();