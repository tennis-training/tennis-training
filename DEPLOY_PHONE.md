# Deploy For iPhone (Option 1: Hosted Web App)

This project is a static app (`index.html`), ready for Netlify or Vercel.

## 1) Push to GitHub

From this folder:

```bash
git init
git add .
git commit -m "Prepare phone web deploy"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

If this repo already exists, just commit and push your latest changes.

## 2) Deploy (choose one)

### Netlify
1. Go to https://app.netlify.com/
2. `Add new site` -> `Import an existing project`
3. Select your GitHub repo
4. Build settings:
   - Build command: *(leave empty)*
   - Publish directory: `.`
5. Deploy

### Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Framework preset: `Other`
4. Build and Output settings:
   - Build command: *(leave empty)*
   - Output directory: `.`
5. Deploy

## 3) Install on iPhone

1. Open the deployed URL in Safari on iPhone
2. Tap `Share`
3. Tap `Add to Home Screen`

Now you can launch it from your home screen like an app.
