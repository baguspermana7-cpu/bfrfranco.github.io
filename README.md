# Bagus Dwi Permana - Professional Portfolio

A modern, responsive portfolio website showcasing professional achievements in Engineering Operations and Data Center Infrastructure Leadership.

## Project Structure

```
├── index.html      # Main HTML file
├── styles.css      # All styling (CSS)
├── script.js       # JavaScript interactions
└── README.md       # This file
```

## Features

### Design
- Modern, clean design with professional blue/gray color scheme
- Gradient backgrounds and smooth animations
- Fully responsive layout (mobile, tablet, desktop)
- Professional typography using Google Fonts (Inter)

### Sections
1. **Hero Section** - Introduction with name, title, and tagline
2. **Key Metrics** - Animated counter displaying achievements
3. **Case Studies** - Detailed project showcases with outcomes
4. **About** - Personal background and core competencies
5. **Contact** - Contact form and information

### Interactive Elements
- Smooth scroll navigation
- Fade-in animations on scroll
- Animated metric counters
- Hover effects on cards and buttons
- Mobile-friendly hamburger menu
- Form validation with notifications

## Getting Started

### Option 1: Open Directly
Simply double-click `index.html` to open the website in your default browser.

### Option 2: Local Server (Recommended)
For the best experience, run a local server:

**Using Python:**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Using Node.js:**
```bash
# Install live-server globally
npm install -g live-server

# Run server
live-server
```

**Using VS Code:**
Install the "Live Server" extension and click "Go Live" in the status bar.

Then open `http://localhost:8000` in your browser.

## Customization

### Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --primary-gradient: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #3a7ca5 100%);
    --dark-blue: #1e3a5f;
    --medium-blue: #2d5a87;
    --light-blue: #4a90b8;
    /* ... more variables */
}
```

### Content
- Edit `index.html` to update text, metrics, and case studies
- Update contact information in the Contact section
- Modify social links as needed

### Fonts
Change the Google Fonts link in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Opera (latest)

## Performance Tips

1. Optimize images before adding them
2. Consider lazy loading for images
3. Minify CSS and JS for production
4. Enable gzip compression on your server

## Contact Form

The contact form currently simulates submission. To make it functional:

1. **Email Service**: Use services like Formspree, Netlify Forms, or EmailJS
2. **Backend**: Connect to your own backend API
3. **Example with Formspree**:
   ```html
   <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```

## License

This project is created for Bagus Dwi Permana's personal portfolio use.

## Credits

- Font: [Inter](https://fonts.google.com/specimen/Inter) by Rasmus Andersson
- Icons: Custom SVG icons
- Design & Development: Professional Portfolio Template
