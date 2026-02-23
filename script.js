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
    initParticles();
    initScrollProgress();
    initCursorSpotlight();
    initCardTilt();
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

/* ==========================================
   Floating Particles System
   ========================================== */
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null, radius: 150 };
    let animationId;

    // Set canvas size
    function resizeCanvas() {
        const hero = document.querySelector('.hero');
        if (hero) {
            canvas.width = hero.offsetWidth;
            canvas.height = hero.offsetHeight;
        }
    }

    // Particle class
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 4 + 2;
            this.baseX = this.x;
            this.baseY = this.y;
            this.density = (Math.random() * 30) + 1;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.6 + 0.3;
            // Assign color once at creation - warm palette
            const colorIndex = Math.floor(Math.random() * 3);
            this.color = colorIndex === 0 ? [245, 158, 11] :
                         colorIndex === 1 ? [251, 191, 36] : [255, 107, 53];
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.opacity})`;
            ctx.fill();

            // Warm glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, 0.5)`;
        }

        update() {
            // Mouse interaction
            if (mouse.x !== null && mouse.y !== null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius) {
                    let forceDirectionX = dx / distance;
                    let forceDirectionY = dy / distance;
                    let maxDistance = mouse.radius;
                    let force = (maxDistance - distance) / maxDistance;
                    let directionX = forceDirectionX * force * this.density * 0.5;
                    let directionY = forceDirectionY * force * this.density * 0.5;

                    this.x -= directionX;
                    this.y -= directionY;
                }
            }

            // Floating movement
            this.x += this.speedX;
            this.y += this.speedY;

            // Boundary check with smooth wrap
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;

            this.draw();
        }
    }

    // Initialize particles
    function initParticleArray() {
        particles = [];
        const numberOfParticles = Math.min(30, Math.floor((canvas.width * canvas.height) / 20000));
        for (let i = 0; i < numberOfParticles; i++) {
            particles.push(new Particle());
        }
    }

    // Connect particles with lines
    function connectParticles() {
        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                let dx = particles[a].x - particles[b].x;
                let dy = particles[a].y - particles[b].y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) {
                    let opacity = 1 - (distance / 150);
                    // Warm gold connection lines
                    ctx.strokeStyle = `rgba(245, 158, 11, ${opacity * 0.3})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.shadowBlur = 0;

        for (let particle of particles) {
            particle.update();
        }

        connectParticles();
        animationId = requestAnimationFrame(animate);
    }

    // Event listeners
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.addEventListener('mousemove', function(e) {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });

        hero.addEventListener('mouseleave', function() {
            mouse.x = null;
            mouse.y = null;
        });
    }

    window.addEventListener('resize', debounce(function() {
        resizeCanvas();
        initParticleArray();
    }, 200));

    // Reduce particles on mobile for performance
    function checkMobile() {
        if (window.innerWidth <= 768) {
            cancelAnimationFrame(animationId);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            if (!animationId) {
                animate();
            }
        }
    }

    // Initialize
    resizeCanvas();
    initParticleArray();
    animate();

    // Check on resize
    window.addEventListener('resize', debounce(checkMobile, 300));
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
    }, 10));
}

/* ==========================================
   Cursor Spotlight Effect
   ========================================== */
function initCursorSpotlight() {
    const spotlight = document.getElementById('cursorSpotlight');
    if (!spotlight) return;

    // Only enable on desktop
    if (window.innerWidth <= 768) return;

    let mouseX = 0, mouseY = 0;
    let spotX = 0, spotY = 0;

    document.addEventListener('mousemove', function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        spotlight.classList.add('active');
    });

    document.addEventListener('mouseleave', function() {
        spotlight.classList.remove('active');
    });

    // Smooth follow animation
    function animateSpotlight() {
        spotX += (mouseX - spotX) * 0.1;
        spotY += (mouseY - spotY) * 0.1;
        spotlight.style.left = spotX + 'px';
        spotlight.style.top = spotY + 'px';
        requestAnimationFrame(animateSpotlight);
    }

    animateSpotlight();
}

/* ==========================================
   3D Card Tilt Effect
   ========================================== */
function initCardTilt() {
    const cards = document.querySelectorAll('.metric-card, .case-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', function(e) {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `
                perspective(1000px)
                rotateX(${rotateX}deg)
                rotateY(${rotateY}deg)
                translateY(-10px)
                scale(1.02)
            `;
        });

        card.addEventListener('mouseleave', function() {
            card.style.transform = '';
        });
    });
}
