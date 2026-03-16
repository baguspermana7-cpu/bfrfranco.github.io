/* ==========================================
   Bagus Dwi Permana - Portfolio Scripts
   ========================================== */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initDarkMode();
    initNavigation();
    initScrollAnimations();
    initMetricCounters();
    initSmoothScroll();
    initContactForm();
    initNavbarScroll();
    initScrollProgress();
    initCursorSpotlight();
    initCardTilt();
    try { initMotionEffects(); } catch(e) { console.warn('Motion effects init failed:', e); }
});

/* ==========================================
   Dark Mode Toggle
   ========================================== */
function initDarkMode() {
    const themeToggle = document.getElementById('themeToggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    // Get saved theme or use system preference
    function getPreferredTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            return savedTheme;
        }
        return prefersDarkScheme.matches ? 'dark' : 'light';
    }

    // Apply theme
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a0a14' : '#0066cc');
        }
    }

    // Initialize theme
    applyTheme(getPreferredTheme());

    // Toggle theme on button click
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);

            // Add a subtle animation to the toggle
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    }

    // Listen for system theme changes
    prefersDarkScheme.addEventListener('change', function(e) {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

/* ==========================================
   Navigation
   ========================================== */
function initNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const navDropdowns = document.querySelectorAll('.nav-dropdown');

    // Toggle mobile menu
    let savedScrollY = 0;
    hamburger?.addEventListener('click', function() {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        const isOpen = navMenu.classList.contains('active');
        if (isOpen) {
            savedScrollY = window.scrollY;
            document.body.classList.add('menu-open');
            document.body.style.top = `-${savedScrollY}px`;
        } else {
            document.body.classList.remove('menu-open');
            document.body.style.top = '';
            window.scrollTo(0, savedScrollY);
        }
        hamburger.setAttribute('aria-expanded', isOpen);
        hamburger.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    });

    // Helper: close mobile menu and restore scroll position
    function closeMenu() {
        hamburger?.classList.remove('active');
        navMenu?.classList.remove('active');
        navDropdowns.forEach(d => d.classList.remove('active'));
        if (document.body.classList.contains('menu-open')) {
            document.body.classList.remove('menu-open');
            document.body.style.top = '';
            window.scrollTo(0, savedScrollY);
        }
        hamburger?.setAttribute('aria-expanded', 'false');
        hamburger?.setAttribute('aria-label', 'Open navigation menu');
    }

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
                closeMenu();
            }
        });
    });

    // Close menu when clicking dropdown menu items
    const dropdownMenuLinks = document.querySelectorAll('.dropdown-menu a');
    dropdownMenuLinks.forEach(link => {
        link.addEventListener('click', function() {
            closeMenu();
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!hamburger?.contains(e.target) && !navMenu?.contains(e.target)) {
            closeMenu();
        }
    });
    
    // Update active nav link using IntersectionObserver (more efficient than scroll)
    const sections = document.querySelectorAll('section[id]');
    const allNavLinks = document.querySelectorAll('.nav-link');
    if (sections.length && allNavLinks.length) {
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    allNavLinks.forEach(link => {
                        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                    });
                }
            });
        }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
        sections.forEach(s => sectionObserver.observe(s));
    }
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

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!entry.target._counting) {
                    animateCounter(entry.target);
                }
            } else {
                // Reset to 90% of value when leaving viewport for snappy re-entry (#11)
                entry.target._counting = false;
                const target = parseFloat(entry.target.getAttribute('data-target'));
                const prefix = entry.target.getAttribute('data-prefix') || '';
                const suffix = entry.target.getAttribute('data-suffix') || '%';
                const startVal = Math.floor(target * 0.9);
                const displayVal = target % 1 !== 0 ? (target * 0.9).toFixed(1) : startVal;
                entry.target.textContent = prefix + displayVal + suffix;
            }
        });
    }, observerOptions);

    metricValues.forEach(metric => {
        observer.observe(metric);
    });
}

