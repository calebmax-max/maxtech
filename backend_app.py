import base64
import json
import os
from datetime import date, datetime, timedelta
from functools import wraps

import pymysql
import requests
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

# ---------------- APP SETUP ----------------
app = Flask(__name__)

app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "super-secret-key")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
app.config["SESSION_COOKIE_SAMESITE"] = os.getenv("SESSION_COOKIE_SAMESITE", "None")
app.config["SESSION_COOKIE_SECURE"] = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"
app.config["SESSION_COOKIE_HTTPONLY"] = True

client_origins = [
    origin.strip()
    for origin in os.getenv(
        "CLIENT_ORIGIN",
        "http://localhost:3000,http://127.0.0.1:3000,https://calebtonny.alwaysdata.net",
    ).split(",")
    if origin.strip()
]

CORS(app, supports_credentials=True, origins=client_origins)


@app.after_request
def handle_options(response):
    origin = request.headers.get("Origin", "")
    if origin in client_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
    elif client_origins:
        response.headers["Access-Control-Allow-Origin"] = client_origins[0]
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response


# ---------------- DATABASE ----------------
DB_HOST = os.getenv("DB_HOST", "mysql-calebtonny.alwaysdata.net")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "calebtonny")
DB_PASSWORD = os.getenv("DB_PASSWORD", "modcom1234")
DB_NAME = os.getenv("DB_NAME", "calebtonny_sokogarden")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "caleb@gmail.com").strip().lower()


def get_connection():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
    )


def is_password_hash(value):
    if not value:
        return False

    return value.startswith("scrypt:") or value.startswith("pbkdf2:") or value.startswith("argon2:")


def is_admin_email(email):
    return email.strip().lower() == ADMIN_EMAIL


def verify_password(stored_password, submitted_password):
    if not stored_password:
        return False, False

    if is_password_hash(stored_password):
        return check_password_hash(stored_password, submitted_password), False

    if stored_password == submitted_password:
        return True, True

    return False, False


