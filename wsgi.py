from backend_app import app

application = app


if __name__ == "__main__":
    port = int(__import__("os").getenv("PORT", "5000"))
    application.run(host="0.0.0.0", port=port)
