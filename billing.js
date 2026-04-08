window.BillingSystem = {
    init: async function() {
        const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
        if (isNative) {
            await this.initNativeBilling();
        } else {
            this.initWebBilling();
        }
    },
    initWebBilling: function() {
        window.triggerUpgradeModal = function(featureName) {
            const featureText = document.getElementById('upgradeModalFeatureText');
            if (featureText) {
                featureText.textContent = featureName ? `Unlock ${featureName} to scale your business.` : 'Unlock unlimited scaling for your business.';
            }
            const btn = document.getElementById('upgradeActionBtn');
            if (btn) {
                btn.onclick = function() {
                    const userId = window.currentUser ? window.currentUser.id : '';
                    window.location.href = 'https://buy.stripe.com/aFadRb4OH32BepY0ZQ0co04?client_reference_id=' + userId;
                };
            }
            document.getElementById('upgradeModal').classList.add('show');
        };
    },
    initNativeBilling: async function() {
        const portalLink = document.getElementById('stripePortalLink');
        if (portalLink) portalLink.style.display = 'none';

        window.triggerUpgradeModal = function(featureName) {
            const featureText = document.getElementById('upgradeModalFeatureText');
            if (featureText) {
                featureText.textContent = featureName ? `Unlock ${featureName} to scale your business.` : 'Unlock unlimited scaling for your business.';
            }
            const btn = document.getElementById('upgradeActionBtn');
            if (btn) {
                btn.onclick = async function() {
                    
                };
            }
            document.getElementById('upgradeModal').classList.add('show');
        };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.BillingSystem.init();
});
