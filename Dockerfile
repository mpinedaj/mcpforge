# Build stage
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json vitest.config.ts ./
COPY packages ./packages
COPY examples ./examples
RUN npm ci
RUN npm run build
RUN node packages/cli/dist/index.js generate examples/petstore.yaml -o examples/petstore.mcpforge.json

# Keep build/test tooling out of the published runtime dependencies.
FROM build AS production-dependencies
RUN npm prune --omit=dev

# Runtime stage
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-dependencies /app/package.json /app/package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/packages ./packages
COPY --from=production-dependencies /app/examples ./examples

EXPOSE 7331
ENTRYPOINT ["node", "packages/cli/dist/index.js"]
CMD ["serve", "--manifest", "examples/petstore.mcpforge.json", "--http", "--host", "0.0.0.0"]
