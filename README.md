# Instat Pump Backend

Express + TypeORM + Pump SDK service for creating tokens on Pump.fun and streaming deployment status via SSE.

## Features

- 🔐 Secure metadata storage (SQLite + TypeORM)
- 🚀 Direct Pump.fun token creation (Pump SDK v2)
- 📡 Server-Sent Events (SSE) for real-time status updates
- 💾 TypeORM migrations for schema management
- 🔌 RESTful API for token creation workflow

## Quick Start

### Prerequisites

- Node.js 18+
- npm/yarn
- Solana wallet with funds (for mainnet deployment)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Solana wallet and RPC endpoint
   ```

3. **Run migrations:**
   ```bash
   npm run migration:run
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

Server runs on `http://localhost:3000`

## API Endpoints

### POST `/api/metadata`
Store token metadata and get metadata URI.

**Request:**
```json
{
  "name": "My Token",
  "symbol": "MTK",
  "description": "Token description",
  "imageBase64": "data:image/png;base64,...",
  "twitter": "https://twitter.com/...",
  "telegram": "https://t.me/...",
  "website": "https://..."
}
```

**Response:**
```json
{
  "id": "uuid",
  "metadataUri": "http://localhost:3000/metadata/uuid",
  "status": "pending"
}
```

### GET `/metadata/:id`
Retrieve token metadata as JSON (used by Pump program).

### POST `/api/publish`
Create token on Pump.fun and stream status updates.

**Request:**
```json
{
  "metadataId": "uuid",
  "buyAmount": 0.1
}
```

**Response:**
```json
{
  "id": "uuid",
  "statusEndpoint": "/api/tx/uuid"
}
```

### GET `/api/tx/:id` (Server-Sent Events)
Stream token creation status in real-time.

**Event types:**
- `connected` - SSE connection established
- `status` - Creation progress update
- `error` - Deployment error

**Event data:**
```json
{
  "status": "creating|created|buying|deployed|failed",
  "mint": "token_mint_address",
  "tx": "transaction_signature",
  "message": "Status message",
  "error": "Error message (if failed)"
}
```

### GET `/health`
Health check endpoint.

## Architecture

```
Request Flow:
  Client (Extension)
    ↓
  POST /api/metadata    ← Store metadata
    ↓
  POST /api/publish     ← Trigger token creation
    ↓
  GET /api/tx/:id (SSE) ← Stream status updates
    ↓
  Backend (async)
    ├→ Validate metadata
    ├→ Create Pump token (SDK)
    ├→ Sign with server wallet
    ├→ Broadcast to Solana
    └→ Stream status back via SSE
```

## Database Schema

**TokenMetadata Table:**
- `id` (UUID) - Primary key
- `name` (text) - Token name
- `symbol` (text) - Token symbol
- `description` (text) - Token description
- `imageBase64` (text) - Base64 encoded image
- `imageUrl` (text) - Optional IPFS/CDN URL
- `twitter`, `telegram`, `website` (text) - Social links
- `metadataUri` (text) - URI pointing to metadata JSON
- `mintAddress` (text) - Created token mint address
- `txSignature` (text) - Creation transaction signature
- `buyAmount` (float) - Optional initial buy amount in SOL
- `status` (text) - pending|generating|created|buying|deployed|failed
- `creatorAddress` (text) - Creator wallet address
- `createdAt`, `updatedAt` (datetime) - Timestamps

## Docker Deployment

```bash
docker-compose up -d
```

See `docker-compose.yml` for configuration.

## Development

- `npm run dev` - Start with ts-node
- `npm run build` - Compile TypeScript
- `npm run start` - Run compiled JS
- `npm run migration:generate` - Generate new migration
- `npm run migration:run` - Apply migrations

## Environment Variables

See `.env.example` for required variables:

- `SOLANA_RPC_URL` - Solana RPC endpoint
- `SOLANA_WALLET_SECRET_KEY` - Base64 encoded Keypair for signing
- `PUMP_PROGRAM_ID` - Pump.fun program address (usually fixed)
- `DATABASE_PATH` - SQLite database file path
- `METADATA_BASE_URL` - Base URL for metadata endpoints
- `CORS_ORIGIN` - Allowed CORS origins
- `PORT` - Server port

## License

MIT
