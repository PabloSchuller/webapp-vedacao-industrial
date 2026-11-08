FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_URL=http://localhost:3001
ARG VITE_OSM_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ENV VITE_OSM_TILE_URL=$VITE_OSM_TILE_URL
ENV VITE_API_URL=$VITE_API_URL
EXPOSE 5173
CMD ["npm","run","dev"]
