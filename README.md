# TypeScript Coverage Improvement System

A NestJS-based system that scans TypeScript test coverage, identifies files under threshold, and automatically creates improvement jobs using AI to generate tests.

## Features

- **Coverage Scanning**: Analyzes TypeScript test coverage using nyc
- **Threshold Detection**: Identifies files below coverage threshold
- **Job Management**: SQLite-based job queue with per-repo serialization
- **Automated Improvements**: Clones repos, runs AI CLI in sandbox, commits tests, opens PRs
- **CLI Interface**: Command-line tools for management
- **HTTP API**: RESTful endpoints for coverage and job management
- **Dashboard**: Minimal web interface for monitoring
- **Observability**: Robust error handling, retry logic, and logging

## Architecture

Built with Domain-Driven Design (DDD) principles:

```
src/
├── domain/           # Core business logic
│   ├── entities/     # Domain entities (Repository, CoverageReport, Job)
│   ├── value-objects/ # Value objects (Coverage, JobStatus)
│   ├── services/     # Domain services
│   └── events/       # Domain events
├── application/      # Application layer
│   ├── dtos/         # Data transfer objects
│   └── use-cases/    # Application use cases
├── infrastructure/   # Infrastructure layer
│   ├── repositories/ # Data access implementations
│   ├── adapters/     # External service adapters (GitHub, Git)
│   ├── persistence/  # Database entities and migrations
│   └── workers/      # Background job processors
├── api/             # API layer
│   ├── controllers/  # HTTP controllers
│   └── dtos/        # API DTOs
└── cli/             # CLI interface
```

## Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended)
  - Docker 20.10+
  - Docker Compose 2.0+

**OR**

- **Manual Setup**
  - Node.js 18+
  - Git CLI
  - Docker (for AI CLI isolation)
  - GitHub account with personal access token or GitHub App

### Installation with Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/coverage-improvement-system.git
cd coverage-improvement-system

# 2. Copy environment variables
cp .env.example .env

# 3. Configure your environment
# Edit .env with your GitHub token and settings
nano .env

# 4. Start with Docker Compose
docker-compose up

# Or run in detached mode
docker-compose up -d
```

The application will be available at:
- API: http://localhost:3000/api
- Dashboard: http://localhost:3000

See [docs/DOCKER.md](./docs/DOCKER.md) for detailed Docker documentation.

### Manual Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/coverage-improvement-system.git
cd coverage-improvement-system

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env

# 4. Configure your environment
# Edit .env with your GitHub token and settings (see Configuration below)
nano .env

# 5. Run database migrations (if any)
npm run migration:run

# 6. Start the application
npm run start:dev

# 7. In a separate terminal, start the worker
npm run worker
```

### Verify Installation

```bash
# Check API health (Docker)
curl http://localhost:3000/api

# Check API health (Manual)
curl http://localhost:3000/health

# Test CLI (Manual)
npm run cli -- --help

# View logs (Docker)
docker-compose logs -f

# View logs (Manual)
tail -f logs/combined.log
```

## Deployment

### Development

Use Docker Compose for local development:

```bash
docker-compose up
```

See [docs/DOCKER.md](./docs/DOCKER.md) for detailed Docker documentation.

## Configuration

All configuration is managed through environment variables in the `.env` file.

### Example Environment Configuration

