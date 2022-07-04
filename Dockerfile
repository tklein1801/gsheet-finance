FROM node:alpine

LABEL org.opencontainers.image.source https://github.com/DulliAG/gsheet-finance

WORKDIR /usr/src/gsheet-finance/

COPY package*.json ./

COPY credentials.json ./

RUN --mount=type=secret,id=npm,target=.npmrc npm install

COPY . .

CMD ["npm", "start"]