def require_admin(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = session.get("user")
        if not user or not user.get("is_admin"):
            return jsonify({"message": "Unauthorized"}), 403
        return view(*args, **kwargs)

    return wrapped


def ensure_column(cursor, table_name, column_name, column_definition):
    cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE %s", (column_name,))
    if not cursor.fetchone():
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")


def ensure_default_organization(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS organizations (
            org_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            slug VARCHAR(160) UNIQUE,
            contact_email VARCHAR(160),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute("SELECT org_id FROM organizations WHERE slug=%s", ("default-workspace",))
    organization = cursor.fetchone()
    if organization:
        return organization["org_id"]

    cursor.execute(
        """
        INSERT INTO organizations(name, slug, contact_email)
        VALUES(%s, %s, %s)
        """,
        ("EliteHotels Workspace", "default-workspace", ADMIN_EMAIL),
    )
    return cursor.lastrowid


def slugify(value):
    normalized = "".join(character.lower() if character.isalnum() else "-" for character in value.strip())
    while "--" in normalized:
        normalized = normalized.replace("--", "-")
    return normalized.strip("-") or "workspace"


DEFAULT_ROOMS = [
    {
        "name": "Deluxe King Room",
        "price": "KSh 12,500",
        "image": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        "description": "A calm, modern room with warm lighting, a king bed, and plenty of space for a relaxing stay.",
        "overview": "This room is ideal for couples and solo travelers who want a comfortable premium stay with a calm interior and practical in-room amenities.",
        "guests": "2 Guests",
        "size": "38 m2",
        "bed": "1 King Bed",
        "idealFor": "Couples and short luxury stays",
        "features": ["Smart TV", "Free Wi-Fi", "Air Conditioning", "Mini Fridge"],
    },
    {
        "name": "Executive Suite",
        "price": "KSh 19,800",
        "image": "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80",
        "description": "Designed for business and comfort, this suite includes a lounge area and a premium work setup.",
        "overview": "The executive suite balances work and rest with a separate sitting space, reliable connectivity, and thoughtful service for professionals.",
        "guests": "2 Adults",
        "size": "52 m2",
        "bed": "1 King Bed",
        "idealFor": "Business trips and executive stays",
        "features": ["Smart TV", "Work Desk", "Coffee Station", "Room Service"],
    },
    {
        "name": "Family Comfort Room",
        "price": "KSh 16,200",
        "image": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        "description": "Perfect for families, with extra sleeping space, cozy seating, and an easy layout for shared stays.",
        "overview": "This room gives families a practical and welcoming setup, with enough space for children, luggage, and quiet evening rest.",
        "guests": "4 Guests",
        "size": "48 m2",
        "bed": "2 Queen Beds",
        "idealFor": "Family holidays and group stays",
        "features": ["TV", "Free Wi-Fi", "Breakfast", "Extra Bedding"],
    },
]


DEFAULT_DINING = {
    "categories": [
        {
            "title": "Breakfast Favorites",
            "description": "Fresh morning plates prepared for light starts and hearty hotel breakfasts.",
            "items": [
                {
                    "name": "Classic English Breakfast",
                    "price": "KSh 1,250",
                    "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Pancake Stack With Syrup",
                    "price": "KSh 950",
                    "image": "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=900&q=80",
                },
            ],
        },
        {
            "title": "Main Courses",
            "description": "Chef-crafted dishes with rich flavors for lunch and dinner service.",
            "items": [
                {
                    "name": "Grilled Beef Steak",
                    "price": "KSh 2,450",
                    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Creamy Seafood Pasta",
                    "price": "KSh 2,200",
                    "image": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80",
                },
            ],
        },
    ],
    "featuredPlates": [
        {
            "title": "Chef Signature Seafood Platter",
            "price": "KSh 3,450",
            "image": "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1200&q=80",
            "tag": "Chef Special",
            "description": "A premium selection of grilled fish, prawns, and seasonal sides prepared for guests who want a rich seafood experience.",
        },
        {
            "title": "Garden Brunch Board",
            "price": "KSh 2,100",
            "image": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
            "tag": "Weekend Favorite",
            "description": "A colorful brunch spread with eggs, fruit, pastries, and fresh juice, ideal for slow mornings and shared dining.",
        },
    ],
}


# ---------------- TABLES ----------------
def create_tables():
    conn = get_connection()
    cur = conn.cursor()

    default_org_id = ensure_default_organization(cur)

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            org_id INT NULL,
            is_admin TINYINT(1) DEFAULT 0,
            username VARCHAR(120),
            email VARCHAR(160) UNIQUE,
            phone VARCHAR(30),
            password VARCHAR(255)
        )
        """
    )
    ensure_column(cur, "users", "org_id", "INT NULL")
    ensure_column(cur, "users", "is_admin", "TINYINT(1) DEFAULT 0")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS room_bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            org_id INT NULL,
            user_id INT NULL,
            room_name VARCHAR(255),
            check_in DATE,
            check_out DATE,
            amount INT,
            payment_phone VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    ensure_column(cur, "room_bookings", "org_id", "INT NULL")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS food_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            org_id INT NULL,
            order_title VARCHAR(255),
            preferred_date DATE,
            preferred_time VARCHAR(20),
            total_amount INT,
            phone VARCHAR(20),
            items JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    ensure_column(cur, "food_orders", "org_id", "INT NULL")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS event_bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            org_id INT NULL,
            name VARCHAR(160),
            email VARCHAR(160),
            phone VARCHAR(30),
            event_type VARCHAR(120),
            event_date DATE,
            guests INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    ensure_column(cur, "event_bookings", "org_id", "INT NULL")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS workspace_catalogs (
            org_id INT PRIMARY KEY,
            rooms_json LONGTEXT,
            dining_json LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        """
    )

    ensure_column(cur, "organizations", "logo_url", "VARCHAR(255) NULL")
    ensure_column(cur, "organizations", "primary_color", "VARCHAR(20) NULL")
    ensure_column(cur, "organizations", "accent_color", "VARCHAR(20) NULL")
    ensure_column(cur, "organizations", "hero_title", "VARCHAR(255) NULL")
    ensure_column(cur, "organizations", "contact_phone", "VARCHAR(40) NULL")
    ensure_column(cur, "organizations", "location", "VARCHAR(160) NULL")

    cur.execute("UPDATE users SET org_id=%s WHERE org_id IS NULL", (default_org_id,))
    cur.execute("UPDATE users SET is_admin=1 WHERE LOWER(email)=%s", (ADMIN_EMAIL,))
    cur.execute("UPDATE room_bookings SET org_id=%s WHERE org_id IS NULL", (default_org_id,))
    cur.execute("UPDATE food_orders SET org_id=%s WHERE org_id IS NULL", (default_org_id,))
    cur.execute("UPDATE event_bookings SET org_id=%s WHERE org_id IS NULL", (default_org_id,))
    cur.execute(
        """
        INSERT INTO workspace_catalogs(org_id, rooms_json, dining_json)
        VALUES(%s, %s, %s)
        ON DUPLICATE KEY UPDATE
        rooms_json = COALESCE(workspace_catalogs.rooms_json, VALUES(rooms_json)),
        dining_json = COALESCE(workspace_catalogs.dining_json, VALUES(dining_json))
        """,
        (default_org_id, json.dumps(DEFAULT_ROOMS), json.dumps(DEFAULT_DINING)),
    )

    conn.commit()
    cur.close()
    conn.close()


create_tables()


def get_food_items_column():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SHOW COLUMNS FROM food_orders LIKE 'items'")
        if cur.fetchone():
            return "items"

        cur.execute("SHOW COLUMNS FROM food_orders LIKE 'items_json'")
        if cur.fetchone():
            return "items_json"

        return "items"
    finally:
        cur.close()
        conn.close()


def get_organization_by_id(org_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "SELECT org_id, name, slug, contact_email, created_at FROM organizations WHERE org_id=%s",
            (org_id,),
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def resolve_user_org_id(user):
    return user.get("org_id") or get_default_org_id()


def get_default_org_id():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT org_id FROM organizations WHERE slug=%s", ("default-workspace",))
        organization = cur.fetchone()
        return organization["org_id"] if organization else None
    finally:
        cur.close()
        conn.close()


def get_organization_by_slug(slug):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT org_id, name, slug, contact_email, logo_url, primary_color, accent_color, hero_title, contact_phone, location, created_at
            FROM organizations
            WHERE slug=%s
            """,
            (slug,),
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def resolve_request_organization():
    workspace_slug = request.args.get("workspace", "").strip().lower()
    if not workspace_slug:
        workspace_slug = request.headers.get("X-Workspace-Slug", "").strip().lower()

    if workspace_slug:
        organization = get_organization_by_slug(workspace_slug)
        if organization:
            return organization

    user = session.get("user")
    if user and user.get("org_id"):
        organization = get_organization_by_id(user["org_id"])
        if organization:
            return organization

    default_org_id = get_default_org_id()
    return get_organization_by_id(default_org_id) if default_org_id else None


def get_workspace_catalog(org_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "SELECT rooms_json, dining_json FROM workspace_catalogs WHERE org_id=%s",
            (org_id,),
        )
        catalog = cur.fetchone()
        if not catalog:
            return {"rooms": DEFAULT_ROOMS, "dining": DEFAULT_DINING}

        rooms = json.loads(catalog["rooms_json"]) if catalog.get("rooms_json") else DEFAULT_ROOMS
        dining = json.loads(catalog["dining_json"]) if catalog.get("dining_json") else DEFAULT_DINING
        return {"rooms": rooms, "dining": dining}
    finally:
        cur.close()
        conn.close()


def save_workspace_catalog(org_id, rooms=None, dining=None):
    existing = get_workspace_catalog(org_id)
    next_rooms = rooms if rooms is not None else existing["rooms"]
    next_dining = dining if dining is not None else existing["dining"]

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            INSERT INTO workspace_catalogs(org_id, rooms_json, dining_json)
            VALUES(%s, %s, %s)
            ON DUPLICATE KEY UPDATE rooms_json=VALUES(rooms_json), dining_json=VALUES(dining_json)
            """,
            (org_id, json.dumps(next_rooms), json.dumps(next_dining)),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()

    return {"rooms": next_rooms, "dining": next_dining}


def serialize_value(value):
    if isinstance(value, timedelta):
        total_seconds = int(value.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")

    return value


def serialize_rows(rows):
    return [{key: serialize_value(value) for key, value in row.items()} for row in rows]


def build_safe_user(user):
    organization = get_organization_by_id(user.get("org_id")) if user.get("org_id") else None
    return {
        "user_id": user["user_id"],
        "org_id": user.get("org_id"),
        "username": user.get("username"),
        "email": user["email"],
        "phone": user.get("phone"),
        "is_admin": bool(user.get("is_admin")) or is_admin_email(user["email"]),
        "organization": {key: serialize_value(value) for key, value in organization.items()} if organization else None,
    }


@app.route("/api/debug/version", methods=["GET"])
def debug_version():
    return jsonify(
        {
            "app": "elitehotel-backend",
            "version": "2026-03-27-saas-foundation-v1",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    )


@app.route("/api/debug/check-password", methods=["POST"])
def debug_check_password():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT user_id, email, password FROM users WHERE email=%s", (email,))
        user = cur.fetchone()

        if not user:
            return jsonify({"exists": False, "matches": False, "needs_upgrade": False})

        matches, needs_upgrade = verify_password(user["password"], password)

        return jsonify(
            {
                "exists": True,
                "matches": matches,
                "needs_upgrade": needs_upgrade,
                "is_hash": is_password_hash(user["password"]),
                "hash_prefix": user["password"].split("$", 1)[0] if user["password"] else None,
            }
        )
    finally:
        cur.close()
        conn.close()


# ---------------- AUTH ----------------
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}

    email = data.get("email", "").lower().strip()
    password = data.get("password", "").strip()
    username = data.get("username", "").strip()
    phone = data.get("phone", "").strip()
    workspace_name = data.get("workspace_name", "").strip()
    workspace_slug_input = data.get("workspace_slug", "").strip()
    create_workspace = bool(data.get("create_workspace"))

    if not email or not password or not username or not phone:
        return jsonify({"message": "All fields are required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT user_id FROM users WHERE email=%s", (email,))
        if cur.fetchone():
            return jsonify({"message": "Email exists"}), 409

        org_id = get_default_org_id()
        is_admin = 0

        if create_workspace:
            if not workspace_name:
                return jsonify({"message": "Workspace name is required to create a tenant workspace"}), 400

            workspace_slug = slugify(workspace_slug_input or workspace_name)
            cur.execute("SELECT org_id FROM organizations WHERE slug=%s", (workspace_slug,))
            if cur.fetchone():
                return jsonify({"message": "Workspace slug already exists"}), 409

            cur.execute(
                """
                INSERT INTO organizations(name, slug, contact_email)
                VALUES(%s, %s, %s)
                """,
                (workspace_name, workspace_slug, email),
            )
            org_id = cur.lastrowid
            is_admin = 1
            cur.execute(
                """
                INSERT INTO workspace_catalogs(org_id, rooms_json, dining_json)
                VALUES(%s, %s, %s)
                """,
                (org_id, json.dumps(DEFAULT_ROOMS), json.dumps(DEFAULT_DINING)),
            )

        cur.execute(
            """
            INSERT INTO users(org_id,is_admin,username,email,phone,password)
            VALUES(%s,%s,%s,%s,%s,%s)
            """,
            (org_id, is_admin, username, email, phone, generate_password_hash(password)),
        )

        conn.commit()
        return jsonify({"message": "Signup successful"})
    finally:
        cur.close()
        conn.close()


@app.route("/api/signin", methods=["POST"])
def signin():
    data = request.get_json() or {}

    email = data.get("email", "").lower().strip()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT * FROM users WHERE email=%s", (email,))
        user = cur.fetchone()

        password_ok, needs_upgrade = verify_password(user["password"], password) if user else (False, False)
        if not user or not password_ok:
            session.pop("user", None)
            return jsonify({"message": "Invalid credentials"}), 401

        if not user.get("org_id"):
            default_org_id = get_default_org_id()
            cur.execute("UPDATE users SET org_id=%s WHERE user_id=%s", (default_org_id, user["user_id"]))
            conn.commit()
            user["org_id"] = default_org_id

        if is_admin_email(user["email"]) and not user.get("is_admin"):
            cur.execute("UPDATE users SET is_admin=1 WHERE user_id=%s", (user["user_id"],))
            conn.commit()
            user["is_admin"] = 1

        if needs_upgrade:
            upgraded_password_hash = generate_password_hash(password)
            cur.execute(
                "UPDATE users SET password=%s WHERE user_id=%s",
                (upgraded_password_hash, user["user_id"]),
            )
            conn.commit()
            user["password"] = upgraded_password_hash

        safe_user = build_safe_user(user)
        session["user"] = safe_user
        session.permanent = True

        return jsonify({"message": "Login successful", "user": safe_user})
    finally:
        cur.close()
        conn.close()


@app.route("/api/signout", methods=["POST"])
def signout():
    session.clear()
    return jsonify({"message": "Signed out"})


@app.route("/api/admin/check", methods=["GET"])
@require_admin
def admin_check():
    return jsonify({"message": "Welcome admin", "user": session.get("user")})


# ---------------- PUBLIC SaaS CATALOG ----------------
@app.route("/api/catalog/workspace", methods=["GET"])
def catalog_workspace():
    organization = resolve_request_organization()
    if not organization:
        return jsonify({"message": "Workspace not found"}), 404

    return jsonify({key: serialize_value(value) for key, value in organization.items()})


@app.route("/api/catalog/rooms", methods=["GET"])
def catalog_rooms():
    organization = resolve_request_organization()
    if not organization:
        return jsonify({"message": "Workspace not found"}), 404

    catalog = get_workspace_catalog(organization["org_id"])
    return jsonify(
        {
            "organization": {key: serialize_value(value) for key, value in organization.items()},
            "rooms": catalog["rooms"],
        }
    )


@app.route("/api/catalog/dining", methods=["GET"])
def catalog_dining():
    organization = resolve_request_organization()
    if not organization:
        return jsonify({"message": "Workspace not found"}), 404

    catalog = get_workspace_catalog(organization["org_id"])
    return jsonify(
        {
            "organization": {key: serialize_value(value) for key, value in organization.items()},
            "catalog": catalog["dining"],
        }
    )


# ---------------- ADMIN ----------------
@app.route("/api/admin/workspace", methods=["GET", "PUT"])
@require_admin
def admin_workspace():
    current_org_id = resolve_user_org_id(session.get("user", {}))
    conn = get_connection()
    cur = conn.cursor()

    try:
        if request.method == "GET":
            organization = get_organization_by_id(current_org_id)
            return jsonify({key: serialize_value(value) for key, value in organization.items()} if organization else {})

        data = request.get_json() or {}
        name = data.get("name", "").strip()
        slug = slugify(data.get("slug", "").strip()) if data.get("slug") else None

        if slug:
            cur.execute("SELECT org_id FROM organizations WHERE slug=%s AND org_id<>%s", (slug, current_org_id))
            if cur.fetchone():
                return jsonify({"message": "Workspace slug already exists"}), 409

        cur.execute(
            """
            UPDATE organizations
            SET name=%s,
                slug=COALESCE(%s, slug),
                contact_email=%s,
                logo_url=%s,
                primary_color=%s,
                accent_color=%s,
                hero_title=%s,
                contact_phone=%s,
                location=%s
            WHERE org_id=%s
            """,
            (
                name or "Workspace",
                slug,
                data.get("contact_email"),
                data.get("logo_url"),
                data.get("primary_color"),
                data.get("accent_color"),
                data.get("hero_title"),
                data.get("contact_phone"),
                data.get("location"),
                current_org_id,
            ),
        )
        conn.commit()
        organization = get_organization_by_id(current_org_id)
        if session.get("user"):
            session["user"]["organization"] = {
                key: serialize_value(value) for key, value in organization.items()
            }
        return jsonify({key: serialize_value(value) for key, value in organization.items()} if organization else {})
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/catalog/rooms", methods=["GET", "PUT"])
@require_admin
def admin_catalog_rooms():
    current_org_id = resolve_user_org_id(session.get("user", {}))

    if request.method == "GET":
        return jsonify({"rooms": get_workspace_catalog(current_org_id)["rooms"]})

    data = request.get_json() or {}
    rooms = data.get("rooms")
    if not isinstance(rooms, list):
        return jsonify({"message": "Rooms payload must be a list"}), 400

    catalog = save_workspace_catalog(current_org_id, rooms=rooms)
    return jsonify({"rooms": catalog["rooms"]})


@app.route("/api/admin/catalog/dining", methods=["GET", "PUT"])
@require_admin
def admin_catalog_dining():
    current_org_id = resolve_user_org_id(session.get("user", {}))

    if request.method == "GET":
        return jsonify({"catalog": get_workspace_catalog(current_org_id)["dining"]})

    data = request.get_json() or {}
    catalog_payload = data.get("catalog")
    if not isinstance(catalog_payload, dict):
        return jsonify({"message": "Catalog payload must be an object"}), 400

    catalog = save_workspace_catalog(current_org_id, dining=catalog_payload)
    return jsonify({"catalog": catalog["dining"]})


@app.route("/api/admin/foods", methods=["GET"])
@require_admin
def get_foods():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT * FROM foods")
        data = cur.fetchall()
        return jsonify(serialize_rows(data))
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/foods", methods=["POST"])
@require_admin
def add_food():
    data = request.get_json() or {}
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            INSERT INTO foods(name, price, image)
            VALUES (%s,%s,%s)
            """,
            (data["name"], data["price"], data["image"]),
        )
        conn.commit()
        return jsonify({"message": "Food added"})
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/rooms", methods=["GET"])
@require_admin
def get_rooms():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT * FROM rooms")
        data = cur.fetchall()
        return jsonify(serialize_rows(data))
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/rooms", methods=["POST"])
@require_admin
def add_room():
    data = request.get_json() or {}
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            INSERT INTO rooms(name, price)
            VALUES (%s,%s)
            """,
            (data["name"], data["price"]),
        )
        conn.commit()
        return jsonify({"message": "Room added"})
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/bookings", methods=["GET"])
@require_admin
def get_bookings():
    conn = get_connection()
    cur = conn.cursor()
    current_org_id = resolve_user_org_id(session.get("user", {}))

    try:
        cur.execute("SELECT * FROM room_bookings WHERE org_id=%s", (current_org_id,))
        rooms = cur.fetchall()

        cur.execute("SELECT * FROM food_orders WHERE org_id=%s", (current_org_id,))
        foods = cur.fetchall()

        return jsonify(
            {
                "room_bookings": serialize_rows(rooms),
                "food_orders": serialize_rows(foods),
            }
        )
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/users", methods=["GET"])
@require_admin
def get_users():
    conn = get_connection()
    cur = conn.cursor()
    current_org_id = resolve_user_org_id(session.get("user", {}))

    try:
        cur.execute(
            "SELECT user_id, org_id, username, email, phone FROM users WHERE org_id=%s ORDER BY user_id DESC",
            (current_org_id,),
        )
        users = cur.fetchall()
        return jsonify(serialize_rows(users))
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/overview", methods=["GET"])
@require_admin
def admin_overview():
    conn = get_connection()
    cur = conn.cursor()
    food_items_column = get_food_items_column()
    current_org_id = resolve_user_org_id(session.get("user", {}))

    try:
        cur.execute(
            """
            SELECT user_id, org_id, username, email, phone
            FROM users
            WHERE org_id=%s
            ORDER BY user_id DESC
            """,
            (current_org_id,),
        )
        users = cur.fetchall()

        cur.execute(
            f"""
            SELECT id, org_id, order_title, preferred_date, preferred_time, total_amount, phone, {food_items_column} AS items, created_at
            FROM food_orders
            WHERE org_id=%s
            ORDER BY created_at DESC
            """,
            (current_org_id,),
        )
        food_orders = cur.fetchall()

        cur.execute(
            """
            SELECT id, org_id, name, email, phone, event_type, event_date, guests, created_at
            FROM event_bookings
            WHERE org_id=%s
            ORDER BY created_at DESC
            """,
            (current_org_id,),
        )
        event_bookings = cur.fetchall()

        cur.execute(
            """
            SELECT id, org_id, room_name, check_in, check_out, amount, payment_phone, created_at
            FROM room_bookings
            WHERE org_id=%s
            ORDER BY created_at DESC
            """,
            (current_org_id,),
        )
        room_bookings = cur.fetchall()

        organization = get_organization_by_id(current_org_id)

        return jsonify(
            {
                "organization": {key: serialize_value(value) for key, value in organization.items()} if organization else None,
                "users": serialize_rows(users),
                "food_orders": serialize_rows(food_orders),
                "event_bookings": serialize_rows(event_bookings),
                "room_bookings": serialize_rows(room_bookings),
            }
        )
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/payments", methods=["GET"])
@require_admin
def get_payments():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT * FROM payments")
        data = cur.fetchall()
        return jsonify(serialize_rows(data))
    finally:
        cur.close()
        conn.close()


# ---------------- FOOD ORDER ----------------
@app.route("/api/food_orders", methods=["POST", "OPTIONS"])
def food_order():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}
        current_org_id = resolve_user_org_id(session.get("user", {})) or get_default_org_id()
        items = data.get("items")
        if not isinstance(items, (list, dict)):
            items = []

        items_json = json.dumps(items)
        food_items_column = get_food_items_column()

        conn = get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                f"""
                INSERT INTO food_orders
                (org_id, order_title, preferred_date, preferred_time, total_amount, phone, {food_items_column})
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    current_org_id,
                    data.get("order_title"),
                    data.get("preferred_date"),
                    data.get("preferred_time"),
                    data.get("total_amount"),
                    data.get("payment_phone"),
                    items_json,
                ),
            )
            conn.commit()
            return jsonify({"message": "Food order saved"})
        finally:
            cur.close()
            conn.close()
    except Exception as error:
        print("FOOD ERROR:", str(error))
        return jsonify({"error": str(error)}), 500


@app.route("/api/event_bookings", methods=["POST", "OPTIONS"])
def event_booking():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}
        current_org_id = resolve_user_org_id(session.get("user", {})) or get_default_org_id()

        conn = get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                """
                INSERT INTO event_bookings
                (org_id, name, email, phone, event_type, event_date, guests)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    current_org_id,
                    data.get("name"),
                    data.get("email"),
                    data.get("phone"),
                    data.get("event_type"),
                    data.get("event_date"),
                    data.get("guests"),
                ),
            )
            conn.commit()
            return jsonify({"message": "Event booking saved"})
        finally:
            cur.close()
            conn.close()
    except Exception as error:
        print("EVENT ERROR:", str(error))
        return jsonify({"error": str(error)}), 500