```bash
# ============================================
# Database Configuration
# ============================================
DATABASE_PATH=./data/coverage.db

# ============================================
# GitHub Configuration
# ============================================
# Personal Access Token (classic) or Fine-grained token
# Required scopes: repo (full), or Contents + Pull requests (fine-grained)
# See docs/GITHUB_SETUP.md for detailed setup instructions
GITHUB_TOKEN=ghp_YourPersonalAccessTokenHere

# Alternatively, use GitHub App authentication
# GITHUB_APP_ID=123456
# GITHUB_APP_PRIVATE_KEY_PATH=./github-app-key.pem
# GITHUB_INSTALLATION_ID=789012

# ============================================
# Coverage Configuration
# ============================================
# Minimum coverage percentage to consider a file acceptable
COVERAGE_THRESHOLD=80

# Coverage tool command (default uses nyc for TypeScript)
COVERAGE_COMMAND=npm run test:cov

# ============================================
# AI CLI Configuration
# ============================================
# Docker-based AI CLI (recommended for security)
AI_USE_DOCKER=true
AI_DOCKER_IMAGE=your-ai-image:latest
AI_CLI_CMD=docker run --rm -v {repo}:/workspace {image} generate --target {file} --out {out}

# Alternative: Local AI CLI (less secure)
# AI_USE_DOCKER=false
# AI_CLI_CMD=ai-test-generator --file {file} --output {out}

# API Key for AI service (if required)
AI_CLI_KEY=your-ai-api-key-here

# Docker isolation settings (when AI_USE_DOCKER=true)
DOCKER_MEMORY_LIMIT=1g
DOCKER_CPU_LIMIT=1.0
DOCKER_NETWORK_MODE=bridge
DOCKER_TIMEOUT=600

# ============================================
# Temporary Directory Configuration
# ============================================
# Base directory for ephemeral job workspaces
TEMP_BASE_DIR=./tmp/jobs

# Automatic cleanup after X hours
TEMP_CLEANUP_HOURS=24

# ============================================
# API Server Configuration
# ============================================
PORT=3000
NODE_ENV=development

# ============================================
# Logging Configuration
# ============================================
LOG_LEVEL=info
LOG_FILE_PATH=./logs
REDACT_SENSITIVE_LOGS=true

# ============================================
# Worker Configuration
# ============================================
WORKER_POLL_INTERVAL=5000
WORKER_MAX_RETRIES=3
WORKER_RETRY_DELAY=60000
```

### Configuration Options Reference

#### Essential Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_PATH` | SQLite database file location | `./data/coverage.db` | Yes |
| `GITHUB_TOKEN` | GitHub personal access token | - | Yes* |
| `COVERAGE_THRESHOLD` | Minimum coverage percentage | `80` | No |
| `AI_CLI_CMD` | AI test generation command | - | Yes |

*Either `GITHUB_TOKEN` or GitHub App credentials required

#### Docker Isolation (Recommended)

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_USE_DOCKER` | Enable Docker sandboxing | `true` |
| `AI_DOCKER_IMAGE` | Docker image for AI CLI | `node:18-alpine` |
| `DOCKER_MEMORY_LIMIT` | Container memory limit | `1g` |
| `DOCKER_CPU_LIMIT` | Container CPU limit | `1.0` |
| `DOCKER_NETWORK_MODE` | Network access mode | `bridge` |
| `DOCKER_TIMEOUT` | Execution timeout (seconds) | `600` |

Network modes:
- `none`: No network access (maximum security)
- `bridge`: Limited network access (recommended)
- `host`: Full network access (use with caution)

#### Temporary Directories

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMP_BASE_DIR` | Base directory for job workspaces | `./tmp/jobs` |
| `TEMP_CLEANUP_HOURS` | Auto-cleanup threshold (hours) | `24` |

### AI CLI Command Placeholders

The `AI_CLI_CMD` supports the following placeholders:

- `{repo}`: Path to cloned repository
- `{file}`: Target file for test generation
- `{out}`: Output directory for generated tests
- `{image}`: Docker image name (when using Docker)

**Example Docker Command:**
```bash
AI_CLI_CMD=docker run --rm -v {repo}:/workspace {image} generate --target {file} --out {out}
```

**Example Local Command:**
```bash
AI_CLI_CMD=ai-test-gen --input {file} --output {out} --coverage-threshold 80
```

### Security Best Practices

**GitHub Authentication:**
- ✅ Use fine-grained tokens with minimal required scopes
- ✅ Prefer GitHub Apps for organization-level deployments
- ✅ Rotate tokens regularly
- ✅ Never commit `.env` file to version control
- ⚠️ Tokens are automatically redacted from all logs