function animateCounter(element) {
    element._counting = true;
    const target = parseFloat(element.getAttribute('data-target'));
    const prefix = element.getAttribute('data-prefix') || '';
    const suffix = element.getAttribute('data-suffix') || '%';
    const startFrom = target * 0.9; // Start from 90% of value for snappy feel
    const duration = 800; // Fast animation — only 10% of range
    const steps = 30;
    const stepDuration = duration / steps;

    let step = 0;

    const timer = setInterval(() => {
        step++;
        // Ease from startFrom to target
        const current = easeOutQuad(step, startFrom, target - startFrom, steps);

        // Format the number
        let displayValue;
        if (target % 1 !== 0) {
            displayValue = current.toFixed(1);
        } else {
            displayValue = Math.round(current);
        }

        element.textContent = `${prefix}${displayValue}${suffix}`;

        if (step >= steps) {
            clearInterval(timer);
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

/* ==========================================
   Scroll Progress Bar
   ========================================== */
function initScrollProgress() {
    const progressBar = document.getElementById('scrollProgress');
    if (!progressBar) return;

    window.addEventListener('scroll', throttle(function() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = scrollPercent + '%';
    }, 50));
}

/* ==========================================
   Cursor Spotlight Effect
   ========================================== */
function initCursorSpotlight() {
    const spotlight = document.getElementById('cursorSpotlight');
    if (!spotlight) return;

    // Skip on touch devices (no cursor)
    if (!window.matchMedia('(pointer: fine)').matches) return;

    // Performance: hint GPU compositing
    spotlight.style.willChange = 'transform, left, top';

    let mouseX = 0, mouseY = 0;
    let spotX = 0, spotY = 0;
    let dirty = false;
    let rafId = null;

    document.addEventListener('mousemove', function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        spotlight.classList.add('active');
        if (!dirty) {
            dirty = true;
            if (!rafId) rafId = requestAnimationFrame(animateSpotlight);
        }
    });

    document.addEventListener('mouseleave', function() {
        spotlight.classList.remove('active');
        dirty = false;
    });

    // Smooth follow animation — only runs when mouse is moving
    function animateSpotlight() {
        spotX += (mouseX - spotX) * 0.1;
        spotY += (mouseY - spotY) * 0.1;
        spotlight.style.left = spotX + 'px';
        spotlight.style.top = spotY + 'px';

        // Stop animating once we've caught up (within 0.5px)
        if (Math.abs(mouseX - spotX) > 0.5 || Math.abs(mouseY - spotY) > 0.5) {
            rafId = requestAnimationFrame(animateSpotlight);
        } else {
            rafId = null;
            dirty = false;
        }
    }
}

/* ==========================================
   3D Card Tilt Effect
   ========================================== */
function initCardTilt() {
    // Skip on touch devices
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const cards = document.querySelectorAll('.metric-card, .case-card');

    cards.forEach(card => {
        let tiltRaf = null;

        // Add reflection overlay (#31) and holographic overlay (#35)
        var reflection = document.createElement('div');
        reflection.className = 'tilt-reflection';
        reflection.setAttribute('aria-hidden', 'true');
        card.style.position = 'relative';
        card.appendChild(reflection);

        var holoOverlay = document.createElement('div');
        holoOverlay.className = 'holo-overlay';
        holoOverlay.setAttribute('aria-hidden', 'true');
        card.appendChild(holoOverlay);

        card.addEventListener('mousemove', function(e) {
            if (tiltRaf) return;
            tiltRaf = requestAnimationFrame(() => {
                var rect = card.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                var centerX = rect.width / 2;
                var centerY = rect.height / 2;
                var rotateX = (y - centerY) / 20;
                var rotateY = (centerX - x) / 20;
                var percentX = (x / rect.width * 100).toFixed(1);
                var percentY = (y / rect.height * 100).toFixed(1);

                card.style.transform = 'perspective(1000px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateY(-10px) scale(1.02)';

                // Reflection follows mouse position (#31)
                reflection.style.setProperty('--reflect-x', percentX + '%');
                reflection.style.setProperty('--reflect-y', percentY + '%');

                // Holographic angle follows tilt (#35)
                var angle = Math.atan2(rotateX, rotateY) * (180 / Math.PI) + 135;
                holoOverlay.style.setProperty('--holo-angle', angle + 'deg');

                // Content parallax (#28) - move children slightly
                var children = card.querySelectorAll('.metric-icon, .metric-value, .case-title, .case-stat');
                var offsetX = (x - centerX) / centerX;
                var offsetY = (y - centerY) / centerY;
                children.forEach(function(child, i) {
                    var factor = (i + 1) * 3;
                    child.style.transform = 'translate(' + (offsetX * factor) + 'px, ' + (offsetY * factor) + 'px)';
                });

                tiltRaf = null;
            });
        });

        card.addEventListener('mouseleave', function() {
            if (tiltRaf) { cancelAnimationFrame(tiltRaf); tiltRaf = null; }
            card.style.transform = '';
            // Reset child transforms
            var children = card.querySelectorAll('.metric-icon, .metric-value, .case-title, .case-stat');
            children.forEach(function(child) { child.style.transform = ''; });
        });
    });
}

/* ==========================================
   50 Motion Effects Engine
   ========================================== */
function initMotionEffects() {
    // Guard: reduced motion
    var mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mqReduced.matches) return;

    var hasPointer = window.matchMedia('(pointer: fine)').matches;
    var isMobile = window.innerWidth <= 768;
    var lowEnd = (navigator.hardwareConcurrency || 4) < 4;

    // Shared state
    var scrollY = 0, lastScrollY = 0, scrollVelocity = 0;
    var mouseX = 0, mouseY = 0, pmouseX = 0, pmouseY = 0, mouseVX = 0, mouseVY = 0;
    var paused = false;

    // Named RAF references for proper cancellation
    var rafRefs = { parallax: null, vel: null, grid: null, orbs: null };

    function stopAllLoops() {
        paused = true;
        Object.keys(rafRefs).forEach(function(k) {
            if (rafRefs[k]) { cancelAnimationFrame(rafRefs[k]); rafRefs[k] = null; }
        });
    }

    function resumeLoops() {
        if (!paused) return;
        paused = false;
        // Loops will be restarted by their respective init fns if needed
    }

    // --- Scroll tracker (passive) ---
    var scrollTicking = false;
    window.addEventListener('scroll', function() {
        if (!scrollTicking) {
            scrollTicking = true;
            requestAnimationFrame(function() {
                lastScrollY = scrollY;
                scrollY = window.scrollY;
                scrollVelocity = Math.abs(scrollY - lastScrollY);
                scrollTicking = false;
            });
        }
    }, { passive: true });

    // --- Mouse tracker (passive) ---
    if (hasPointer && !isMobile) {
        document.addEventListener('mousemove', function(e) {
            pmouseX = mouseX; pmouseY = mouseY;
            mouseX = e.clientX; mouseY = e.clientY;
            mouseVX = mouseX - pmouseX;
            mouseVY = mouseY - pmouseY;
        }, { passive: true });
    }

    // --- Visibility API: pause/resume ---
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) stopAllLoops();
        else { paused = false; }
    });

    // Runtime reduced-motion toggle
    mqReduced.addEventListener('change', function(e) {
        if (e.matches) stopAllLoops();
    });

    // =============================================
    // CURSOR EFFECTS (1-7) — desktop only
    // =============================================
    if (hasPointer && !isMobile) {
        initCursorEffects();
    }

    function initCursorEffects() {
        // --- #1: Magnetic Cursor Pull ---
        var magneticEls = document.querySelectorAll('[data-magnetic], .nav-link, .theme-toggle');
        magneticEls.forEach(function(el) {
            el.addEventListener('mousemove', function(e) {
                var rect = el.getBoundingClientRect();
                var cx = rect.left + rect.width / 2;
                var cy = rect.top + rect.height / 2;
                var dx = e.clientX - cx;
                var dy = e.clientY - cy;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100 && dist > 0.1) {
                    var pull = (1 - dist / 100) * 12;
                    el.style.transform = 'translate(' + (dx / dist * pull).toFixed(1) + 'px,' + (dy / dist * pull).toFixed(1) + 'px)';
                }
            }, { passive: true });
            el.addEventListener('mouseleave', function() {
                el.style.transform = '';
            });
        });

        // --- #2: Cursor Trail Particles ---
        if (!lowEnd) {
            var trailContainer = document.createElement('div');
            trailContainer.className = 'cursor-trail-container';
            trailContainer.setAttribute('aria-hidden', 'true');
            trailContainer.setAttribute('role', 'presentation');
            document.body.appendChild(trailContainer);

            var trailPool = [];
            var TRAIL_SIZE = 20;
            for (var i = 0; i < TRAIL_SIZE; i++) {
                var p = document.createElement('div');
                p.className = 'cursor-trail-particle';
                trailContainer.appendChild(p);
                trailPool.push({ el: p, active: false });
            }
            var trailIdx = 0;
            var trailThrottle = 0;

            document.addEventListener('mousemove', function(e) {
                trailThrottle++;
                if (trailThrottle % 3 !== 0) return;
                var particle = trailPool[trailIdx % TRAIL_SIZE];
                trailIdx++;
                particle.el.style.left = e.clientX + 'px';
                particle.el.style.top = e.clientY + 'px';
                particle.el.style.opacity = '0.6';
                particle.el.style.transform = 'scale(1)';
                setTimeout(function() {
                    particle.el.style.opacity = '0';
                    particle.el.style.transform = 'scale(0) translateY(-20px)';
                }, 16);
            }, { passive: true });
        }

        // --- #3: Cursor Morphing Shape ---
        var customCursor = document.createElement('div');
        customCursor.className = 'custom-cursor';
        customCursor.setAttribute('aria-hidden', 'true');
        document.body.appendChild(customCursor);

        var cursorX = 0, cursorY = 0, cursorRaf = null;
        function animateCursor() {
            cursorX += (mouseX - cursorX) * 0.15;
            cursorY += (mouseY - cursorY) * 0.15;
            customCursor.style.left = cursorX + 'px';
            customCursor.style.top = cursorY + 'px';
            if (Math.abs(mouseX - cursorX) > 0.5 || Math.abs(mouseY - cursorY) > 0.5) {
                cursorRaf = requestAnimationFrame(animateCursor);
            } else {
                cursorRaf = null;
            }
        }
        document.addEventListener('mousemove', function() {
            customCursor.classList.add('active');
            if (!cursorRaf) cursorRaf = requestAnimationFrame(animateCursor);
        }, { passive: true });
        document.addEventListener('mouseleave', function() {
            customCursor.classList.remove('active');
        });

        // Morph shape based on hovered element
        document.addEventListener('mouseover', function(e) {
            var t = e.target;
            if (t.closest('a, button, [data-magnetic]')) {
                customCursor.className = 'custom-cursor active cursor-link';
            } else if (t.closest('.metric-card, .case-card, .oe-card, .bento-card')) {
                customCursor.className = 'custom-cursor active cursor-card';
            } else if (t.closest('p, h1, h2, h3, h4, span, li') && !t.closest('a, button')) {
                customCursor.className = 'custom-cursor active cursor-text';
            } else {
                customCursor.className = 'custom-cursor active';
            }
        }, { passive: true });

        // --- #4: Cursor Ripple on Click ---
        document.addEventListener('mousedown', function(e) {
            var ripple = document.createElement('div');
            ripple.className = 'click-ripple';
            ripple.style.left = e.clientX + 'px';
            ripple.style.top = e.clientY + 'px';
            document.body.appendChild(ripple);
            ripple.addEventListener('animationend', function() { ripple.remove(); });
        });

        // --- #5: Cursor Text Follower ---
        var follower = document.createElement('div');
        follower.className = 'cursor-text-follower';
        follower.setAttribute('aria-hidden', 'true');
        document.body.appendChild(follower);
        var followerX = 0, followerY = 0, followerRaf = null, followerVisible = false;

        function animateFollower() {
            followerX += (mouseX - followerX) * 0.12;
            followerY += (mouseY - followerY) * 0.12;
            follower.style.left = followerX + 'px';
            follower.style.top = (followerY - 40) + 'px';
            if (followerVisible && (Math.abs(mouseX - followerX) > 0.5 || Math.abs(mouseY - followerY) > 0.5)) {
                followerRaf = requestAnimationFrame(animateFollower);
            } else {
                followerRaf = null;
            }
        }

        var cardContainers = document.querySelectorAll('.case-card, .oe-card');
        cardContainers.forEach(function(card) {
            card.addEventListener('mouseenter', function() {
                var label = card.querySelector('.case-category, .oe-badge');
                if (label) {
                    follower.textContent = label.textContent.trim();
                    follower.classList.add('visible');
                    followerVisible = true;
                    if (!followerRaf) followerRaf = requestAnimationFrame(animateFollower);
                }
            });
            card.addEventListener('mouseleave', function() {
                follower.classList.remove('visible');
                followerVisible = false;
            });
        });

        // --- #6: Cursor Spotlight Upgrade ---
        var spotlight = document.getElementById('cursorSpotlight');
        if (spotlight) {
            var spotlightColors = {
                gold: 'radial-gradient(circle, rgba(245,158,11,0.08), rgba(255,107,53,0.04), transparent 70%)',
                amber: 'radial-gradient(circle, rgba(251,191,36,0.08), rgba(245,158,11,0.04), transparent 70%)',
                emerald: 'radial-gradient(circle, rgba(16,185,129,0.08), rgba(5,150,105,0.04), transparent 70%)',
                blue: 'radial-gradient(circle, rgba(74,144,184,0.08), rgba(45,90,135,0.04), transparent 70%)',
                teal: 'radial-gradient(circle, rgba(20,184,166,0.08), rgba(13,148,136,0.04), transparent 70%)'
            };
            var currentSpotColor = '';

            document.addEventListener('mousemove', function(e) {
                var section = e.target.closest('section[data-spotlight-color]');
                var color = section ? section.getAttribute('data-spotlight-color') : 'gold';
                if (color !== currentSpotColor) {
                    currentSpotColor = color;
                    spotlight.style.background = spotlightColors[color] || spotlightColors.gold;
                    // Size varies by section
                    var isHero = section && section.id === 'home';
                    spotlight.style.width = isHero ? '500px' : '350px';
                    spotlight.style.height = isHero ? '500px' : '350px';
                }
            }, { passive: true });
        }

        // --- #7: Cursor Velocity Blur ---
        if (spotlight) {
            function updateVelocityBlur() {
                if (paused) { rafRefs.vel = null; return; }
                var speed = Math.sqrt(mouseVX * mouseVX + mouseVY * mouseVY);
                var scaleX = 1 + Math.min(speed * 0.008, 0.4);
                var angle = Math.atan2(mouseVY, mouseVX) * (180 / Math.PI);
                spotlight.style.transform = 'translate(-50%,-50%) scaleX(' + scaleX.toFixed(2) + ') rotate(' + angle.toFixed(0) + 'deg)';
                rafRefs.vel = requestAnimationFrame(updateVelocityBlur);
            }
            rafRefs.vel = requestAnimationFrame(updateVelocityBlur);
        }
    }

    // =============================================
    // SCROLL EFFECTS (8-16)
    // =============================================
    initScrollEffects();

    function initScrollEffects() {
        // --- #8: Parallax Depth Layers ---
        var heroSection = document.getElementById('home');
        var heroBg = heroSection ? heroSection.querySelector('.hero-background') : null;
        var heroShapes = heroSection ? heroSection.querySelector('.floating-shapes') : null;
        var bentoContainer = heroSection ? heroSection.querySelector('.bento-container') : null;
        var heroInView = true;

        function updateParallax() {
            if (paused || !heroInView) { rafRefs.parallax = null; return; }
            var sy = scrollY;
            if (heroBg) heroBg.style.transform = 'translateY(' + (sy * 0.55).toFixed(1) + 'px) scale(' + (1 + sy * 0.0002).toFixed(4) + ')';
            if (heroShapes) heroShapes.style.transform = 'translateY(' + (sy * 0.35).toFixed(1) + 'px) rotate(' + (sy * 0.015).toFixed(2) + 'deg)';
            if (bentoContainer) bentoContainer.style.transform = 'translateY(' + (sy * 0.12).toFixed(1) + 'px)';
            rafRefs.parallax = requestAnimationFrame(updateParallax);
        }

        if (heroSection) {
            var heroIO = new IntersectionObserver(function(entries) {
                heroInView = entries[0].isIntersecting;
                if (heroInView && !rafRefs.parallax && !paused) {
                    rafRefs.parallax = requestAnimationFrame(updateParallax);
                }
            }, { threshold: 0 });
            heroIO.observe(heroSection);
        }
        if (heroInView) rafRefs.parallax = requestAnimationFrame(updateParallax);

        // --- #9: Scroll-Velocity Typography (lightweight — only updates CSS var) ---
        var sectionTitles = document.querySelectorAll('.section-title');
        window.addEventListener('scroll', throttle(function() {
            var ls = Math.min(scrollVelocity * 0.008, 1.5);
            document.documentElement.style.setProperty('--scroll-ls', ls.toFixed(2) + 'px');
        }, 150), { passive: true });

        // --- #10: Progressive Section Reveal ---
        var sections = document.querySelectorAll('section[id]');
        sections.forEach(function(sec) {
            // Don't clip the hero — it should be visible immediately
            if (sec.id !== 'home') sec.classList.add('section-reveal');
        });
        var revealIO = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    revealIO.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });
        sections.forEach(function(sec) { revealIO.observe(sec); });

        // --- #12: Staggered Card Cascade ---
        var grids = document.querySelectorAll('.metrics-grid, .oe-grid, .cases-grid');
        var cascadeIO = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var cards = entry.target.children;
                    for (var i = 0; i < cards.length; i++) {
                        cards[i].style.transitionDelay = (i * 80) + 'ms';
                        cards[i].classList.add('visible');
                    }
                    cascadeIO.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        grids.forEach(function(g) { cascadeIO.observe(g); });

        // --- #13: Scroll Progress per Section ---
        sections.forEach(function(sec) {
            var bar = document.createElement('div');
            bar.className = 'section-progress';
            bar.setAttribute('aria-hidden', 'true');
            sec.style.position = 'relative';
            sec.appendChild(bar);
        });
        window.addEventListener('scroll', throttle(function() {
            sections.forEach(function(sec) {
                var bar = sec.querySelector('.section-progress');
                if (!bar) return;
                var rect = sec.getBoundingClientRect();
                var vh = window.innerHeight;
                if (rect.top < vh && rect.bottom > 0) {
                    var progress = Math.max(0, Math.min(1, (vh - rect.top) / (rect.height + vh)));
                    bar.style.width = (progress * 100).toFixed(1) + '%';
                } else {
                    bar.style.width = '0%';
                }
            });
        }, 50), { passive: true });

        // --- #14: Elastic Overscroll Bounce (lightweight) ---
        var lastBounceTime = 0;
        var bounceIO = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                var now = Date.now();
                if (entry.isIntersecting && scrollVelocity > 25 && now - lastBounceTime > 1000) {
                    lastBounceTime = now;
                    var first = entry.target.querySelector('.section-header, .container, .bento-container');
                    if (first) {
                        first.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        first.style.transform = 'translateY(-4px)';
                        setTimeout(function() {
                            first.style.transform = '';
                            setTimeout(function() { first.style.transition = ''; }, 400);
                        }, 80);
                    }
                }
            });
        }, { threshold: 0.2 });
        sections.forEach(function(sec) { bounceIO.observe(sec); });

        // --- #15: Scroll-Linked Background Gradient ---
        window.addEventListener('scroll', throttle(function() {
            var docH = document.documentElement.scrollHeight - window.innerHeight;
            if (docH > 0) {
                var hue = 200 + (scrollY / docH) * 40;
                document.documentElement.style.setProperty('--scroll-hue', hue.toFixed(0));
            }
        }, 200), { passive: true });

        // --- #16: Horizontal Scroll Ticker on Scroll ---
        var tickerContent = document.querySelector('.ticker-content');
        if (tickerContent) {
            window.addEventListener('scroll', throttle(function() {
                var speed = Math.max(15, 30 - scrollVelocity * 0.3);
                tickerContent.style.animationDuration = speed.toFixed(0) + 's';
            }, 100), { passive: true });
        }
    }

    // =============================================
    // TEXT EFFECTS (17, 18, 20, 21, 24)
    // =============================================
    initTextEffects();

    function initTextEffects() {
        // --- #17: Split-Character Heading Reveal ---
        var splitTitles = document.querySelectorAll('.section-title');
        var splitIO = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting && !entry.target._split) {
                    entry.target._split = true;
                    // Skip if element contains nested markup (links, strong, etc.)
                    if (entry.target.innerHTML !== entry.target.textContent) {
                        splitIO.unobserve(entry.target);
                        return;
                    }
                    var text = entry.target.textContent;
                    entry.target.setAttribute('aria-label', text);
                    entry.target.innerHTML = '';
                    for (var i = 0; i < text.length; i++) {
                        var span = document.createElement('span');
                        if (text[i] === ' ') {
                            span.className = 'char-reveal space';
                            span.innerHTML = '&nbsp;';
                        } else {
                            span.className = 'char-reveal';
                            span.textContent = text[i];
                        }
                        span.setAttribute('aria-hidden', 'true');
                        span.style.transitionDelay = (i * 30) + 'ms';
                        entry.target.appendChild(span);
                    }
                    requestAnimationFrame(function() {
                        entry.target.querySelectorAll('.char-reveal').forEach(function(c) {
                            c.classList.add('visible');
                        });
                    });
                    splitIO.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        splitTitles.forEach(function(t) { splitIO.observe(t); });

        // --- #18: Typewriter Hero Title --- (desktop only — mobile shows immediately)
        var bentoName = document.querySelector('.bento-name');
        if (bentoName && !isMobile) {
            var originalText = bentoName.textContent;
            bentoName.style.borderRight = '3px solid var(--accent-gold)';
            bentoName.style.width = '0';
            bentoName.style.overflow = 'hidden';
            bentoName.style.whiteSpace = 'nowrap';
            bentoName.style.display = 'inline-block';
            var charIdx = 0;
            bentoName.textContent = '';
            function typeNext() {
                if (charIdx < originalText.length) {
                    bentoName.textContent += originalText[charIdx];
                    charIdx++;
                    setTimeout(typeNext, 60);
                } else {
                    bentoName.style.width = 'auto';
                    bentoName.style.overflow = 'visible';
                    bentoName.style.whiteSpace = 'normal';
                    // Blink then remove caret
                    setTimeout(function() { bentoName.style.borderRight = 'none'; }, 2000);
                }
            }
            setTimeout(typeNext, 500);
        }

        // --- #20: Word-by-Word Fade In ---
        var wordEls = document.querySelectorAll('.bento-desc, .about-text > p:first-child');
        var wordIO = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting && !entry.target._wordSplit) {
                    entry.target._wordSplit = true;
                    // Skip if element contains nested markup
                    if (entry.target.querySelector('a, strong, em, span, br')) {
                        wordIO.unobserve(entry.target);
                        return;
                    }
                    entry.target.setAttribute('aria-label', entry.target.textContent.trim());
                    var words = entry.target.textContent.trim().split(/\s+/);
                    entry.target.innerHTML = '';
                    words.forEach(function(word, i) {
                        var span = document.createElement('span');
                        span.className = 'word-reveal';
                        span.textContent = word + ' ';
                        span.style.transitionDelay = (i * 40) + 'ms';
                        entry.target.appendChild(span);
                    });
                    requestAnimationFrame(function() {
                        entry.target.querySelectorAll('.word-reveal').forEach(function(w) {
                            w.classList.add('visible');
                        });
                    });
                    wordIO.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        wordEls.forEach(function(el) { wordIO.observe(el); });

        // --- #21: Scramble Text Reveal ---
        var scrambleEls = document.querySelectorAll('.case-number, .oe-number');
        var chars = '0123456789ABCDEF#$%';
        var scrambleIO = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting && !entry.target._scrambled) {
                    entry.target._scrambled = true;
                    var final = entry.target.textContent;
                    var iterations = 0;
                    var interval = setInterval(function() {
                        entry.target.textContent = final.split('').map(function(c, i) {
                            if (i < iterations) return final[i];
                            return chars[Math.floor(Math.random() * chars.length)];
                        }).join('');
                        iterations += 1 / 3;
                        if (iterations >= final.length) {
                            entry.target.textContent = final;
                            clearInterval(interval);
                        }
                    }, 30);
                    scrambleIO.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        scrambleEls.forEach(function(el) { scrambleIO.observe(el); });

        // --- #24: Glitch Text on Hover ---
        var glitchTitles = document.querySelectorAll('.section-title');
        glitchTitles.forEach(function(title) {
            title.addEventListener('mouseenter', function() {
                title.classList.add('glitch-active');
            });
            title.addEventListener('animationend', function() {
                title.classList.remove('glitch-active');
            });
        });
    }

    // =============================================
    // CARD EFFECTS (25, 26, 30, 33)
    // =============================================
    initCardEffects();

    function initCardEffects() {
        // --- #25: Card Flip Preview --- (only on desktop hover)
        if (hasPointer && !isMobile) {
            var caseCards = document.querySelectorAll('.case-card[data-flip-text]');
            caseCards.forEach(function(card) {
                var backDiv = document.createElement('div');
                backDiv.className = 'case-card-back';
                backDiv.textContent = card.getAttribute('data-flip-text');
                backDiv.setAttribute('aria-hidden', 'true');
                card.appendChild(backDiv);

                var flipping = false;
                card.addEventListener('mouseenter', function() {
                    if (!flipping) {
                        flipping = true;
                        card.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
                        card.style.transformStyle = 'preserve-3d';
                        // Don't fully flip — rotate 15deg as teaser
                        card.style.transform = 'perspective(1200px) rotateY(12deg)';
                    }
                });
                card.addEventListener('mouseleave', function() {
                    flipping = false;
                    card.style.transform = '';
                });
            });
        }

        // --- #26: Card Border Light Trail ---
        if (hasPointer && !isMobile) {
            var trailCards = document.querySelectorAll('.metric-card, .case-card');
            trailCards.forEach(function(card) {
                var dot = document.createElement('div');
                dot.className = 'border-trail-dot';
                dot.setAttribute('aria-hidden', 'true');
                card.style.position = 'relative';
                card.appendChild(dot);

                card.addEventListener('mouseenter', function() { dot.style.opacity = '1'; });
                card.addEventListener('mouseleave', function() { dot.style.opacity = '0'; });
            });
        }

        // --- #30: Hover Expand Preview ---
        // CSS handles via .oe-desc line-clamp. JS adds smooth height animation.
        var oeCards = document.querySelectorAll('.oe-card');
        oeCards.forEach(function(card) {
            var desc = card.querySelector('.oe-desc');
            if (desc) {
                card.addEventListener('mouseenter', function() {
                    desc.style.webkitLineClamp = 'unset';
                    desc.style.maxHeight = desc.scrollHeight + 'px';
                });
                card.addEventListener('mouseleave', function() {
                    desc.style.webkitLineClamp = '2';
                    desc.style.maxHeight = '3em';
                });
            }
        });

        // --- #33: Career Card Spread ---
        // CSS handles via .bento-row-career:hover — no additional JS needed
    }

    // =============================================
    // BUTTON EFFECTS (37, 41)
    // =============================================
    if (hasPointer && !isMobile) {
        initButtonEffects();
    }

    function initButtonEffects() {
        // --- #37: Button Magnetic Snap ---
        var btns = document.querySelectorAll('.btn, .btn-primary, .btn-bento-primary, .btn-explore-articles');
        btns.forEach(function(btn) {
            btn.addEventListener('mousemove', function(e) {
                var rect = btn.getBoundingClientRect();
                var cx = rect.left + rect.width / 2;
                var cy = rect.top + rect.height / 2;
                var dx = e.clientX - cx;
                var dy = e.clientY - cy;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 60 && dist > 0.1) {
                    var pull = (1 - dist / 60) * 6;
                    btn.style.transform = 'translate(' + (dx / dist * pull).toFixed(1) + 'px,' + (dy / dist * pull).toFixed(1) + 'px)';
                }
            }, { passive: true });
            btn.addEventListener('mouseleave', function() {
                btn.style.transform = '';
            });
        });

        // --- #41: Material Ripple on Click ---
        var rippleBtns = document.querySelectorAll('.btn, .btn-primary, .btn-secondary, .btn-bento-primary, .btn-explore-articles');
        rippleBtns.forEach(function(btn) {
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            btn.addEventListener('click', function(e) {
                var rect = btn.getBoundingClientRect();
                var ripple = document.createElement('span');
                ripple.className = 'material-ripple';
                var size = Math.max(rect.width, rect.height);
                ripple.style.width = size + 'px';
                ripple.style.height = size + 'px';
                ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
                ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
                btn.appendChild(ripple);
                ripple.addEventListener('animationend', function() { ripple.remove(); });
            });
        });
    }

    // =============================================
    // BACKGROUND EFFECTS (45, 46, 47)
    // =============================================
    initBackgroundEffects();

    function initBackgroundEffects() {
        // --- #45: Aurora Borealis ---
        // Aurora orbs are in HTML, CSS handles animation. JS adds mouse reactivity.
        if (hasPointer && !isMobile && !lowEnd) {
            var orbs = document.querySelectorAll('.aurora-orb');
            if (orbs.length) {
                window.addEventListener('mousemove', throttle(function() {
                    var wx = mouseX / window.innerWidth;
                    var wy = mouseY / window.innerHeight;
                    orbs.forEach(function(orb, i) {
                        var offsetX = (wx - 0.5) * (15 + i * 10);
                        var offsetY = (wy - 0.5) * (10 + i * 8);
                        orb.style.marginLeft = offsetX.toFixed(1) + 'px';
                        orb.style.marginTop = offsetY.toFixed(1) + 'px';
                    });
                }, 50), { passive: true });
            }
        }

        // --- #46: Grid Pattern Reveal ---
        if (hasPointer && !isMobile && !lowEnd) {
            var gridCanvas = document.createElement('canvas');
            gridCanvas.className = 'grid-reveal-canvas';
            gridCanvas.setAttribute('aria-hidden', 'true');
            gridCanvas.setAttribute('role', 'presentation');
            document.body.appendChild(gridCanvas);
            var gCtx = gridCanvas.getContext('2d');
            var gridSpacing = 25;
            var gridRadius = 250;

            function resizeGridCanvas() {
                gridCanvas.width = window.innerWidth;
                gridCanvas.height = window.innerHeight;
            }
            resizeGridCanvas();
            window.addEventListener('resize', debounce(resizeGridCanvas, 200));

            var gridDirty = false;
            function drawGrid() {
                gCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
                var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                var dotColor = isDark ? '255,255,255' : '30,58,95';

                var startX = Math.max(0, Math.floor((mouseX - gridRadius) / gridSpacing) * gridSpacing);
                var endX = Math.min(gridCanvas.width, mouseX + gridRadius);
                var startY = Math.max(0, Math.floor((mouseY - gridRadius) / gridSpacing) * gridSpacing);
                var endY = Math.min(gridCanvas.height, mouseY + gridRadius);

                for (var x = startX; x <= endX; x += gridSpacing) {
                    for (var y = startY; y <= endY; y += gridSpacing) {
                        var dist = Math.sqrt((x - mouseX) * (x - mouseX) + (y - mouseY) * (y - mouseY));
                        if (dist < gridRadius) {
                            var alpha = (1 - dist / gridRadius) * 0.2;
                            gCtx.fillStyle = 'rgba(' + dotColor + ',' + alpha.toFixed(3) + ')';
                            gCtx.beginPath();
                            gCtx.arc(x, y, 2, 0, Math.PI * 2);
                            gCtx.fill();
                        }
                    }
                }
                gridDirty = false;
            }
            document.addEventListener('mousemove', function() {
                if (!gridDirty && !paused) {
                    gridDirty = true;
                    requestAnimationFrame(drawGrid);
                }
            }, { passive: true });
        }

        // --- #47: Mouse-Reactive Gradient Orbs ---
        if (hasPointer && !isMobile && !lowEnd) {
            var orbConfigs = [
                { class: 'gradient-orb-1', lerp: 0.02 },
                { class: 'gradient-orb-2', lerp: 0.04 },
                { class: 'gradient-orb-3', lerp: 0.06 }
            ];
            var orbEls = [];
            orbConfigs.forEach(function(cfg) {
                var orb = document.createElement('div');
                orb.className = 'gradient-orb ' + cfg.class;
                orb.setAttribute('aria-hidden', 'true');
                document.body.appendChild(orb);
                orbEls.push({ el: orb, x: window.innerWidth / 2, y: window.innerHeight / 2, lerp: cfg.lerp });
            });

            // Cache sizes after render
            requestAnimationFrame(function() {
                orbEls.forEach(function(o) { o.w = o.el.offsetWidth; o.h = o.el.offsetHeight; });
            });

            function animateOrbs() {
                if (paused) { rafRefs.orbs = null; return; }
                orbEls.forEach(function(o) {
                    o.x += (mouseX - o.x) * o.lerp;
                    o.y += (mouseY - o.y) * o.lerp;
                    o.el.style.left = (o.x - (o.w || 300) / 2) + 'px';
                    o.el.style.top = (o.y - (o.h || 300) / 2) + 'px';
                });
                rafRefs.orbs = requestAnimationFrame(animateOrbs);
            }
            rafRefs.orbs = requestAnimationFrame(animateOrbs);
        }
    }

    // =============================================
    // NAVIGATION EFFECTS (49, 50)
    // =============================================
    initNavEffects();

    function initNavEffects() {
        // --- #49: Navbar Hover Indicator Slide ---
        var indicator = document.querySelector('.nav-indicator');
        var navLinks = document.querySelectorAll('.nav-menu .nav-link');
        if (indicator && navLinks.length) {
            navLinks.forEach(function(link) {
                link.addEventListener('mouseenter', function() {
                    var rect = link.getBoundingClientRect();
                    var navRect = link.closest('.nav-container').getBoundingClientRect();
                    indicator.style.left = (rect.left - navRect.left) + 'px';
                    indicator.style.width = rect.width + 'px';
                    indicator.style.opacity = '1';
                });
            });
            var navMenu = document.querySelector('.nav-menu');
            if (navMenu) {
                navMenu.addEventListener('mouseleave', function() {
                    indicator.style.opacity = '0';
                });
            }
        }

        // --- #50: Scroll-to-Top Morphing Button ---
        var scrollBtn = document.querySelector('.scroll-top-btn');
        if (scrollBtn) {
            var progressText = document.createElement('span');
            progressText.className = 'progress-text';
            progressText.setAttribute('aria-hidden', 'true');
            scrollBtn.appendChild(progressText);

            window.addEventListener('scroll', throttle(function() {
                var docH = document.documentElement.scrollHeight - window.innerHeight;
                if (docH > 0) {
                    var pct = Math.round((scrollY / docH) * 100);
                    if (pct > 10 && pct < 95) {
                        scrollBtn.classList.add('morphed');
                        progressText.textContent = pct + '%';
                    } else {
                        scrollBtn.classList.remove('morphed');
                    }
                }
            }, 100), { passive: true });
        }
    }

    // --- #23: Text Shadow Depth on Scroll ---
    var heroTitle = document.querySelector('.bento-name');
    if (heroTitle) {
        window.addEventListener('scroll', throttle(function() {
            var depth = Math.min(scrollY * 0.03, 12);
            heroTitle.style.textShadow = '0 ' + depth.toFixed(1) + 'px ' + (depth * 2).toFixed(1) + 'px rgba(0,0,0,0.12), 0 ' + (depth * 0.5).toFixed(1) + 'px ' + depth.toFixed(1) + 'px rgba(245,158,11,0.06)';
        }, 50), { passive: true });
    }

    // --- Cleanup on page unload ---
    window.addEventListener('beforeunload', function() {
        stopAllLoops();
    });
}
