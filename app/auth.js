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
            window.location.reload();
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
            window.showToast('Please enter both email and password.', 'error');
            return;
        }
        if (isSignUpMode && password.length < 8) {
            window.showToast('Password must be at least 8 characters.', 'error');
            return;
        }

        authSubmitBtn.textContent = 'Processing...';
        authSubmitBtn.disabled = true;

        try {
            if (isSignUpMode) {
                const { error } = await window.supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                if (window.gtag) window.gtag('event', 'sign_up');
                window.showToast('Account created! Check your email to confirm before signing in.', 'success', 5000);
                authToggleMode.click();
                authSubmitBtn.disabled = false;
                authSubmitBtn.textContent = 'Sign Up';
            } else {
                const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                if (window.gtag) window.gtag('event', 'login');
                
                if (typeof window.saveState === 'function') {
                    window.saveState(true);
                }
                window.location.reload();
            }
        } catch (err) {
            window.showToast(err.message, 'error');
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        }
    });

    const authForgotPassword = document.getElementById('authForgotPassword');
    if (authForgotPassword) {
        authForgotPassword.addEventListener('click', async () => {
            const email = document.getElementById('authEmail').value.trim();
            if (!email) {
                window.showToast('Enter your email address in the field first.', 'error');
                return;
            }
            const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });
            if (error) {
                window.showToast(error.message, 'error');
            } else {
                window.showToast('Check your inbox for the reset link.', 'success');
            }
        });
    }

    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', async () => {
            const newPassword = document.getElementById('newPasswordInput').value;
            if (!newPassword) { window.showToast('Please enter a new password.', 'error'); return; }
            if (newPassword.length < 8) { window.showToast('Password must be at least 8 characters.', 'error'); return; }

            updatePasswordBtn.textContent = 'Updating...';
            updatePasswordBtn.disabled = true;
            try {
                const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
                if (error) {
                    window.showToast(error.message, 'error');
                } else {
                    window.showToast('Password updated successfully.', 'success');
                    document.getElementById('updatePasswordModal').classList.remove('show');
                }
            } finally {
                updatePasswordBtn.textContent = 'Update';
                updatePasswordBtn.disabled = false;
            }
        });
    }

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (!window.currentUser) return;

            const confirmed = await window.showConfirm('WARNING: This will permanently delete your account, all saved bids, clients, and templates. This action cannot be undone.');
            if (!confirmed) return;

            const typed = await window.showPrompt('Type DELETE to confirm account deletion:');
            if (typed !== 'DELETE') {
                if (typed !== null) window.showToast('Confirmation did not match. Account not deleted.', 'error');
                return;
            }

            deleteAccountBtn.textContent = 'Deleting...';
            deleteAccountBtn.disabled = true;

            try {
                const { error } = await window.supabaseClient.rpc('delete_user_account');
                if (error) throw error;

                window.showToast('Account deleted successfully.', 'success');
                await window.supabaseClient.auth.signOut();
                window.location.reload();
            } catch (err) {
                window.showToast('Error deleting account: ' + err.message, 'error');
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