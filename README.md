# Frontend Repository

React frontend for the jewelry project.

## Local Setup

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Start the app with `npm start`

The frontend runs at `http://localhost:3000`.

## Environment Variables

Local example:

```env
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_GOOGLE_CLIENT_ID=
```

Production builds can use `.env.production` or the matching variables configured in Vercel.

## Available Scripts

- `npm start`: run the app in development mode
- `npm run build`: build the production bundle into `build/`
- `npm test`: run the React test command when tests are added again

## Git Notes

- Do not commit `.env`
- Keep `build/` and `node_modules/` out of Git
