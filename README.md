# TanStack Start Template

A starting point for a new web app, with shared UI, a production build, and checks ready to run.

![TanStack Start](https://img.shields.io/badge/TanStack_Start-F97316?style=flat) ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) ![Nitro](https://img.shields.io/badge/Nitro-18181B?style=flat&logo=nitro&logoColor=F87171) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-0F172A?style=flat&logo=tailwindcss&logoColor=38BDF8) ![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-18181B?style=flat&logo=shadcnui&logoColor=white)

Your project chooses its own authentication, database, and product features.

## Get started

Use Node.js 24.15 or newer in the 24.x line and pnpm 12.15.0. If needed, install pnpm with `npx get-pnpm 12.15.0`.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`, then follow [the setup guide](docs/template-setup.md) to give the app its own name, content, and branding.

If you are working with a coding agent, give it this prompt:

```text
Set up this repository as my new project by following docs/template-setup.md. Start with the questions in step 1.
```

## Working on the app

Run `pnpm validate` before sharing changes. For page or server changes, also follow the [browser-check instructions](docs/development.md#check-your-changes).

| What you need | Where to go |
| --- | --- |
| Make this template your project | [Setup guide](docs/template-setup.md) |
| Run checks, change routes, use separate checkouts, or debug a failure | [Development guide](docs/development.md) |
| Find the code and understand what runs on the server or in the browser | [How the app fits together](docs/architecture.md) |
| Deploy to Vercel, Cloudflare, or another host | [Deployment guide](docs/deployment.md) |
| Understand product and design choices | [Product](PRODUCT.md) and [design](DESIGN.md) |
| Give a coding agent the project rules | [Agent notes](AGENTS.md) |

If you maintain the template itself, use the [publishing checklist](docs/template-publishing.md) before a release.

## License

Original code is available under the [MIT License](LICENSE). Vendored source keeps the licenses listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
