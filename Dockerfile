# Build stage
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY packages ./packages
RUN npm ci
RUN npm run build
RUN node packages/cli/dist/index.js generate examples/petstore.yaml -o examples/petstore.mcpforge.json

# Runtime stage
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/examples ./examples

EXPOSE 7331
ENTRYPOINT ["node", "packages/cli/dist/index.js"]
CMD ["serve", "--manifest", "examples/petstore.mcpforge.json", "--http", "--host", "0.0.0.0"]
