#######################################
#            FRONTEND BUILD           #
#######################################

FROM node:23-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/ .
RUN npm install
RUN npm run build

#######################################
#            BACKEND BUILD            #
#######################################

FROM node:23-alpine
WORKDIR /app

COPY backend backend/
COPY config.json .

COPY --from=frontend-builder /app/frontend/.next frontend/.next
COPY --from=frontend-builder /app/frontend/public frontend/public
COPY --from=frontend-builder /app/frontend/package.json frontend/package.json

RUN npm install express axios cors

WORKDIR /app/frontend
RUN npm install --omit=dev

WORKDIR /app
CMD ["sh", "-c", "node backend/server.js & npm --prefix frontend run start"]