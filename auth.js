const SUPABASE_URL = 'https://xorefugfztewghiambkz.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcmVmdWdmenRld2doaWFtYmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDc1MDMsImV4cCI6MjA5MDA4MzUwM30.QncelfMky_DyIFV_7aq-NUlM9TBsxFAdj8TyLZcrD64'; 

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.currentUser = null;

function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const manualSaveBtn = document.getElementById('manualSaveBtn');
    const pwaPrompt = document.getElementById('pwa-prompt');
    
    if (window.gtag) {
        gtag('set', 'user_properties', {
            'user_tier': window.isPro ? 'pro' : 'free',
            'logged_in': window.currentUser ? 'true' : 'false'
        });
        
        if (window.currentUser) {
            gtag('config', 'G-4WWZ1PYH4Q', {
                'user_id': window.currentUser.id
            });
        }
    }

    if (window.currentUser) {
        if (authBtn) authBtn.textContent = 'Sign Out';
        if (manualSaveBtn) manualSaveBtn.style.display = 'block';

        if (window.currentUser.user_metadata && window.currentUser.user_metadata.pwa_dismissed) {
            localStorage.setItem('im_pwa_dismissed', 'true');
            if (pwaPrompt) pwaPrompt.style.display = 'none';
        }
    } else {
        if (authBtn) authBtn.textContent = 'Sign In';
        if (manualSaveBtn) manualSaveBtn.style.display = 'none';
    }
    
    if (typeof window.refreshSavedBids === 'function') window.refreshSavedBids();
    if (typeof window.renderDownloadOptions === 'function') window.renderDownloadOptions();
    if (window.currentUser && typeof window.fetchCustomMaterials === 'function') window.fetchCustomMaterials();
}

window.supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('show');
        document.getElementById('updatePasswordModal').classList.add('show');
    }
    if (session && session.user) {
        window.currentUser = session.user;
    } else {
        window.currentUser = null;
    }
    updateAuthUI();
});

document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('authBtn');
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authToggleMode = document.getElementById('authToggleMode');
    const authSwitchText = document.getElementById('authSwitchText');
    const authTitle = document.getElementById('authTitle');

    if (!authBtn || !authModal || !authSubmitBtn) return;

    let isSignUpMode = false;

    authBtn.addEventListener('click', async () => {
        if (window.currentUser) {
            await window.supabaseClient.auth.signOut();
        } else {
            authModal.classList.add('show');
        }
    });

    closeAuthModal.addEventListener('click', () => {
        authModal.classList.remove('show');
        authEmail.value = '';
        authPassword.value = '';
    });

    authToggleMode.addEventListener('click', () => {
        isSignUpMode = !isSignUpMode;
        if (isSignUpMode) {
            authTitle.textContent = 'Create Account';
            authSubmitBtn.textContent = 'Sign Up';
            authSwitchText.textContent = 'Already have an account? ';
            authToggleMode.textContent = 'Sign In';
        } else {
            authTitle.textContent = 'Welcome Back';
            authSubmitBtn.textContent = 'Sign In';
            authSwitchText.textContent = "Don't have an account? ";
            authToggleMode.textContent = 'Sign Up';
        }
    });

    authSubmitBtn.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        const password = authPassword.value;

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        authSubmitBtn.textContent = 'Processing...';
        authSubmitBtn.disabled = true;

        try {
            if (isSignUpMode) {
                const { error } = await window.supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                if (window.gtag) window.gtag('event', 'sign_up');
                alert("Account created! You can now log in.");
                authToggleMode.click();
            } else {
                const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                if (window.gtag) window.gtag('event', 'login');
                authModal.classList.remove('show');
                authEmail.value = '';
                authPassword.value = '';
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        }
    });

    const authForgotPassword = document.getElementById('authForgotPassword');
    if (authForgotPassword) {
        authForgotPassword.addEventListener('click', async () => {
            const email = document.getElementById('authEmail').value.trim();
            if (!email) {
                alert("Enter your email address in the field first.");
                return;
            }
            const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });
            if (error) {
                alert(error.message);
            } else {
                alert("Check your inbox for the reset link.");
            }
        });
    }

    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', async () => {
            const newPassword = document.getElementById('newPasswordInput').value;
            if (!newPassword) return;
            
            const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
            if (error) {
                alert(error.message);
            } else {
                alert("Password updated.");
                document.getElementById('updatePasswordModal').classList.remove('show');
            }
        });
    }

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (!window.currentUser) return;
            
            const confirm1 = confirm("WARNING: This will permanently delete your account, all saved bids, clients, and templates. This action cannot be undone.");
            if (!confirm1) return;
            
            const confirm2 = prompt("Type DELETE to confirm account deletion:");
            if (confirm2 !== 'DELETE') return;

            deleteAccountBtn.textContent = 'Deleting...';
            deleteAccountBtn.disabled = true;

            try {
                const { error } = await window.supabaseClient.rpc('delete_user_account');
                if (error) throw error;
                
                alert("Account deleted successfully.");
                await window.supabaseClient.auth.signOut();
                window.location.reload();
            } catch (err) {
                alert("Error deleting account: " + err.message);
                deleteAccountBtn.textContent = 'Permanently Delete Account';
                deleteAccountBtn.disabled = false;
            }
        });
    }

    window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user) {
            window.currentUser = session.user;
            updateAuthUI();
        }
    });
});