For detailed GitHub setup, see [docs/GITHUB_SETUP.md](./docs/GITHUB_SETUP.md)

**AI CLI Security:**
- ✅ Use Docker isolation (`AI_USE_DOCKER=true`)
- ✅ Set network mode to `none` for maximum security
- ✅ Configure resource limits to prevent DoS
- ✅ Store API keys in environment variables
- ✅ All sensitive data automatically redacted from logs

**Repository Isolation:**
- ✅ Each job runs in ephemeral temporary directory
- ✅ Automatic cleanup prevents data leakage
- ✅ No shared state between jobs
- ✅ Failed jobs cleaned up on retry or abandonment

## Usage

### Worker Process (Background Jobs)

The worker process polls for pending improvement jobs and executes them automatically:

```bash
# Start worker in development mode
npm run worker

# Build and run in production
npm run build
npm run worker:prod
```

For detailed worker documentation, see [WORKER.md](./WORKER.md).

### CLI

The CLI provides command-line interface for managing coverage and jobs:

```bash
# Scan repository coverage
npm run cli scan -- --repo owner/repo

# List low-coverage files
npm run cli list -- --repo owner/repo --threshold 80

# Create improvement job
npm run cli improve -- --repo owner/repo --file src/file.ts --user you@email.com

# Get job status
npm run cli job -- --id <job-id>

# List jobs
npm run cli jobs:list
```

For complete CLI documentation, see [CLI_API_USAGE.md](./CLI_API_USAGE.md).

### HTTP API

Start the API server to access REST endpoints:

```bash
# Start server in development mode
npm run start:dev

# Build and run in production
npm run build
npm run start:prod
```

#### Key Endpoints

- `POST /api/repos/:owner/:repo/scan` - Trigger coverage scan
- `GET /api/repos/:owner/:repo/coverage?threshold=80` - List coverage files
- `POST /api/repos/:owner/:repo/improve` - Create improvement job
- `GET /api/jobs/:id` - Get job details
- `GET /api/repos/:owner/:repo/jobs` - List repository jobs

For complete API documentation and examples, see [CLI_API_USAGE.md](./CLI_API_USAGE.md).

### Web Dashboard

A minimal web dashboard is available for browser-based monitoring:

1. Start the server: `npm run start:dev`
2. Open browser: `http://localhost:3000`

The dashboard provides:
- Repository scanning interface
- Low-coverage file visualization
- Job creation and monitoring
- Real-time progress tracking

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run start:dev

# Build for production
npm run build

# Run production build
npm run start:prod

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

## Testing

The project includes comprehensive test coverage:

### Unit Tests

Pure function tests for domain services located in `test/unit/`:
- `CoverageScannerService.spec.ts` - Coverage analysis logic
- `JobSerializer.spec.ts` - Job locking and serialization
- `TempDirectoryService.spec.ts` - Temporary directory management

Run unit tests:
```bash
npm run test:unit
```

### Integration Tests

Integration tests with SQLite test database located in `test/integration/`:
- Use-case tests with real database operations
- Mock GitHub and Git operations
- Test fixtures in `test/fixtures/repo/`

Run integration tests:
```bash
npm run test:integration
```

### End-to-End Tests

Manual E2E testing procedures documented in [E2E_TESTING.md](./E2E_TESTING.md):
- Complete workflow testing against real GitHub repositories
- Security verification (token redaction, Docker isolation)
- Performance and load testing scenarios
- Troubleshooting guides

### Test Fixtures

Sample test repository in `test/fixtures/repo/`:
- TypeScript source files with intentionally low coverage
- Incomplete test suite for testing improvement workflow
- Sample coverage reports in JSON format

## Logging

The system uses Winston for structured logging with automatic sensitive data redaction.

### Log Levels

Set via `LOG_LEVEL` environment variable:
- `error` - Errors only
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Detailed debugging information
- `verbose` - Very detailed logs

### Security Features

