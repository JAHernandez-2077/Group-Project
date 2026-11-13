# Group-Project

## Task storage

Tasks are loaded and changed through the Netlify Function at `/.netlify/functions/tasks`. The function stores the task list as JSON in the site-wide Netlify Blobs store (`daybook-tasks`, key `tasks.json`), so the data persists across deploys. Netlify Blobs is persistent storage, not a writable file on the function's temporary filesystem.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Netlify CLI, usually `http://localhost:8888`. The CLI provides a local Blobs sandbox; its data is separate from the deployed site's data.

## Deploy

Connect this repository to Netlify and deploy it with the included `netlify.toml`. Netlify provisions access to the Blobs store for the function automatically; no database URL or token is needed.

This is a shared task list. Anyone who can access the deployed site can read and change its tasks. Add authentication before using it for private or personal task data.

