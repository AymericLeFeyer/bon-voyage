# --- Build ---
FROM node:24-bookworm AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime ---
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=42069
# DATABASE_URL est fournie par le docker-compose (service `db`).

# node_modules (dont tsx, requis au runtime par `npm start`) + build + sources serveur
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/tsconfig*.json ./

EXPOSE 42069

CMD ["npm", "start"]
