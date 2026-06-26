# BoA private institute Banking Portal

This is an independent banking-style web app built for a private/demo portal experience. It is not affiliated with, endorsed by, or connected to Bank of America or any other financial institution.

## Project info

**URL**: https://lovable.dev/projects/113eecff-8aa6-4803-a188-98efbd4b59bd

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/113eecff-8aa6-4803-a188-98efbd4b59bd) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Required environment variables

Do not commit a real `.env` file to GitHub, GitLab, Netlify, or any public repository. Copy `.env.example` locally, then set the same variables in your hosting provider's environment-variable settings:

```sh
VITE_SUPABASE_URL=your_backend_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

For Netlify, add these under Site configuration → Environment variables, then trigger a fresh deploy.

For GitHub Pages, add them as repository secrets named `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` before running the workflow.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/113eecff-8aa6-4803-a188-98efbd4b59bd) and click on Share -> Publish.

For Netlify, the included `netlify.toml` and `public/_redirects` support React Router refreshes. If Netlify pauses or suspends the site, review their phishing/impersonation notice: banking clones and brand lookalikes can be flagged unless the app is clearly your own brand and includes an unaffiliated notice.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