@app.route("/api/stay_bookings", methods=["POST", "OPTIONS"])
def stay_booking():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}
        current_org_id = resolve_user_org_id(session.get("user", {})) or get_default_org_id()

        conn = get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                """
                INSERT INTO room_bookings
                (org_id, user_id, room_name, check_in, check_out, amount, payment_phone)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    current_org_id,
                    session.get("user", {}).get("user_id"),
                    data.get("room_name"),
                    data.get("check_in"),
                    data.get("check_out"),
                    data.get("amount"),
                    data.get("payment_phone") or data.get("phone") or "0700000000",
                ),
            )
            conn.commit()
            return jsonify({"message": "Stay booking saved"})
        finally:
            cur.close()
            conn.close()
    except Exception as error:
        import traceback

        print("STAY BOOKING ERROR:", str(error))
        traceback.print_exc()
        return jsonify({"error": str(error)}), 500


@app.route("/api/room_bookings", methods=["POST", "OPTIONS"])
def room_booking():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}
        current_org_id = resolve_user_org_id(session.get("user", {})) or get_default_org_id()

        conn = get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                """
                INSERT INTO room_bookings
                (org_id, user_id, room_name, check_in, check_out, amount, payment_phone)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    current_org_id,
                    session.get("user", {}).get("user_id"),
                    data.get("room_name"),
                    data.get("check_in"),
                    data.get("check_out"),
                    data.get("amount"),
                    data.get("payment_phone"),
                ),
            )
            conn.commit()
            return jsonify({"message": "Room booking saved"})
        finally:
            cur.close()
            conn.close()
    except Exception as error:
        print("ROOM ERROR:", str(error))
        return jsonify({"error": str(error)}), 500


