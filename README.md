# Enterprise RPA Agent

**Production-Grade Browser Automation Platform for Enterprise Deployment**

A standalone Windows desktop application for browser automation and mass task execution at scale, built to Fortune 500 deployment standards.

## Features

### Core Capabilities
- **Multi-Browser Automation**: Launch and control hundreds of browser instances simultaneously
- **Natural Language Commands**: Execute tasks using intuitive command syntax
- **Workflow Engine**: Create, save, and execute complex automation workflows
- **Workspace Management**: Isolated browser profiles with persistent fingerprints
- **Proxy Support**: HTTP/HTTPS/SOCKS5 with rotation and health monitoring

### Anti-Detection System (Research-Grade)
- **Fingerprint Management**: Unique, realistic browser fingerprints per workspace
- **Behavioral AI**: Human-like mouse movements, typing patterns, and scrolling
- **Network Stealth**: WebRTC leak prevention, header normalization, tracking blocker
- **Meta-Detection**: Automatic detection of bot detection and adaptive responses
- **CAPTCHA Integration**: Support for 2Captcha, Anti-Captcha, and CapSolver

### Enterprise Features
- **SQLite Database**: Local data persistence with migrations
- **Winston Logging**: Enterprise-grade logging with rotation
- **Type Safety**: 100% TypeScript with strict mode
- **Clean Architecture**: SOLID principles, repository pattern

## Installation

### Requirements
- Windows 10/11 (64-bit)
- 8GB RAM minimum (16GB recommended)
- 10GB disk space

### Quick Start
1. Download the latest release from [Releases](./releases)
2. Run the installer (`Enterprise-RPA-Agent-Setup.exe`)
3. Launch the application from Start Menu or Desktop

## Usage

### Command Center
The Command Center accepts natural language commands:

```
Launch 10 browsers and navigate to google.com
Login to twitter.com using accounts from data.csv
Fill form on example.com with random data
Extract product data from amazon.com and save to results.xlsx
```

### Creating Workspaces
1. Navigate to **Workspaces** page
2. Click **Create Workspace**
3. Enter name and count (bulk creation supported)
4. Each workspace gets a unique fingerprint

### Proxy Configuration
1. Navigate to **Proxies** page
2. Click **Add Proxy** or **Bulk Import**
3. Format: `host:port:username:password` (one per line)
4. Test connectivity with **Test All**

### Workflow Management
1. Navigate to **Workflows** page
2. Click **Create Workflow**
3. Define steps using command syntax
4. Save and execute on demand

## Development

### Prerequisites
- Node.js 18+
- npm 9+
- Git

### Setup
```bash
# Clone repository
git clone https://github.com/your-org/rpa-agent.git
cd rpa-agent

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Start development
npm run dev
```

### Build
```bash
# Build for production
npm run build

# Package for distribution
npm run dist
```

### Project Structure
```
├── automation/           # Browser automation engine
│   ├── browser-manager/  # Browser pool and instance management
│   ├── stealth/          # Anti-detection modules
│   ├── workflow-engine/  # Workflow execution
│   └── workflow-parser/  # Command parsing
├── electron/             # Electron main process
│   ├── database/         # SQLite database layer
│   ├── handlers/         # IPC handlers
│   ├── services/         # Business logic
│   └── utils/            # Utilities (logger, config)
├── shared/               # Shared types and constants
│   ├── constants/        # IPC channels, app config
│   └── types/            # TypeScript interfaces
└── src/                  # Next.js frontend
    ├── app/              # App router pages
    ├── components/       # React components
    ├── hooks/            # Custom hooks
    └── lib/              # Utilities and stores
```

## Configuration

### Environment Variables
Create `.env` file from `.env.example`:

```env
# Application
NODE_ENV=production
LOG_LEVEL=info

# Automation
MAX_CONCURRENT_BROWSERS=10
DEFAULT_TIMEOUT=30000
HEADLESS_MODE=true

# CAPTCHA (Optional)
CAPTCHA_SERVICE=2captcha
CAPTCHA_API_KEY=your-api-key
```

## Architecture

### Technology Stack
- **Desktop**: Electron 28
- **Frontend**: Next.js 15, React 19, Tailwind CSS v4
- **State**: Zustand
- **Database**: better-sqlite3
- **Automation**: Playwright
- **Logging**: Winston
- **Validation**: Zod

### Design Principles
- **Clean Architecture**: Separation of concerns with clear boundaries
- **Repository Pattern**: Data access abstraction
- **Type Safety**: Strict TypeScript throughout
- **Error Handling**: Comprehensive try-catch with proper logging
- **Security First**: Input validation, encrypted credentials

## License

Proprietary - All rights reserved.

## Support

For enterprise support, contact: support@your-domain.com