- **Automatic Redaction**: Tokens, passwords, and API keys are automatically redacted
- **Structured Logs**: JSON-formatted logs with context and metadata
- **File Logging**: Production logs written to `logs/` directory
- **Contextual Logging**: Each component uses tagged logger for traceability

### Configuration

```bash
# Set log level
LOG_LEVEL=debug

# Disable redaction (for local debugging only)
REDACT_SENSITIVE_LOGS=false
```

### Worker Traceability

Worker logs include:
- Job acquisition and release events
- Repository clone operations
- Coverage scan results
- AI test generation progress
- Git operations (commits, pushes)
- PR creation details
- Error traces with redacted sensitive data

Example log output:
```
2024-11-19 10:30:15 [INFO] [WorkerService] Checking for executable jobs
2024-11-19 10:30:15 [INFO] [WorkerService] Found 1 executable job(s)
2024-11-19 10:30:16 [INFO] [JobExecutor] Acquired job lock: job-123 for repo: owner/repo
2024-11-19 10:30:16 [INFO] [JobExecutor] Created temp directory: /tmp/jobs/job-1234567890-abcdef
2024-11-19 10:30:17 [INFO] [LocalGitAdapter] Cloning repository: https://[REDACTED]@github.com/owner/repo
2024-11-19 10:30:25 [INFO] [CoverageAdapter] Running coverage scan
2024-11-19 10:30:30 [INFO] [JobExecutor] Baseline coverage: 45%
2024-11-19 10:30:31 [INFO] [AiCliAdapter] Generating tests with AI CLI
2024-11-19 10:31:45 [INFO] [JobExecutor] New coverage: 82% (+37%)
2024-11-19 10:31:46 [INFO] [GithubAdapter] Creating PR: improve/src/utils.ts-1234567890
2024-11-19 10:31:47 [INFO] [JobExecutor] Job completed successfully: https://github.com/owner/repo/pull/123
```

## Database

Uses SQLite for simplicity and portability. Database schema includes:

- **repositories**: Repository information
- **coverage_reports**: Coverage scan results
- **coverage_files**: Individual file coverage data
- **jobs**: Improvement job queue and history

## Job Processing

The worker process (`npm run worker`) handles background job execution with comprehensive security:

- **5-second polling interval**: Checks for PENDING or RETRY jobs
- **Per-repository serialization**: One job at a time per repo (enforced via atomic DB locks)
- **Automatic retry**: Failed jobs retry up to 3 times with exponential backoff
- **Status tracking**: PENDING → RUNNING → SUCCEEDED/FAILED/RETRY
- **Ephemeral isolation**: Jobs run in temporary directories with automatic cleanup
- **Docker sandboxing**: AI CLI runs in isolated containers with resource limits
- **Secure authentication**: Uses x-access-token format, tokens never logged
- **GitHub integration**: Automatic PR creation with AI-generated tests

### Job Workflow

1. Create ephemeral temporary directory for job isolation
2. Clone repository using authenticated URL (credentials never logged)
3. Run baseline coverage scan
4. Generate tests using AI CLI in Docker container (sandboxed with resource limits)
5. Verify tests pass and coverage improves
6. Commit changes to new branch (`improve/{file}-{timestamp}`)
7. Push to GitHub using secure authentication
8. Create pull request with job details
9. Update job status and logs (all sensitive data redacted)
10. Cleanup ephemeral directory (automatic on success or failure)

### Security Features

- **Token Redaction**: All sensitive data automatically redacted from logs
- **Docker Isolation**: AI CLI runs in sandboxed containers by default
- **Resource Limits**: Memory and CPU constraints prevent resource exhaustion
- **Network Isolation**: Configurable network access (none, bridge, host)
- **Ephemeral Workspaces**: Temporary directories with automatic cleanup
- **Secure Git Operations**: Uses x-access-token format for GitHub authentication
- **No Token Logging**: Git URLs and tokens never appear in logs

For detailed documentation, see [WORKER.md](./WORKER.md).

## License

ISC
