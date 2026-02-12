# Gunakan Nginx versi ringan
FROM nginx:alpine

# Copy semua file website Bapak ke dalam folder Nginx
COPY . /usr/share/nginx/html

# Trik Sakti: Ubah port default Nginx (80) ke 8080 agar disukai Cloud Run
RUN sed -i 's/listen       80;/listen       8080;/g' /etc/nginx/conf.d/default.conf

# Buka jalur 8080
EXPOSE 8080