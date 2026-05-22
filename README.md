# Frontend Repository

## Purpose

This repository contains the React frontend for the jewelry project.

## Local setup

1. Copy `.env.example` to `.env`
2. Install dependencies:

```bash
npm install
```

3. Start the local app:

```bash
npm start
```

The frontend runs at `http://localhost:3000`.

## Environment Variables

Local example:

```env
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_GOOGLE_CLIENT_ID=
```

For Azure production, start from `.env.azure.example` and point `REACT_APP_API_BASE_URL` to your deployed backend URL.

## Azure deployment

This repository is prepared for Azure Static Web Apps with GitHub Actions.

### Required GitHub secrets

- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `REACT_APP_API_BASE_URL`
- `REACT_APP_GOOGLE_CLIENT_ID`

### Workflow

The GitHub Actions workflow is stored in:

- `.github/workflows/deploy-azure-static-web-apps.yml`

It deploys the `main` branch to Azure Static Web Apps and handles preview environments for pull requests.

## Available Scripts

### `npm start`

Runs the app in development mode.

### `npm run build`

Builds the production bundle into `build/`.

### `npm test`

Runs the React test runner.

## Git notes

- Do not commit `.env`
- Only commit `.env.example` and `.env.azure.example`
- Do not commit `build/` or `node_modules/`
