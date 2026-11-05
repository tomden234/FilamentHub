# FilamentHub Server als Home-Assistant-App: holt beim Bauen den neuesten Code von GitHub, baut Server und Oberfläche (App direkt vom Pi).
FROM node:22-alpine

RUN apk add --no-cache git ffmpeg tzdata

WORKDIR /app

# Ändert sich, sobald es neuen Code auf GitHub gibt: Docker baut dann neu, statt eine alte Kopie zu behalten
ADD https://api.github.com/repos/tomden234/filament-website-google-ai/git/refs/heads/main /tmp/ref.json

RUN git clone --depth 1 --branch main https://github.com/tomden234/filament-website-google-ai . \
 && npm ci --ignore-scripts --no-audit --no-fund \
 && npm run build:server \
 && npm run build \
 && rm -rf /root/.npm

COPY start.mjs /start.mjs

ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FILAMENT_DATA_DIR=/data

CMD ["node", "/start.mjs"]
