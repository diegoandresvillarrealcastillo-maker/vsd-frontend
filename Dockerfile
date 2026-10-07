# ============================================================
#  VSD Health - imagen del frontend (SCRUM-132)
# ============================================================
#  Sirve la PWA ya compilada con nginx. Existe para el entorno
#  completo con un solo comando (docker compose, en vsd-backend)
#  y para el CI. EN PRODUCCION EL FRONTEND NO USA ESTA IMAGEN:
#  Vercel no ejecuta contenedores, compila y sirve por su cuenta.
#  Ver el ADR 0018 de vsd-backend.
#
#    docker build \
#      --build-arg VITE_API_BASE_URL=http://localhost:3000 \
#      --build-arg VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co \
#      --build-arg VITE_SUPABASE_ANON_KEY=la-clave-anonima \
#      -t vsd-web .
#    docker run --rm -p 8080:8080 vsd-web
#
#  IMPORTANTE: las VITE_* se incorporan al paquete AL COMPILAR,
#  no al ejecutar. Una imagen sirve para un solo ambiente: para
#  cambiar la direccion de la API hay que volver a construirla.
#  Son valores publicos (viajan al navegador de cualquiera); aqui
#  nunca debe entrar un secreto.
# ============================================================

ARG IMAGEN_DE_NODE=node:24.21-bookworm-slim
ARG IMAGEN_DE_NGINX=nginxinc/nginx-unprivileged:1.30-alpine

# ---------- 1. Compilacion ----------
FROM ${IMAGEN_DE_NODE} AS compilacion
WORKDIR /app

# HUSKY=0: `prepare` instala ganchos de git y aqui no hay repositorio.
ENV HUSKY=0 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Primero solo lo que decide las dependencias: cambiar el codigo no invalida
# esta capa.
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.sw.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
# `npm run build` termina comprobando el service worker ya compilado (SCRUM-135),
# y falla si no esta este archivo.
COPY scripts/comprobar-el-service-worker.mjs ./scripts/comprobar-el-service-worker.mjs

# Un ARG sin valor por omision queda sin definir, y la aplicacion usa entonces
# su respaldo (la API en localhost:3000) o dice cual variable falta. Los ARG
# llegan a Vite como variables de entorno durante el RUN, sin necesidad de ENV.
ARG VITE_APP_ENV=development
ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PROVEEDOR_GOOGLE
RUN npm run build

# ---------- 2. Ejecucion ----------
FROM ${IMAGEN_DE_NGINX} AS ejecucion

# nginx-unprivileged corre como el usuario `nginx` y escucha en el 8080.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html

EXPOSE 8080

# Lo lee `docker compose`. Sin curl en la imagen: wget de busybox.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