# ---------------- M-PESA (SANDBOX) ----------------
CONSUMER_KEY = "2d4bHfA7WhY123XfrBAZt7KAjksXAfApUGS2AseRAlJkG9k2"
CONSUMER_SECRET = "ShRXc0X80vbBMEeWIjoAu4iQ16hdAcvXppsGJq7dOkgzOUu9O4s5WjhYyJaRvaIk"
SHORTCODE = "174379"
PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
CALLBACK_URL = "https://calebtonny.alwaysdata.net/api/callback"


def format_phone(phone):
    phone = str(phone).strip()

    if phone.startswith("+"):
        phone = phone[1:]
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    if not phone.startswith("254"):
        raise ValueError("Invalid phone format. Use 07XXXXXXXX")

    return phone


def get_access_token():
    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    response = requests.get(url, auth=(CONSUMER_KEY, CONSUMER_SECRET))

    print("TOKEN STATUS:", response.status_code)
    print("TOKEN BODY:", response.text)

    if response.status_code != 200:
        raise Exception("Failed to get access token")

    token = response.json().get("access_token")
    if not token:
        raise Exception("No access token received")

    return token


@app.route("/api/mpesa_payment", methods=["POST", "OPTIONS"])
def mpesa():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}
        phone = format_phone(data.get("phone"))
        amount = int(data.get("amount"))

        if phone != "254708374149":
            return jsonify({"error": "Use sandbox number 254708374149 for testing"}), 400

        token = get_access_token()
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode((SHORTCODE + PASSKEY + timestamp).encode()).decode()

        payload = {
            "BusinessShortCode": SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone,
            "PartyB": SHORTCODE,
            "PhoneNumber": phone,
            "CallBackURL": CALLBACK_URL,
            "AccountReference": "SokoGarden",
            "TransactionDesc": "Payment",
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        response = requests.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers=headers,
        )

        print("STK STATUS:", response.status_code)
        print("STK BODY:", response.text)

        response_data = response.json()
        if response_data.get("ResponseCode") == "0":
            return jsonify(
                {
                    "success": True,
                    "message": "STK push sent",
                    "data": response_data,
                }
            )

        return jsonify({"success": False, "error": response_data}), 400
    except Exception as error:
        import traceback

        print("MPESA ERROR:", str(error))
        traceback.print_exc()
        return jsonify({"error": str(error)}), 500


@app.route("/api/callback", methods=["POST"])
def callback():
    data = request.get_json()
    print("CALLBACK RECEIVED:", data)
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)
