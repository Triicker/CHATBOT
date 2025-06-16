# Usamos uma imagem base do Node
FROM node:18-alpine

# Define o diretório de trabalho no contêiner
WORKDIR /usr/src/app

# Copia o package*.json para o contêiner
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Agora copiamos o restante do código
COPY . .

# Define o comando pra rodar o bot
CMD ["node", "chatbot.js"]

# Expoe a porta, se preciso (dependendo da sua aplicação)
EXPOSE 3000
