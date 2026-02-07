/* ==========================================
   Bagus Dwi Permana - Portfolio Scripts
   ========================================== */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initNavigation();
    initScrollAnimations();
    initMetricCounters();
    initSmoothScroll();
    initContactForm();
    initNavbarScroll();
});

/* ==========================================
   Navigation
   ========================================== */
function initNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const navDropdowns = document.querySelectorAll('.nav-dropdown');

    // Toggle mobile menu
    hamburger?.addEventListener('click', function() {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    });

    // Handle dropdown toggle on mobile
    navDropdowns.forEach(dropdown => {
        const dropdownLink = dropdown.querySelector('.nav-link');
        dropdownLink?.addEventListener('click', function(e) {
            // Only prevent default and toggle on mobile
            if (window.innerWidth <= 768) {
                e.preventDefault();
                dropdown.classList.toggle('active');
            }
        });
    });

    // Close menu when clicking nav links (except dropdown parent)
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const isDropdownParent = this.closest('.nav-dropdown')?.querySelector('.nav-link') === this;
            if (!isDropdownParent || window.innerWidth > 768) {
                hamburger?.classList.remove('active');
                navMenu?.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Close menu when clicking dropdown menu items
    const dropdownMenuLinks = document.querySelectorAll('.dropdown-menu a');
    dropdownMenuLinks.forEach(link => {
        link.addEventListener('click', function() {
            hamburger?.classList.remove('active');
            navMenu?.classList.remove('active');
            navDropdowns.forEach(d => d.classList.remove('active'));
            document.body.style.overflow = '';
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!hamburger?.contains(e.target) && !navMenu?.contains(e.target)) {
            hamburger?.classList.remove('active');
            navMenu?.classList.remove('active');
            navDropdowns.forEach(d => d.classList.remove('active'));
            document.body.style.overflow = '';
        }
    });
    
    // Update active nav link based on scroll position
    updateActiveNavLink();
    window.addEventListener('scroll', updateActiveNavLink);
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    let currentSection = '';
    const scrollPosition = window.scrollY + 100;

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;

        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            currentSection = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
}

/* ==========================================
   Navbar Scroll Effect
   ========================================== */
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar?.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
        }
    });
}

/* ==========================================
   Scroll Animations (Fade-in)
   ========================================== */
function initScrollAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in');

    // Create Intersection Observer
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: unobserve after animation
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all fade-in elements
    fadeElements.forEach(element => {
        observer.observe(element);
    });

    // Trigger hero animations immediately
    const heroElements = document.querySelectorAll('.hero .fade-in');
    setTimeout(() => {
        heroElements.forEach(el => el.classList.add('visible'));
    }, 100);
}

/* ==========================================
   Metric Counter Animation
   ========================================== */
function initMetricCounters() {
    const metricValues = document.querySelectorAll('.metric-value');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    metricValues.forEach(metric => {
        observer.observe(metric);
    });
}

function animateCounter(element) {
    const target = parseFloat(element.getAttribute('data-target'));
    const prefix = element.getAttribute('data-prefix') || '';
    const suffix = element.getAttribute('data-suffix') || '%';
    const duration = 2000; // Animation duration in ms
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = target / steps;

    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        current = easeOutQuad(step, 0, target, steps);

        // Format the number
        let displayValue;
        if (target % 1 !== 0) {
            // Has decimals
            displayValue = current.toFixed(1);
        } else {
            displayValue = Math.round(current);
        }

        element.textContent = `${prefix}${displayValue}${suffix}`;

        if (step >= steps) {
            clearInterval(timer);
            // Ensure we end exactly at target
            if (target % 1 !== 0) {
                element.textContent = `${prefix}${target.toFixed(1)}${suffix}`;
            } else {
                element.textContent = `${prefix}${target}${suffix}`;
            }
        }
    }, stepDuration);
}

// Easing function for smooth animation
function easeOutQuad(t, b, c, d) {
    t /= d;
    return -c * t * (t - 2) + b;
}

/* ==========================================
   Smooth Scroll
   ========================================== */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Skip if it's just "#"
            if (href === '#') return;

            const target = document.querySelector(href);

            if (target) {
                e.preventDefault();

                const navHeight = document.querySelector('.navbar')?.offsetHeight || 0;
                const targetPosition = target.offsetTop - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ==========================================
   Contact Form (mailto)
   ========================================== */
function initContactForm() {
    // Contact form now handled by sendEmail function via onsubmit
}

// Global function for mailto form submission
function sendEmail(e) {
    e.preventDefault();

    const form = document.getElementById('contactForm');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    // Basic validation
    if (!name || !email || !message) {
        showNotification('Please fill in all fields.', 'error');
        return false;
    }

    if (!isValidEmail(email)) {
        showNotification('Please enter a valid email address.', 'error');
        return false;
    }

    // Construct mailto link
    const recipientEmail = 'baguspermana7@gmail.com';
    const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
    const body = encodeURIComponent(
        `Name: ${name}\n` +
        `Email: ${email}\n\n` +
        `Message:\n${message}`
    );

    // Open email client
    window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;

    // Show notification
    showNotification('Opening your email app... Please click Send in your email client.', 'success');

    // Reset form after a short delay
    setTimeout(() => {
        form.reset();
    }, 1000);

    return false;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showNotification(message, type) {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    existingNotification?.remove();

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <p>${message}</p>
        <button class="notification-close">&times;</button>
    `;

    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        padding: '1rem 1.5rem',
        borderRadius: '10px',
        backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
        color: '#ffffff',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        zIndex: '9999',
        animation: 'slideIn 0.3s ease',
        maxWidth: '90%',
        width: '400px'
    });

    // Add animation keyframes
    if (!document.querySelector('#notification-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'notification-styles';
        styleSheet.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(styleSheet);
    }

    document.body.appendChild(notification);

    // Style the close button
    const closeBtn = notification.querySelector('.notification-close');
    Object.assign(closeBtn.style, {
        background: 'transparent',
        border: 'none',
        color: '#ffffff',
        fontSize: '1.5rem',
        cursor: 'pointer',
        padding: '0',
        lineHeight: '1'
    });

    // Close notification
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

/* ==========================================
   Parallax Effect (Optional)
   ========================================== */
function initParallax() {
    const heroShape = document.querySelector('.hero-shape');

    window.addEventListener('scroll', function() {
        const scrolled = window.scrollY;
        if (heroShape) {
            heroShape.style.transform = `translateY(${scrolled * 0.3}px)`;
        }
    });
}

/* ==========================================
   Typed Text Effect (Optional)
   ========================================== */
function initTypedEffect() {
    const tagline = document.querySelector('.hero-tagline');
    if (!tagline) return;

    const text = tagline.textContent;
    tagline.textContent = '';
    tagline.style.opacity = '1';

    let index = 0;
    const typeSpeed = 50;

    function type() {
        if (index < text.length) {
            tagline.textContent += text.charAt(index);
            index++;
            setTimeout(type, typeSpeed);
        }
    }

    // Start typing after a delay
    setTimeout(type, 1000);
}

/* ==========================================
   Utility Functions
   ========================================== */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
