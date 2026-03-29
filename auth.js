const SUPABASE_URL = 'https://xorefugfztewghiambkz.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcmVmdWdmenRld2doaWFtYmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDc1MDMsImV4cCI6MjA5MDA4MzUwM30.QncelfMky_DyIFV_7aq-NUlM9TBsxFAdj8TyLZcrD64'; 

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.currentUser = null;

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

    if (!authBtn || !authModal || !authSubmitBtn) {
        return;
    }

    let isSignUpMode = false;

    async function checkUser() {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                window.currentUser = session.user;
                authBtn.textContent = 'Sign Out';
                if(document.getElementById('manualSaveBtn')) document.getElementById('manualSaveBtn').style.display = 'block';

                if (session.user.user_metadata && session.user.user_metadata.pwa_dismissed) {
                    localStorage.setItem('im_pwa_dismissed', 'true');
                    const pwaPrompt = document.getElementById('pwa-prompt');
                    if (pwaPrompt) pwaPrompt.style.display = 'none';
                }
            } else {
                window.currentUser = null;
                authBtn.textContent = 'Sign In';
                if(document.getElementById('manualSaveBtn')) document.getElementById('manualSaveBtn').style.display = 'none';
            }
            if (window.refreshSavedBids) window.refreshSavedBids();
            
            if (typeof window.renderDownloadOptions === 'function') {
                window.renderDownloadOptions();
            }
        } catch (err) {
        }
    }

    authBtn.addEventListener('click', async () => {
        if (window.currentUser) {
            await window.supabaseClient.auth.signOut();
            window.currentUser = null;
            authBtn.textContent = 'Sign In';
            if(document.getElementById('manualSaveBtn')) document.getElementById('manualSaveBtn').style.display = 'none';
            if (window.refreshSavedBids) window.refreshSavedBids();
            
            if (typeof window.renderDownloadOptions === 'function') window.renderDownloadOptions();
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
                const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                
                if(window.gtag) window.gtag('event', 'sign_up');
                
                alert("Account created! You can now log in.");
                authToggleMode.click();
            } else {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                
                if(window.gtag) window.gtag('event', 'login');
                
                window.currentUser = data.user;
                authBtn.textContent = 'Sign Out';
                if(document.getElementById('manualSaveBtn')) document.getElementById('manualSaveBtn').style.display = 'block';

                if (data.user.user_metadata && data.user.user_metadata.pwa_dismissed) {
                    localStorage.setItem('im_pwa_dismissed', 'true');
                    const pwaPrompt = document.getElementById('pwa-prompt');
                    if (pwaPrompt) pwaPrompt.style.display = 'none';
                }

                authModal.classList.remove('show');
                authEmail.value = '';
                authPassword.value = '';
                if (window.refreshSavedBids) window.refreshSavedBids();
                
                if (typeof window.renderDownloadOptions === 'function') window.renderDownloadOptions();
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        }
    });

    checkUser();
});
