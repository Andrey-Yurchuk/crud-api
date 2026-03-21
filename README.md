## CRUD API (Fastify + TypeScript)

Simple CRUD API for a product catalog using an in-memory storage

### Stack
- Framework: Fastify
- Language: TypeScript
- Tooling: `tsx` (dev runner), `tsup` (build), ESLint, Prettier
- Utilities: `dotenv`, `cross-env`, `uuid`

### Requirements
- Node.js **24.x**
- npm **>= 9.0.0**

### Installation
```bash
git clone https://github.com/Andrey-Yurchuk/crud-api.git
cd crud-api
npm ci
cp .env.example .env
```

If you don't use `npm ci`, you can install dependencies with:

```bash
npm install
```

### Environment variables
- `PORT`: port for the app (default in `.env.example` is `4000`)
- `STATE_SERVICE_PORT`: internal state-service port for multi mode (default `4500`)
- `STATE_SERVICE_HOST`: internal state-service host for multi mode (default `127.0.0.1`)

### Run (development)
```bash
npm run start:dev
```

### Run (production)
```bash
npm run start:prod
```

**Note:** If you start production while another process is already running on the same port (e.g. after `start:dev`), you will get `EADDRINUSE`. Stop the running process or use a different `PORT` in `.env`.

### Run (multi-process cluster + load balancer)
Starts:
- load balancer on `PORT`
- workers on `PORT + 1..N` (round-robin)
- separate internal state-service on `STATE_SERVICE_HOST:STATE_SERVICE_PORT`

Workers are stateless and store/read data through the internal state-service.

```bash
npm run start:multi
```

#### Multi mode flow
```text
Request flow:
[1] Client
     |
     v
[2] Load Balancer (PORT, round-robin)
     |---------------------> [3] Worker 1 (PORT + 1) --\
     |---------------------> [3] Worker 2 (PORT + 2) ---+--> [4] State Service (STATE_SERVICE_HOST:STATE_SERVICE_PORT)
     |---------------------> [3] Worker N (PORT + N) --/

Response flow:
[4] State Service
     |
     v
[3] Worker (the same worker that handled request)
     |
     v
[2] Load Balancer
     |
     v
[1] Client

Workers are stateless and use one shared state-service for CRUD operations
```

### Tests
```bash
npm test
```

### Lint / format
```bash
npm run lint
npm run format
```

### API
Base URL (default): `http://localhost:4000`

#### Endpoints

| Method | Endpoint | Success | Error cases |
| --- | --- | --- | --- |
| GET | `/health` | 200 | 500 (server error) |
| GET | `/api/products` | 200 | 500 (server error) |
| GET | `/api/products/:productId` | 200 | 400 (invalid UUID), 404 (not found) |
| POST | `/api/products` | 201 | 400 (invalid body / price \<= 0) |
| PUT | `/api/products/:productId` | 200 | 400 (invalid UUID), 404 (not found) |
| DELETE | `/api/products/:productId` | 204 | 400 (invalid UUID), 404 (not found) |
| * | `/*` (unknown route) | - | 404 (not found) |

#### Health check
```bash
curl -i http://localhost:4000/health
```

#### Get all products
```bash
curl -i http://localhost:4000/api/products
```

#### Create a product
```bash
curl -i -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Book","description":"Good book","price":10.5,"category":"books","inStock":true}'
```

#### Get product by id
```bash
curl -i http://localhost:4000/api/products/<productId>
```

#### Update a product
```bash
curl -i -X PUT http://localhost:4000/api/products/<productId> \
  -H "Content-Type: application/json" \
  -d '{"name":"Book 2","description":"Better book","price":12,"category":"books","inStock":false}'
```

#### Delete a product
```bash
curl -i -X DELETE http://localhost:4000/api/products/<productId>
```

### Error examples
#### Invalid UUID - 400
```bash
curl -i http://localhost:4000/api/products/not-a-uuid
```

#### Not found (missing id) - 404
```bash
curl -i http://localhost:4000/api/products/00000000-0000-0000-0000-000000000000
```

#### Unknown endpoint - 404
```bash
curl -i http://localhost:4000/some-non/existing/resource
```
