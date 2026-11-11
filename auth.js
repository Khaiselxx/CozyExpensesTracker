import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendEmailVerification,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// If user is already logged in, skip login page and go straight to index.html
onAuthStateChanged(auth, user => {
    if (user) {
        // Optional: Check if user.emailVerified is required before routing to index.html
        window.location.href = "index.html";
    }
});

function handleLogin() {
    let email = document.getElementById('loginEmail').value.trim();
    let pass = document.getElementById('loginPassword').value.trim();
    let errorEl = document.getElementById('authError');

    signInWithEmailAndPassword(auth, email, pass)
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
            
            // Automatically triggers Firebase's native verification email
            await sendEmailVerification(user);
            
            alert("🌸 Account created successfully! We've sent a verification link to your email. Please check your inbox, meow!");
        })
        .catch(error => {
            if (errorEl) errorEl.innerText = "🐾 Meow! " + error.message;
        });
}

// Explicitly bind to global window scope for inline HTML onclick handlers
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;