# Nginx Alpine for serving static site on Cloud Run
FROM nginx:alpine

# Copy custom nginx config (handles 404, gzip, caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all website files
COPY . /usr/share/nginx/html

# Cloud Run requires port 8080
EXPOSE 8080
