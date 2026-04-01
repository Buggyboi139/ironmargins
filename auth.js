document.addEventListener('DOMContentLoaded', () => {

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
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
            window.currentUser = session.user;
            authBtn.textContent = 'Sign Out';
            if(document.getElementById('manualSaveBtn')) document.getElementById('manualSaveBtn').style.display = 'block';

            if (session.user.user_metadata && session.user.user_metadata.pwa_dismissed) {
                localStorage.setItem('im_pwa_dismissed', 'true');
                const pwaPrompt = document.getElementById('pwa-prompt');
                if (pwaPrompt) pwaPrompt.style.display = 'none';
            }
            if (window.refreshSavedBids) window.refreshSavedBids();
            
            if (typeof window.renderDownloadOptions === 'function') {
                window.renderDownloadOptions();
            }
        } catch (err) {
        } else {
            window.currentUser = null;
            authBtn.textContent = 'Sign In';
            if(document.getElementById('manualSaveBtn')) document.getElementById('manualSaveBtn').style.display = 'none';
        }
    }
        
        if (window.refreshSavedBids) window.refreshSavedBids();
        
        if (typeof window.renderDownloadOptions === 'function') {
            window.renderDownloadOptions();
        }
        
        if (window.currentUser && typeof window.fetchCustomMaterials === 'function') {
            window.fetchCustomMaterials();
        }
    });

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
@@ -98,35 +93,22 @@ document.addEventListener('DOMContentLoaded', () => {

        try {
            if (isSignUpMode) {
                const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
                const { error } = await window.supabaseClient.auth.signUp({ email, password });
                if (error) throw error;

                if(window.gtag) window.gtag('event', 'sign_up');

                alert("Account created! You can now log in.");
                authToggleMode.click();
            } else {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
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
@@ -135,6 +117,4 @@ document.addEventListener('DOMContentLoaded', () => {
            authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        }
    });

    checkUser();
});
