// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
    
    // Page navigation
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    
    function showPage(pageId) {
        // Hide all pages
        pages.forEach(page => {
            page.classList.remove('active');
        });
        
        // Show selected page
        const selectedPage = document.getElementById(pageId + 'Page');
        if (selectedPage) {
            selectedPage.classList.add('active');
        }
        
        // Update active state in navigation
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === pageId) {
                link.classList.add('active');
            }
        });
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Close mobile menu if open
        if (navMenu) {
            navMenu.classList.remove('active');
        }
        
        // If showing studio page, reinitialize voice features
        if (pageId === 'studio') {
            setTimeout(() => {
                if (typeof reinitializeStudio === 'function') {
                    reinitializeStudio();
                }
            }, 100);
        }
    }
    
    // Add click handlers to navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            if (pageId) {
                showPage(pageId);
            }
        });
    });
    
    // Handle footer links
    const footerLinks = document.querySelectorAll('.footer-section a');
    footerLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const pageId = this.getAttribute('data-page');
            if (pageId) {
                e.preventDefault();
                showPage(pageId);
            }
        });
    });
    
    // Expose navigateToStudio function globally
    window.navigateToStudio = function() {
        showPage('studio');
    };
    
    window.scrollToFeatures = function() {
        const featuresSection = document.getElementById('featuresSection');
        if (featuresSection) {
            featuresSection.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    // Handle hash navigation
    function handleHash() {
        const hash = window.location.hash.substring(1);
        if (hash && ['home', 'studio', 'about', 'features'].includes(hash)) {
            showPage(hash);
        } else {
            showPage('home');
        }
    }
    
    window.addEventListener('hashchange', handleHash);
    handleHash();
});

// Function to reinitialize studio components when page is shown
function reinitializeStudio() {
    console.log('Studio page initialized');
    // The main app.js will handle the rest
}
