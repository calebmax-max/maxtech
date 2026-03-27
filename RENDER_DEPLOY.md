## Render Deploy Setup

This project should be deployed on Render as two services:

1. Static Site for the React frontend
2. Web Service for the Flask backend

You can also use the repo's [render.yaml](c:/Users/USER/Desktop/modcomclass2026/elitehotel/render.yaml) blueprint so Render creates both services with the correct runtime and commands.

### Frontend Static Site

- Build command: `npm install && npm run build`
- Publish directory: `www`

Set this environment variable on the frontend service:

```txt
REACT_APP_API_BASE_URL=https://YOUR-BACKEND-SERVICE.onrender.com/api
```

Do not use:

```txt
http://127.0.0.1:5000/api
http://localhost:5000/api
```

### Backend Web Service

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --bind 0.0.0.0:$PORT wsgi:application`

Recommended environment variables:

```txt
CLIENT_ORIGIN=https://YOUR-FRONTEND-SITE.onrender.com
FLASK_SECRET_KEY=replace-with-a-real-secret
SESSION_COOKIE_SAMESITE=None
SESSION_COOKIE_SECURE=true
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
```

### Why this matters

If the frontend uses `127.0.0.1:5000` in production, the browser tries to call the visitor's own computer instead of the live backend, causing `ERR_CONNECTION_REFUSED`.

If Render says `No open HTTP ports detected on 0.0.0.0`, make sure the backend service start command is exactly:

```txt
gunicorn --bind 0.0.0.0:$PORT wsgi:application
```
