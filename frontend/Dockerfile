# Etapa 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Desabilita telemetria do Next.js
ENV NEXT_TELEMETRY_DISABLED 1
# Define variável de build para produção
ENV NODE_ENV production
RUN npm run build

# Etapa 2: Runner (Imagem final leve)
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Cria usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia apenas os arquivos necessários do build anterior
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
# A URL da API deve ser definida no docker-compose ou runtime
# ENV NEXT_PUBLIC_API_URL http://localhost:8000 

CMD ["node", "server.js"]