## Alwaysdata Deploy

Use these files for the Python app:

- app root: project folder containing `backend_app.py`
- WSGI entry file: `passenger_wsgi.py`
- Python app object: `application`

Required Python packages:

```txt
Flask
Flask-Cors
PyMySQL
requests
Werkzeug
```

Expected API checks after deploy:

```txt
https://calebtonny.alwaysdata.net/api/debug/version
https://calebtonny.alwaysdata.net/api/signin
```

Alwaysdata web configuration should point the site to this project directory, not just the `www` folder. The Flask app serves the built frontend from `www` and handles `/api/*` routes itself.

Recommended environment variables on alwaysdata:

```txt
FLASK_SECRET_KEY=change-this-to-a-real-secret
CLIENT_ORIGIN=https://calebtonny.alwaysdata.net,http://localhost:3000,http://127.0.0.1:3000
SESSION_COOKIE_SAMESITE=Lax
SESSION_COOKIE_SECURE=true
WEB_ROOT_DIR=/full/path/to/project/www
DB_HOST=mysql-calebtonny.alwaysdata.net
DB_PORT=3306
DB_USER=calebtonny
DB_PASSWORD=your-real-db-password
DB_NAME=calebtonny_sokogarden
```

Frontend deploy note:

- upload the built React files from `www`
- keep `.env.local` for local development only
- for production, the deployed frontend should be served by the same Flask app, so `/api/*` and the frontend share one host

## Local Development

Local React should use the local Flask API:

```txt
REACT_APP_API_BASE_URL=http://127.0.0.1:5000/api
```

The local Flask API still connects to the alwaysdata MySQL database through the database settings in `backend_app.py` or the matching environment variables.

Run these in separate terminals:

```txt
npm run start:api
npm start
```

Local API check:

```txt
http://127.0.0.1:5000/api/debug/version
```
