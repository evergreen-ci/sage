# Sage - Evergreen AI Service

A TypeScript Express.js server for the Evergreen AI Service.

## Getting Started

### Prerequisites

- Node.js (version 22 or higher)
- Yarn package manager

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies using Yarn:

```bash
yarn install
```

3. Set up environment variables:

```bash
cp env-example .env
```

Edit the `.env` file with your specific configuration values.

### Project Structure

```
sage/
├── src/
│   ├── config/
│   │   └── index.ts          # Configuration management
│   └── server.ts             # Main server file
├── dist/                     # Compiled JavaScript (generated)
├── env-example              # Environment variables template
├── package.json
├── tsconfig.json            # TypeScript configuration
└── README.md
```

### Configuration

The application uses environment variables for configuration. All configuration is managed through the `src/config/index.ts` file.

#### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment (development/production) | `development` | Recommended |

#### Configuration Features

- **Type Safety**: All environment variables are properly typed
- **Default Values**: Sensible defaults for all non-required variables
- **Validation**: Automatic validation of required variables on startup

### Running the Server

#### Development Mode
```bash
yarn dev
```
This will start the server with ts-node-dev for automatic restarts on file changes and TypeScript compilation.

#### Production Mode
```bash
yarn build
yarn start
```

#### Clean Build
```bash
yarn clean
```
Removes the `dist/` directory.

The server will start on port 3000 by default (or the port specified in the `PORT` environment variable).

### API Endpoints

#### Root Endpoint
- **GET** `/` - Returns a welcome message and server information

#### Health Check
- **GET** `/health` - Returns server health status and timestamp

