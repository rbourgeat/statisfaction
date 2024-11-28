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
WORKDIR /app/

COPY backend/ .

COPY --from=frontend-builder /app/frontend/out frontend/out
COPY --from=frontend-builder /app/frontend/public frontend/public

RUN npm install

CMD ["node", "server.js"]
