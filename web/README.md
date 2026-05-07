# ScholarFlow Web UI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ScholarFlow Web UI is the Next.js interface for **ScholarFlow**, a multi-agent academic research assistant.

It helps users submit research questions, attach local academic materials, review generated research plans, observe tool calls in real time, and read structured Markdown research reports.

## Quick Start

### Prerequisites

- ScholarFlow backend service
- Node.js (v22.14.0+ recommended)
- pnpm (v10.6.2+) or npm

### Configuration

Create a `.env` file in the project root and configure the following environment variable:

- `NEXT_PUBLIC_API_URL`: The URL of the ScholarFlow API.

It's usually best to start with the example file and edit it with your own values:

```bash
cp .env.example .env
```

## How to Install

```bash
cd web
pnpm install
```

or, if you use npm:

```bash
cd web
npm install
```

## How to Run in Development Mode

Ensure the TypeScript API service is running before starting the web UI.

Start the web UI development server:

```bash
cd web
pnpm dev
```

By default, the web UI will be available at `http://localhost:3000`.

You can set the `NEXT_PUBLIC_API_URL` environment variable if you're using a different backend location.

```ini
# .env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Docker

You can also run this project with Docker.

First, make sure your `.env` file is ready.

Then build a Docker image:

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=YOUR_SCHOLARFLOW_API -t scholar-flow-web .
```

Start a container:

```bash
docker run -d -t -p 3000:3000 --env-file .env --name scholar-flow-web-app scholar-flow-web

# stop the server
docker stop scholar-flow-web-app
```

### Docker Compose

```bash
docker compose build
docker compose up
```

## License

This project is open source and available under the [MIT License](../LICENSE).

## Acknowledgments

ScholarFlow Web UI is built with these outstanding open-source projects:

- [Next.js](https://nextjs.org/) for the web framework
- [Shadcn](https://ui.shadcn.com/) for UI components
- [Zustand](https://zustand.docs.pmnd.rs/) for state management
- [Framer Motion](https://www.framer.com/motion/) for animations
- [React Markdown](https://www.npmjs.com/package/react-markdown) for Markdown rendering
- [SToneX](https://github.com/stonexer) for token-by-token visual effects
