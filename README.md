# Safety360 Frontend

React/Vite frontend for the Safety360 integrated management system.

## Included in this foundation

- registration and login against the Safety360 FastAPI backend
- JWT bearer token handling
- authenticated `/auth/me` flow
- protected dashboard route
- tenant onboarding
- tenant-aware ticket creation and listing
- initial IMS module overview for risk assessments, operating instructions, training, audits and management review
- responsive desktop/mobile layout
- environment-based API configuration
- GitHub Actions build and dependency audit
- Dependabot dependency updates

## Local development

1. Copy `.env.example` to `.env` if a custom API URL is needed.
2. Install dependencies with `npm install`.
3. Start with `npm run dev`.
4. The default backend URL is `http://127.0.0.1:8000`.

## Production configuration

Set `VITE_API_BASE_URL` to the public Safety360 API or proxy URL before building the frontend.

Do not commit production credentials, tokens or `.env` files.

## Architecture direction

Safety360 is being developed as a multi-tenant IMS platform covering occupational health and safety, environment, energy and quality. The frontend will progressively link the workflow chain:

`Gefährdungsbeurteilung → Betriebsanweisung → Unterweisung → Audit → Management Review`

Future increments will add granular RBAC, document control, multilingual UI, AI-assisted ingestion/workflows, legal/compliance intelligence, offline/mobile capabilities and analytics.
