# Etapa 1: Base con dependencias
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Etapa para Desarrollo (Vite Dev Server con hot-reload)
FROM base AS dev
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host"]

# Etapa de Compilación
FROM base AS builder
RUN npm run build

# Etapa 2: Producción (Servidor web Nginx ligero)
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración Nginx para rutas SPA (Single Page Application)
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
