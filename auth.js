import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendEmailVerification,
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCfHM-HSU-emecmX3L4nGXZgG1Z0mQSpwA",
    authDomain: "cozy-expense-tracker-cfe23.firebaseapp.com",
    projectId: "cozy-expense-tracker-cfe23",
    storageBucket: "cozy-expense-tracker-cfe23.firebasestorage.app",
    messagingSenderId: "1004346376450",
    appId: "1:1004346376450:web:0ce118a44539bae428421b",
    measurementId: "G-H0J546DWPW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let verificationInterval = null;

// Helper to display waiting modal and poll Firebase for verification status
function startVerificationPolling(user) {
    let modal = document.getElementById('emailVerifyModal');
    if (modal) modal.style.display = 'flex';

    if (verificationInterval) clearInterval(verificationInterval);
    
    verificationInterval = setInterval(async () => {
        try {
            await user.reload(); // Refresh state from Firebase servers
            if (user.emailVerified) {
                clearInterval(verificationInterval);
                if (modal) modal.style.display = 'none';
                window.location.href = "index.html"; // Success! Go to dashboard
            }
        } catch (err) {
            console.log("Polling error:", err.message);
        }
    }, 3000);
}

// Check auth state on page load
onAuthStateChanged(auth, user => {
    if (user) {
        if (user.emailVerified) {
            window.location.href = "index.html";
        } else {
            // Logged in but unverified (e.g., page refresh)
            startVerificationPolling(user);
        }
    }
});

function handleLogin() {
    let email = document.getElementById('loginEmail').value.trim();
    let pass = document.getElementById('loginPassword').value.trim();
    let errorEl = document.getElementById('authError');

    signInWithEmailAndPassword(auth, email, pass)
        .then((userCredential) => {
            let user = userCredential.user;
            if (!user.emailVerified) {
                startVerificationPolling(user);
            } else {
                window.location.href = "index.html";
            }
        })
        .catch(error => {
            if (errorEl) errorEl.innerText = "🐾 Meow! " + error.message;
        });
}

function handleSignup() {
    let email = document.getElementById('loginEmail').value.trim();
    let pass = document.getElementById('loginPassword').value.trim();
    let errorEl = document.getElementById('authError');

    if (pass.length < 6) {
        if (errorEl) errorEl.innerText = "🐾 Meow! Password must be at least 6 characters long.";
        return;
    }

    createUserWithEmailAndPassword(auth, email, pass)
        .then(async (userCredential) => {
            let user = userCredential.user;
            
            // Send Firebase verification email
            await sendEmailVerification(user);
            
            // Open waiting modal and begin polling
            startVerificationPolling(user);
        })
        .catch(error => {
            if (errorEl) errorEl.innerText = "🐾 Meow! " + error.message;
        });
}

// Resend Verification Email Button
window.resendVerificationEmail = async function() {
    let user = auth.currentUser;
    if (user) {
        try {
            await sendEmailVerification(user);
            alert("🌸 Verification email resent! Check your inbox, meow!");
        } catch (error) {
            alert("🐾 Please wait a moment before requesting another email.");
        }
    }
};

// Cancel & Cleanup Handler (Deletes temporary account so email isn't burned)
window.cancelVerification = async function() {
    if (verificationInterval) clearInterval(verificationInterval);
    
    let user = auth.currentUser;
    if (user && !user.emailVerified) {
        try {
            await user.delete();
            console.log("Unverified temporary account cleaned up.");
        } catch (error) {
            console.log("Cleanup error:", error.message);
        }
    }
    
    await signOut(auth);
    let modal = document.getElementById('emailVerifyModal');
    if (modal) modal.style.display = 'none';
};

// Bind functions globally for HTML onclick handlers
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;