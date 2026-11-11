import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendEmailVerification,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

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

function startVerificationPolling(user) {
    let modal = document.getElementById('emailVerifyModal');
    if (modal) modal.style.display = 'flex';

    if (verificationInterval) clearInterval(verificationInterval);
    
    verificationInterval = setInterval(async () => {
        try {
            await user.reload();
            if (user.emailVerified) {
                clearInterval(verificationInterval);
                if (modal) modal.style.display = 'none';
                window.location.href = "index.html";
            }
        } catch (err) {
            console.log("Polling error:", err.message);
        }
    }, 3000);
}

onAuthStateChanged(auth, user => {
    if (user) {
        if (user.emailVerified) {
            window.location.href = "index.html";
        } else {
            startVerificationPolling(user);
        }
    }
});

async function handleLogin() {
    let email = document.getElementById('loginEmail').value.trim();
    let pass = document.getElementById('loginPassword').value.trim();
    let rememberMe = document.getElementById('rememberMe').checked;
    let errorEl = document.getElementById('authError');

    try {
        // Set Firebase session persistence based on "Remember Me"
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);

        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        let user = userCredential.user;
        
        if (!user.emailVerified) {
            startVerificationPolling(user);
        } else {
            window.location.href = "index.html";
        }
    } catch (error) {
        if (errorEl) errorEl.innerText = "🐾 Meow! " + error.message;
    }
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
            await sendEmailVerification(user);
            startVerificationPolling(user);
        })
        .catch(error => {
            if (errorEl) errorEl.innerText = "🐾 Meow! " + error.message;
        });
}

// 🔑 Password Reset Modal Handlers
window.handlePasswordReset = function() {
    let mainEmail = document.getElementById('loginEmail').value.trim();
    let resetInput = document.getElementById('resetEmailInput');
    if (resetInput) resetInput.value = mainEmail;

    let modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'flex';
};

window.closeForgotPasswordModal = function() {
    let modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'none';
};

window.closeResetSuccessModal = function() {
    let modal = document.getElementById('resetSuccessModal');
    if (modal) modal.style.display = 'none';
};

window.submitPasswordReset = async function() {
    let email = document.getElementById('resetEmailInput').value.trim();
    let errorEl = document.getElementById('authError');

    if (!email) {
        alert("🐾 Meow! Please enter your email address.");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        closeForgotPasswordModal();
        let successModal = document.getElementById('resetSuccessModal');
        if (successModal) successModal.style.display = 'flex';
        if (errorEl) errorEl.innerText = "";
    } catch (error) {
        alert("🐾 Meow! " + error.message);
    }
};

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

window.cancelVerification = async function() {
    if (verificationInterval) clearInterval(verificationInterval);
    
    let user = auth.currentUser;
    if (user && !user.emailVerified) {
        try {
            await user.delete();
        } catch (error) {
            console.log("Cleanup error:", error.message);
        }
    }
    
    await signOut(auth);
    let modal = document.getElementById('emailVerifyModal');
    if (modal) modal.style.display = 'none';
};

window.handleLogin = handleLogin;
window.handleSignup = handleSignup;