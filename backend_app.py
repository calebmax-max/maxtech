import base64
import json
import os
import smtplib
import time
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from functools import wraps

import pymysql
import requests
from flask import Flask, Response, jsonify, request, session, stream_with_context
from flask_cors import CORS
from requests.auth import HTTPBasicAuth
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
KITCHEN_EMAIL = os.getenv("KITCHEN_EMAIL", "tonie@gmail.com").strip().lower()
KITCHEN_PASSWORD = os.getenv("KITCHEN_PASSWORD", "Caleb123").strip()
FOOD_ORDER_STATUSES = {"pending", "preparing", "ready", "completed", "cancelled"}
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").strip().lower() == "true"
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USERNAME or "noreply@elitehotels.com").strip()
SMS_API_URL = os.getenv("SMS_API_URL", "").strip()
SMS_API_TOKEN = os.getenv("SMS_API_TOKEN", "").strip()
SMS_SENDER_ID = os.getenv("SMS_SENDER_ID", "EliteHotels").strip()


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


def is_kitchen_email(email):
    return email.strip().lower() == KITCHEN_EMAIL


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


def require_kitchen(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = session.get("user")
        if not user:
            return jsonify({"message": "Unauthorized"}), 403
        if not (user.get("is_admin") or user.get("role") == "kitchen"):
            return jsonify({"message": "Forbidden"}), 403
        return view(*args, **kwargs)

    return wrapped


def require_login(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = session.get("user")
        if not user:
            return jsonify({"message": "Unauthorized"}), 401
        return view(*args, **kwargs)

    return wrapped


def require_roles(*allowed_roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = session.get("user")
            if not user or not user.get("is_admin"):
                return jsonify({"message": "Unauthorized"}), 403
            if allowed_roles and user.get("role") not in allowed_roles:
                return jsonify({"message": "Forbidden"}), 403
            return view(*args, **kwargs)

        return wrapped

    return decorator


def ensure_column(cursor, table_name, column_name, column_definition):
    cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE %s", (column_name,))
    if not cursor.fetchone():
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")


DEFAULT_ROOMS = [
    {
        "name": "Solo Traveler Room",
        "price": "KSh 8,900",
        "image": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        "description": "A smart single-occupancy room with a calm layout, efficient workspace, and everything needed for one guest.",
        "overview": "Built for solo stays, this room keeps things comfortable and practical with a cozy sleeping area, fast connectivity, and an easy work-rest rhythm.",
        "guests": "1 Guest",
        "size": "24 m2",
        "bed": "1 Single Bed",
        "idealFor": "Solo travelers and short business stays",
        "features": ["Smart TV", "Free Wi-Fi", "Work Desk", "Air Conditioning"],
    },
    {
        "name": "Business Solo Room",
        "price": "KSh 9,600",
        "image": "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80",
        "description": "A polished one-guest room with quiet surroundings, strong lighting, and a focused business-friendly setup.",
        "overview": "This room is ideal for guests traveling alone who want a little more comfort, a dependable desk setup, and a peaceful overnight stay.",
        "guests": "1 Guest",
        "size": "26 m2",
        "bed": "1 Double Bed",
        "idealFor": "Single business trips and overnight stays",
        "features": ["Smart TV", "Wi-Fi", "Coffee Station", "Daily Housekeeping"],
    },
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
                {
                    "name": "Omelette & Toast Combo",
                    "price": "KSh 780",
                    "image": "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Tropical Fruit Bowl",
                    "price": "KSh 640",
                    "image": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "French Toast Delight",
                    "price": "KSh 890",
                    "image": "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Breakfast Sausage Platter",
                    "price": "KSh 1,050",
                    "image": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
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
                {
                    "name": "Herb Chicken Supreme",
                    "price": "KSh 1,980",
                    "image": "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Vegetable Stir Fry Rice Bowl",
                    "price": "KSh 1,350",
                    "image": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Roasted Lamb With Herbs",
                    "price": "KSh 2,650",
                    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Signature Salmon Plate",
                    "price": "KSh 2,480",
                    "image": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=80",
                },
            ],
        },
        {
            "title": "Soups & Starters",
            "description": "Warm starters and light opening dishes for lunch and dinner service.",
            "items": [
                {
                    "name": "Cream of Mushroom Soup",
                    "price": "KSh 680",
                    "image": "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Roasted Tomato Basil Soup",
                    "price": "KSh 620",
                    "image": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Crispy Calamari Rings",
                    "price": "KSh 1,180",
                    "image": "https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Chicken Spring Rolls",
                    "price": "KSh 840",
                    "image": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
                },
            ],
        },
        {
            "title": "Snacks & Fast Bites",
            "description": "Quick favorites for casual dining, room service, and light meals.",
            "items": [
                {
                    "name": "Double Cheese Burger",
                    "price": "KSh 1,150",
                    "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Crispy Chicken Wrap",
                    "price": "KSh 980",
                    "image": "https://images.unsplash.com/photo-1608039755401-742074f0548d?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Loaded Fries Basket",
                    "price": "KSh 720",
                    "image": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Club Sandwich Deluxe",
                    "price": "KSh 890",
                    "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Spicy Chicken Wings",
                    "price": "KSh 1,020",
                    "image": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Mini Pizza Bites",
                    "price": "KSh 1,180",
                    "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
                },
            ],
        },
        {
            "title": "Local Favorites",
            "description": "Comforting Kenyan-inspired meals prepared with rich local flavor.",
            "items": [
                {
                    "name": "Nyama Choma Platter",
                    "price": "KSh 2,300",
                    "image": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Pilau Beef Bowl",
                    "price": "KSh 1,480",
                    "image": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Tilapia Fry With Ugali",
                    "price": "KSh 1,950",
                    "image": "https://images.unsplash.com/photo-1559847844-d721426d6edc?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Chapati Chicken Curry",
                    "price": "KSh 1,320",
                    "image": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80",
                },
            ],
        },
        {
            "title": "Desserts & Drinks",
            "description": "Sweet finishes and refreshing beverages to complete your dining experience.",
            "items": [
                {
                    "name": "Chocolate Lava Cake",
                    "price": "KSh 780",
                    "image": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Vanilla Berry Cheesecake",
                    "price": "KSh 860",
                    "image": "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Fresh Passion Juice",
                    "price": "KSh 420",
                    "image": "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Signature Cappuccino",
                    "price": "KSh 390",
                    "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Ice Cream Sundae",
                    "price": "KSh 690",
                    "image": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80",
                },
                {
                    "name": "Fresh Strawberry Mocktail",
                    "price": "KSh 560",
                    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80",
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
        {
            "title": "Royal Grill Experience",
            "price": "KSh 3,980",
            "image": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
            "tag": "Premium Dining",
            "description": "An elevated grill plate with steak, roast vegetables, and signature sauces served in a bold restaurant presentation.",
        },
        {
            "title": "Dessert Tasting Trio",
            "price": "KSh 1,420",
            "image": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=1200&q=80",
            "tag": "Sweet Selection",
            "description": "Three dessert favorites plated together for guests who want to explore more than one sweet finish in a single order.",
        },
    ],
}


def merge_rooms_with_defaults(rooms):
    current_rooms = rooms if isinstance(rooms, list) else []
    current_names = {
        (room.get("name") or "").strip().lower()
        for room in current_rooms
        if isinstance(room, dict)
    }

    return list(current_rooms) + [
        json.loads(json.dumps(room))
        for room in DEFAULT_ROOMS
        if room["name"].strip().lower() not in current_names
    ]


def merge_dining_catalog_with_defaults(dining):
    current_catalog = dining if isinstance(dining, dict) else {}
    current_categories = current_catalog.get("categories")
    current_featured = current_catalog.get("featuredPlates")

    merged_categories = []
    existing_categories = current_categories if isinstance(current_categories, list) else []
    default_category_titles = {
        default_category["title"].strip().lower() for default_category in DEFAULT_DINING["categories"]
    }

    for default_category in DEFAULT_DINING["categories"]:
        matching_category = next(
            (
                category
                for category in existing_categories
                if (category.get("title") or "").strip().lower()
                == default_category["title"].strip().lower()
            ),
            None,
        )

        if not matching_category:
            merged_categories.append(json.loads(json.dumps(default_category)))
            continue

        existing_items = matching_category.get("items") if isinstance(matching_category.get("items"), list) else []
        existing_names = {
            (item.get("name") or "").strip().lower()
            for item in existing_items
            if isinstance(item, dict)
        }
        default_items_to_add = [
            json.loads(json.dumps(item))
            for item in default_category["items"]
            if item["name"].strip().lower() not in existing_names
        ]

        merged_categories.append(
            {
                **matching_category,
                "description": matching_category.get("description") or default_category["description"],
                "items": existing_items + default_items_to_add,
            }
        )

    merged_categories.extend(
        category
        for category in existing_categories
        if isinstance(category, dict)
        and (category.get("title") or "").strip().lower() not in default_category_titles
    )

    existing_featured_list = current_featured if isinstance(current_featured, list) else []
    existing_featured_titles = {
        (plate.get("title") or "").strip().lower()
        for plate in existing_featured_list
        if isinstance(plate, dict)
    }
    merged_featured = list(existing_featured_list) + [
        json.loads(json.dumps(plate))
        for plate in DEFAULT_DINING["featuredPlates"]
        if plate["title"].strip().lower() not in existing_featured_titles
    ]

    return {
        "categories": merged_categories,
        "featuredPlates": merged_featured,
    }


# ---------------- TABLES ----------------
def create_tables():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            is_admin TINYINT(1) DEFAULT 0,
            role VARCHAR(40) DEFAULT 'guest',
            username VARCHAR(120),
            email VARCHAR(160) UNIQUE,
            phone VARCHAR(30),
            password VARCHAR(255)
        )
        """
    )
    ensure_column(cur, "users", "is_admin", "TINYINT(1) DEFAULT 0")
    ensure_column(cur, "users", "role", "VARCHAR(40) DEFAULT 'guest'")
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS room_bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
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

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS food_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            order_title VARCHAR(255),
            preferred_date DATE,
            preferred_time VARCHAR(20),
            total_amount INT,
            phone VARCHAR(20),
            status VARCHAR(40) DEFAULT 'pending',
            items JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    ensure_column(cur, "food_orders", "user_id", "INT NULL")
    ensure_column(cur, "food_orders", "status", "VARCHAR(40) DEFAULT 'pending'")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS event_bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
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
    ensure_column(cur, "event_bookings", "user_id", "INT NULL")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS site_catalog (
            id INT PRIMARY KEY,
            rooms_json LONGTEXT,
            dining_json LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            action VARCHAR(120) NOT NULL,
            entity_type VARCHAR(80) NULL,
            entity_id VARCHAR(120) NULL,
            details_json LONGTEXT NULL,
            ip_address VARCHAR(80) NULL,
            user_agent VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cur.execute("UPDATE users SET is_admin=1 WHERE LOWER(email)=%s", (ADMIN_EMAIL,))
    cur.execute("UPDATE users SET role='owner' WHERE LOWER(email)=%s", (ADMIN_EMAIL,))
    cur.execute(
        """
        INSERT INTO site_catalog(id, rooms_json, dining_json)
        VALUES(1, %s, %s)
        ON DUPLICATE KEY UPDATE
        rooms_json = COALESCE(site_catalog.rooms_json, VALUES(rooms_json)),
        dining_json = COALESCE(site_catalog.dining_json, VALUES(dining_json))
        """,
        (json.dumps(DEFAULT_ROOMS), json.dumps(DEFAULT_DINING)),
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


def table_has_column(table_name, column_name):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(f"SHOW COLUMNS FROM {table_name} LIKE %s", (column_name,))
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def prune_expired_records(cur):
    today = date.today().isoformat()

    cur.execute("DELETE FROM food_orders WHERE preferred_date IS NOT NULL AND preferred_date < %s", (today,))
    cur.execute("DELETE FROM event_bookings WHERE event_date IS NOT NULL AND event_date < %s", (today,))
    cur.execute("DELETE FROM room_bookings WHERE check_out IS NOT NULL AND check_out < %s", (today,))


def event_date_is_booked(cur, event_date):
    if not event_date:
        return False

    cur.execute(
        """
        SELECT id
        FROM event_bookings
        WHERE event_date = %s
        LIMIT 1
        """,
        (event_date,),
    )
    return cur.fetchone() is not None


def log_audit(action, entity_type=None, entity_id=None, details=None, user_id=None):
    payload = json.dumps(details or {})
    session_user = session.get("user") or {}
    target_user_id = user_id if user_id is not None else session_user.get("user_id")

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details_json, ip_address, user_agent)
            VALUES(%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                target_user_id,
                action,
                entity_type,
                str(entity_id) if entity_id is not None else None,
                payload,
                request.headers.get("X-Forwarded-For", request.remote_addr),
                request.headers.get("User-Agent", "")[:255],
            ),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def get_site_catalog():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "SELECT rooms_json, dining_json FROM site_catalog WHERE id=1",
        )
        catalog = cur.fetchone()
        if not catalog:
            return {"rooms": DEFAULT_ROOMS, "dining": DEFAULT_DINING}

        rooms = json.loads(catalog["rooms_json"]) if catalog.get("rooms_json") else DEFAULT_ROOMS
        merged_rooms = merge_rooms_with_defaults(rooms)
        dining = json.loads(catalog["dining_json"]) if catalog.get("dining_json") else DEFAULT_DINING
        merged_dining = merge_dining_catalog_with_defaults(dining)

        if merged_rooms != rooms or merged_dining != dining:
            cur.execute(
                "UPDATE site_catalog SET rooms_json=%s, dining_json=%s WHERE id=1",
                (json.dumps(merged_rooms), json.dumps(merged_dining)),
            )
            conn.commit()

        return {"rooms": merged_rooms, "dining": merged_dining}
    finally:
        cur.close()
        conn.close()


def save_site_catalog(rooms=None, dining=None):
    existing = get_site_catalog()
    next_rooms = rooms if rooms is not None else existing["rooms"]
    next_dining = dining if dining is not None else existing["dining"]

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            INSERT INTO site_catalog(id, rooms_json, dining_json)
            VALUES(1, %s, %s)
            ON DUPLICATE KEY UPDATE rooms_json=VALUES(rooms_json), dining_json=VALUES(dining_json)
            """,
            (json.dumps(next_rooms), json.dumps(next_dining)),
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


def send_email_confirmation(recipient_email, subject, body):
    if not recipient_email or not SMTP_HOST or not EMAIL_FROM:
        return False, "Email confirmation skipped: SMTP is not configured."

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = EMAIL_FROM
    message["To"] = recipient_email
    message.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        return True, "Email confirmation sent."
    except Exception as error:
        print("EMAIL CONFIRMATION ERROR:", str(error))
        return False, str(error)


def send_sms_confirmation(phone, message):
    if not phone or not SMS_API_URL:
        return False, "SMS confirmation skipped: SMS provider is not configured."

    try:
        formatted_phone = format_phone(phone)
        headers = {"Content-Type": "application/json"}
        if SMS_API_TOKEN:
            headers["Authorization"] = f"Bearer {SMS_API_TOKEN}"

        response = requests.post(
            SMS_API_URL,
            json={
                "to": formatted_phone,
                "message": message,
                "sender_id": SMS_SENDER_ID,
            },
            headers=headers,
            timeout=20,
        )
        response.raise_for_status()
        return True, "SMS confirmation sent."
    except Exception as error:
        print("SMS CONFIRMATION ERROR:", str(error))
        return False, str(error)


def send_guest_confirmation(email=None, phone=None, email_subject="", email_body="", sms_body=""):
    results = []

    if email and email_subject and email_body:
        results.append(("email",) + send_email_confirmation(email, email_subject, email_body))

    if phone and sms_body:
        results.append(("sms",) + send_sms_confirmation(phone, sms_body))

    return results


def get_latest_record_ids(cursor):
    latest_ids = {}

    cursor.execute("SELECT COALESCE(MAX(id), 0) AS latest_id FROM food_orders")
    latest_ids["food_order"] = int((cursor.fetchone() or {}).get("latest_id") or 0)

    cursor.execute("SELECT COALESCE(MAX(id), 0) AS latest_id FROM event_bookings")
    latest_ids["event_booking"] = int((cursor.fetchone() or {}).get("latest_id") or 0)

    cursor.execute("SELECT COALESCE(MAX(id), 0) AS latest_id FROM room_bookings")
    latest_ids["room_booking"] = int((cursor.fetchone() or {}).get("latest_id") or 0)

    return latest_ids


def sse_payload(event_name, payload):
    return f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"


def format_amount_text(value):
    digits = "".join(character for character in str(value or "") if character.isdigit())
    amount = int(digits) if digits else 0
    return f"KSh {amount:,}"


def normalize_food_order_status(status):
    normalized_status = (status or "pending").strip().lower()
    return normalized_status if normalized_status in FOOD_ORDER_STATUSES else "pending"


def hydrate_food_orders(rows):
    orders = serialize_rows(rows)

    for order in orders:
        order["status"] = normalize_food_order_status(order.get("status"))
        items_value = order.get("items")
        if isinstance(items_value, str):
            try:
                order["items"] = json.loads(items_value)
            except json.JSONDecodeError:
                order["items"] = []
        elif items_value is None:
            order["items"] = []

    return orders


def build_safe_user(user):
    role = user.get("role") or ("owner" if is_admin_email(user["email"]) else "guest")
    is_admin = bool(user.get("is_admin")) or role in {"owner", "admin"} or is_admin_email(user["email"])
    return {
        "user_id": user["user_id"],
        "username": user.get("username"),
        "email": user["email"],
        "phone": user.get("phone"),
        "role": role,
        "is_admin": is_admin,
    }


def build_kitchen_user():
    return {
        "user_id": 0,
        "username": "Kitchen Staff",
        "email": KITCHEN_EMAIL,
        "phone": "",
        "role": "kitchen",
        "is_admin": False,
    }


@app.route("/api/debug/version", methods=["GET"])
def debug_version():
    return jsonify(
        {
            "app": "elitehotel-backend",
            "version": "2026-03-27-single-hotel-cleanup-v1",
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

    if not email or not password or not username or not phone:
        return jsonify({"message": "All fields are required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT user_id FROM users WHERE email=%s", (email,))
        if cur.fetchone():
            return jsonify({"message": "Email exists"}), 409

        is_admin = 1 if is_admin_email(email) else 0
        role = "owner" if is_admin else "guest"

        cur.execute(
            """
            INSERT INTO users(is_admin,role,username,email,phone,password)
            VALUES(%s,%s,%s,%s,%s,%s)
            """,
            (is_admin, role, username, email, phone, generate_password_hash(password)),
        )
        user_id = cur.lastrowid
        conn.commit()
        log_audit(
            "user.signup",
            entity_type="user",
            entity_id=user_id,
            details={"email": email},
            user_id=user_id,
        )
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

    if is_kitchen_email(email) and password == KITCHEN_PASSWORD:
        safe_user = build_kitchen_user()
        session["user"] = safe_user
        session.permanent = True
        return jsonify({"message": "Kitchen login successful", "user": safe_user})

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT * FROM users WHERE email=%s", (email,))
        user = cur.fetchone()

        password_ok, needs_upgrade = verify_password(user["password"], password) if user else (False, False)
        if not user or not password_ok:
            session.pop("user", None)
            return jsonify({"message": "Invalid credentials"}), 401

        if is_admin_email(user["email"]) and not user.get("is_admin"):
            cur.execute("UPDATE users SET is_admin=1 WHERE user_id=%s", (user["user_id"],))
            conn.commit()
            user["is_admin"] = 1
        if is_admin_email(user["email"]) and user.get("role") != "owner":
            cur.execute("UPDATE users SET role='owner' WHERE user_id=%s", (user["user_id"],))
            conn.commit()
            user["role"] = "owner"

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
        log_audit(
            "user.signin",
            entity_type="user",
            entity_id=user["user_id"],
            details={"email": user["email"], "role": safe_user["role"]},
            user_id=user["user_id"],
        )

        return jsonify({"message": "Login successful", "user": safe_user})
    finally:
        cur.close()
        conn.close()


@app.route("/api/signout", methods=["POST"])
def signout():
    current_user = session.get("user") or {}
    if current_user.get("user_id"):
        log_audit(
            "user.signout",
            entity_type="user",
            entity_id=current_user.get("user_id"),
            details={"email": current_user.get("email")},
            user_id=current_user.get("user_id"),
        )
    session.clear()
    return jsonify({"message": "Signed out"})


@app.route("/api/me", methods=["GET"])
def get_current_user():
    user = session.get("user")
    if not user:
        return jsonify({"user": None})

    return jsonify({"user": user})


@app.route("/api/profile/overview", methods=["GET"])
@require_login
def profile_overview():
    current_user = session.get("user") or {}
    user_id = current_user.get("user_id")
    email = (current_user.get("email") or "").strip().lower()
    phone = (current_user.get("phone") or "").strip()

    conn = get_connection()
    cur = conn.cursor()
    food_items_column = get_food_items_column()
    food_orders_has_user_id = table_has_column("food_orders", "user_id")
    food_orders_has_status = table_has_column("food_orders", "status")
    event_bookings_has_user_id = table_has_column("event_bookings", "user_id")
    room_bookings_has_user_id = table_has_column("room_bookings", "user_id")

    try:
        if room_bookings_has_user_id:
            room_query = """
                SELECT id, room_name, check_in, check_out, amount, payment_phone, created_at
                FROM room_bookings
                WHERE user_id=%s
                ORDER BY created_at DESC
            """
            cur.execute(room_query, (user_id,))
            room_bookings = serialize_rows(cur.fetchall())
        else:
            room_bookings = []

        food_status_select = "status" if food_orders_has_status else "'pending'"

        if food_orders_has_user_id and phone:
            cur.execute(
                f"""
                SELECT id, order_title, preferred_date, preferred_time, total_amount, phone, {food_status_select} AS status, {food_items_column} AS items, created_at
                FROM food_orders
                WHERE user_id=%s OR phone=%s
                ORDER BY created_at DESC
                """,
                (user_id, phone),
            )
        elif food_orders_has_user_id:
            cur.execute(
                f"""
                SELECT id, order_title, preferred_date, preferred_time, total_amount, phone, {food_status_select} AS status, {food_items_column} AS items, created_at
                FROM food_orders
                WHERE user_id=%s
                ORDER BY created_at DESC
                """,
                (user_id,),
            )
        elif phone:
            cur.execute(
                f"""
                SELECT id, order_title, preferred_date, preferred_time, total_amount, phone, {food_status_select} AS status, {food_items_column} AS items, created_at
                FROM food_orders
                WHERE phone=%s
                ORDER BY created_at DESC
                """,
                (phone,),
            )
        else:
            food_orders = []

        if food_orders_has_user_id or phone:
            food_orders = hydrate_food_orders(cur.fetchall())
        else:
            food_orders = []

        if event_bookings_has_user_id and email and phone:
            cur.execute(
                """
                SELECT id, name, email, phone, event_type, event_date, guests, created_at
                FROM event_bookings
                WHERE user_id=%s OR LOWER(email)=%s OR phone=%s
                ORDER BY created_at DESC
                """,
                (user_id, email, phone),
            )
        elif event_bookings_has_user_id and email:
            cur.execute(
                """
                SELECT id, name, email, phone, event_type, event_date, guests, created_at
                FROM event_bookings
                WHERE user_id=%s OR LOWER(email)=%s
                ORDER BY created_at DESC
                """,
                (user_id, email),
            )
        elif event_bookings_has_user_id and phone:
            cur.execute(
                """
                SELECT id, name, email, phone, event_type, event_date, guests, created_at
                FROM event_bookings
                WHERE user_id=%s OR phone=%s
                ORDER BY created_at DESC
                """,
                (user_id, phone),
            )
        elif email and phone:
            cur.execute(
                """
                SELECT id, name, email, phone, event_type, event_date, guests, created_at
                FROM event_bookings
                WHERE LOWER(email)=%s OR phone=%s
                ORDER BY created_at DESC
                """,
                (email, phone),
            )
        elif email:
            cur.execute(
                """
                SELECT id, name, email, phone, event_type, event_date, guests, created_at
                FROM event_bookings
                WHERE LOWER(email)=%s
                ORDER BY created_at DESC
                """,
                (email,),
            )
        elif phone:
            cur.execute(
                """
                SELECT id, name, email, phone, event_type, event_date, guests, created_at
                FROM event_bookings
                WHERE phone=%s
                ORDER BY created_at DESC
                """,
                (phone,),
            )
        else:
            event_bookings = []

        if event_bookings_has_user_id or email or phone:
            event_bookings = serialize_rows(cur.fetchall())
        else:
            event_bookings = []

        return jsonify(
            {
                "user": current_user,
                "food_orders": food_orders,
                "event_bookings": event_bookings,
                "room_bookings": room_bookings,
            }
        )
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/check", methods=["GET"])
@require_admin
def admin_check():
    return jsonify({"message": "Welcome admin", "user": session.get("user")})


# ---------------- PUBLIC SaaS CATALOG ----------------
@app.route("/api/catalog/rooms", methods=["GET"])
def catalog_rooms():
    return jsonify({"rooms": get_site_catalog()["rooms"]})


@app.route("/api/catalog/dining", methods=["GET"])
def catalog_dining():
    return jsonify({"catalog": get_site_catalog()["dining"]})


# ---------------- ADMIN ----------------
@app.route("/api/admin/catalog/rooms", methods=["GET", "PUT"])
@require_admin
def admin_catalog_rooms():
    if request.method == "GET":
        return jsonify({"rooms": get_site_catalog()["rooms"]})

    data = request.get_json() or {}
    rooms = data.get("rooms")
    if not isinstance(rooms, list):
        return jsonify({"message": "Rooms payload must be a list"}), 400

    catalog = save_site_catalog(rooms=rooms)
    log_audit("catalog.rooms_updated", entity_type="site_catalog", entity_id=1, details={"count": len(rooms)})
    return jsonify({"rooms": catalog["rooms"]})


@app.route("/api/admin/catalog/dining", methods=["GET", "PUT"])
@require_admin
def admin_catalog_dining():
    if request.method == "GET":
        return jsonify({"catalog": get_site_catalog()["dining"]})

    data = request.get_json() or {}
    catalog_payload = data.get("catalog")
    if not isinstance(catalog_payload, dict):
        return jsonify({"message": "Catalog payload must be an object"}), 400

    catalog = save_site_catalog(dining=catalog_payload)
    log_audit(
        "catalog.dining_updated",
        entity_type="site_catalog",
        entity_id=1,
        details={"featured_count": len(catalog_payload.get("featuredPlates", []))},
    )
    return jsonify({"catalog": catalog["dining"]})


@app.route("/api/admin/users/<int:user_id>/role", methods=["PUT"])
@require_roles("owner")
def update_user_role(user_id):
    data = request.get_json() or {}
    next_role = (data.get("role") or "").strip().lower()
    allowed_roles = {"owner", "admin", "staff", "viewer", "guest"}

    if next_role not in allowed_roles:
        return jsonify({"message": "Invalid role"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "SELECT user_id, email, role FROM users WHERE user_id=%s",
            (user_id,),
        )
        target_user = cur.fetchone()
        if not target_user:
            return jsonify({"message": "User not found"}), 404

        cur.execute(
            "UPDATE users SET role=%s, is_admin=%s WHERE user_id=%s",
            (next_role, 1 if next_role in {"owner", "admin"} else 0, user_id),
        )
        conn.commit()
        log_audit(
            "user.role_updated",
            entity_type="user",
            entity_id=user_id,
            details={"email": target_user["email"], "from": target_user.get("role"), "to": next_role},
            user_id=session.get("user", {}).get("user_id"),
        )
        return jsonify({"message": "User role updated"})
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/audit-logs", methods=["GET"])
@require_admin
def get_audit_logs():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT id, user_id, action, entity_type, entity_id, details_json, ip_address, user_agent, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 50
            """
        )
        logs = serialize_rows(cur.fetchall())
        return jsonify({"logs": logs})
    finally:
        cur.close()
        conn.close()


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

    try:
        prune_expired_records(cur)
        conn.commit()

        cur.execute("SELECT * FROM room_bookings")
        rooms = cur.fetchall()

        cur.execute("SELECT * FROM food_orders")
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

    try:
        cur.execute(
            """
            SELECT user_id, username, email, phone, role
            FROM users
            ORDER BY user_id DESC
            """
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

    try:
        prune_expired_records(cur)
        conn.commit()

        cur.execute(
            """
            SELECT user_id, username, email, phone, role
            FROM users
            ORDER BY user_id DESC
            """
        )
        users = cur.fetchall()

        cur.execute(
            f"""
            SELECT id, order_title, preferred_date, preferred_time, total_amount, phone, status, {food_items_column} AS items, created_at
            FROM food_orders
            ORDER BY created_at DESC
            """
        )
        food_orders = hydrate_food_orders(cur.fetchall())

        cur.execute(
            """
            SELECT id, name, email, phone, event_type, event_date, guests, created_at
            FROM event_bookings
            ORDER BY created_at DESC
            """
        )
        event_bookings = cur.fetchall()

        cur.execute(
            """
            SELECT id, room_name, check_in, check_out, amount, payment_phone, created_at
            FROM room_bookings
            ORDER BY created_at DESC
            """
        )
        room_bookings = cur.fetchall()

        cur.execute(
            """
            SELECT id, user_id, action, entity_type, entity_id, details_json, ip_address, user_agent, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 20
            """
        )
        audit_logs = cur.fetchall()

        return jsonify(
            {
                "users": serialize_rows(users),
                "food_orders": food_orders,
                "event_bookings": serialize_rows(event_bookings),
                "room_bookings": serialize_rows(room_bookings),
                "audit_logs": serialize_rows(audit_logs),
            }
        )
    finally:
        cur.close()
        conn.close()


@app.route("/api/kitchen/orders", methods=["GET"])
@require_kitchen
def kitchen_orders():
    conn = get_connection()
    cur = conn.cursor()
    food_items_column = get_food_items_column()

    try:
        prune_expired_records(cur)
        conn.commit()
        cur.execute(
            f"""
            SELECT id, order_title, preferred_date, preferred_time, total_amount, phone, status, {food_items_column} AS items, created_at
            FROM food_orders
            ORDER BY created_at DESC
            """
        )
        orders = hydrate_food_orders(cur.fetchall())

        return jsonify({"food_orders": orders})
    finally:
        cur.close()
        conn.close()


@app.route("/api/food_orders/<int:order_id>/status", methods=["PUT"])
@require_kitchen
def update_food_order_status(order_id):
    data = request.get_json() or {}
    next_status = normalize_food_order_status(data.get("status"))

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT id, status, order_title FROM food_orders WHERE id=%s", (order_id,))
        order = cur.fetchone()

        if not order:
            return jsonify({"message": "Food order not found"}), 404

        current_status = normalize_food_order_status(order.get("status"))
        if current_status == next_status:
            return jsonify({"message": "Order status is already up to date", "status": next_status})

        cur.execute("UPDATE food_orders SET status=%s WHERE id=%s", (next_status, order_id))
        conn.commit()
        log_audit(
            "food_order.status_updated",
            entity_type="food_order",
            entity_id=order_id,
            details={
                "title": order.get("order_title"),
                "previous_status": current_status,
                "status": next_status,
            },
            user_id=session.get("user", {}).get("user_id"),
        )
        return jsonify({"message": "Food order status updated", "status": next_status})
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/stream", methods=["GET"])
@require_admin
def admin_stream():
    @stream_with_context
    def generate():
        conn = get_connection()
        cur = conn.cursor()

        try:
            baseline_ids = get_latest_record_ids(cur)
            yield sse_payload("connected", {"scope": "admin", "latest_ids": baseline_ids})

            while True:
                time.sleep(5)
                cur.connection.ping(reconnect=True)
                current_ids = get_latest_record_ids(cur)

                changes = [
                    record_type
                    for record_type, latest_id in current_ids.items()
                    if latest_id > baseline_ids.get(record_type, 0)
                ]

                if changes:
                    baseline_ids = current_ids
                    yield sse_payload(
                        "dashboard_update",
                        {"scope": "admin", "changes": changes, "latest_ids": current_ids},
                    )
                else:
                    yield ": keep-alive\n\n"
        finally:
            cur.close()
            conn.close()

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/api/kitchen/stream", methods=["GET"])
@require_kitchen
def kitchen_stream():
    @stream_with_context
    def generate():
        conn = get_connection()
        cur = conn.cursor()

        try:
            cur.execute("SELECT COALESCE(MAX(id), 0) AS latest_id FROM food_orders")
            latest_food_order_id = int((cur.fetchone() or {}).get("latest_id") or 0)
            yield sse_payload(
                "connected",
                {"scope": "kitchen", "latest_ids": {"food_order": latest_food_order_id}},
            )

            while True:
                time.sleep(5)
                cur.connection.ping(reconnect=True)
                cur.execute("SELECT COALESCE(MAX(id), 0) AS latest_id FROM food_orders")
                current_food_order_id = int((cur.fetchone() or {}).get("latest_id") or 0)

                if current_food_order_id > latest_food_order_id:
                    latest_food_order_id = current_food_order_id
                    yield sse_payload(
                        "dashboard_update",
                        {
                            "scope": "kitchen",
                            "changes": ["food_order"],
                            "latest_ids": {"food_order": current_food_order_id},
                        },
                    )
                else:
                    yield ": keep-alive\n\n"
        finally:
            cur.close()
            conn.close()

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
        items = data.get("items")
        if not isinstance(items, (list, dict)):
            items = []

        items_json = json.dumps(items)
        food_items_column = get_food_items_column()

        conn = get_connection()
        cur = conn.cursor()

        try:
            prune_expired_records(cur)
            cur.execute(
                f"""
                INSERT INTO food_orders
                (user_id, order_title, preferred_date, preferred_time, total_amount, phone, status, {food_items_column})
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    session.get("user", {}).get("user_id"),
                    data.get("order_title"),
                    data.get("preferred_date"),
                    data.get("preferred_time"),
                    data.get("total_amount"),
                    data.get("payment_phone"),
                    "pending",
                    items_json,
                ),
            )
            order_id = cur.lastrowid
            conn.commit()
            log_audit(
                "food_order.created",
                entity_type="food_order",
                entity_id=order_id,
                details={"title": data.get("order_title"), "total_amount": data.get("total_amount")},
                user_id=session.get("user", {}).get("user_id"),
            )
            current_user = session.get("user", {}) or {}
            send_guest_confirmation(
                email=current_user.get("email"),
                phone=data.get("payment_phone"),
                email_subject="EliteHotels Food Order Confirmation",
                email_body=(
                    f"Hello {current_user.get('username') or 'Guest'},\n\n"
                    f"Your food order '{data.get('order_title') or 'Food Order'}' has been received.\n"
                    f"Preferred date: {data.get('preferred_date') or '-'}\n"
                    f"Preferred time: {data.get('preferred_time') or '-'}\n"
                    f"Total amount: {format_amount_text(data.get('total_amount'))}\n\n"
                    "We will prepare it and keep you updated."
                ),
                sms_body=(
                    f"EliteHotels: Your food order '{data.get('order_title') or 'Food Order'}' "
                    f"for {data.get('preferred_date') or '-'} at {data.get('preferred_time') or '-'} "
                    f"has been received."
                ),
            )
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

        conn = get_connection()
        cur = conn.cursor()

        try:
            prune_expired_records(cur)

            if event_date_is_booked(cur, data.get("event_date")):
                conn.rollback()
                return jsonify({"message": "The selected event date is booked."}), 409

            cur.execute(
                """
                INSERT INTO event_bookings
                (user_id, name, email, phone, event_type, event_date, guests)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    session.get("user", {}).get("user_id"),
                    data.get("name"),
                    data.get("email"),
                    data.get("phone"),
                    data.get("event_type"),
                    data.get("event_date"),
                    data.get("guests"),
                ),
            )
            booking_id = cur.lastrowid
            conn.commit()
            log_audit(
                "event_booking.created",
                entity_type="event_booking",
                entity_id=booking_id,
                details={"event_type": data.get("event_type"), "event_date": data.get("event_date")},
                user_id=session.get("user", {}).get("user_id"),
            )
            send_guest_confirmation(
                email=data.get("email"),
                phone=data.get("phone"),
                email_subject="EliteHotels Event Request Confirmation",
                email_body=(
                    f"Hello {data.get('name') or 'Guest'},\n\n"
                    f"Your event request for '{data.get('event_type') or 'Event'}' has been received.\n"
                    f"Event date: {data.get('event_date') or '-'}\n"
                    f"Guests: {data.get('guests') or 0}\n\n"
                    "Our team will review it and contact you shortly."
                ),
                sms_body=(
                    f"EliteHotels: Your event request for '{data.get('event_type') or 'Event'}' on "
                    f"{data.get('event_date') or '-'} has been received."
                ),
            )
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

        conn = get_connection()
        cur = conn.cursor()

        try:
            prune_expired_records(cur)
            cur.execute(
                """
                INSERT INTO room_bookings
                (user_id, room_name, check_in, check_out, amount, payment_phone)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    session.get("user", {}).get("user_id"),
                    data.get("room_name"),
                    data.get("check_in"),
                    data.get("check_out"),
                    data.get("amount"),
                    data.get("payment_phone") or data.get("phone") or "0700000000",
                ),
            )
            booking_id = cur.lastrowid
            conn.commit()
            log_audit(
                "stay_booking.created",
                entity_type="room_booking",
                entity_id=booking_id,
                details={"room_name": data.get("room_name"), "amount": data.get("amount")},
                user_id=session.get("user", {}).get("user_id"),
            )
            current_user = session.get("user", {}) or {}
            send_guest_confirmation(
                email=current_user.get("email"),
                phone=data.get("payment_phone") or data.get("phone"),
                email_subject="EliteHotels Stay Booking Confirmation",
                email_body=(
                    f"Hello {current_user.get('username') or data.get('customer_name') or 'Guest'},\n\n"
                    f"Your stay booking for '{data.get('room_name') or 'Hotel Room'}' has been received.\n"
                    f"Check-in: {data.get('check_in') or '-'}\n"
                    f"Check-out: {data.get('check_out') or '-'}\n"
                    f"Amount: {format_amount_text(data.get('amount'))}\n\n"
                    "Thank you for choosing EliteHotels."
                ),
                sms_body=(
                    f"EliteHotels: Your stay booking for '{data.get('room_name') or 'Hotel Room'}' "
                    f"from {data.get('check_in') or '-'} to {data.get('check_out') or '-'} "
                    "has been received."
                ),
            )
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

        conn = get_connection()
        cur = conn.cursor()

        try:
            prune_expired_records(cur)
            cur.execute(
                """
                INSERT INTO room_bookings
                (user_id, room_name, check_in, check_out, amount, payment_phone)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    session.get("user", {}).get("user_id"),
                    data.get("room_name"),
                    data.get("check_in"),
                    data.get("check_out"),
                    data.get("amount"),
                    data.get("payment_phone"),
                ),
            )
            booking_id = cur.lastrowid
            conn.commit()
            log_audit(
                "room_booking.created",
                entity_type="room_booking",
                entity_id=booking_id,
                details={"room_name": data.get("room_name"), "amount": data.get("amount")},
                user_id=session.get("user", {}).get("user_id"),
            )
            current_user = session.get("user", {}) or {}
            send_guest_confirmation(
                email=current_user.get("email"),
                phone=data.get("payment_phone"),
                email_subject="EliteHotels Room Booking Confirmation",
                email_body=(
                    f"Hello {current_user.get('username') or 'Guest'},\n\n"
                    f"Your room booking for '{data.get('room_name') or 'Hotel Room'}' has been received.\n"
                    f"Check-in: {data.get('check_in') or '-'}\n"
                    f"Check-out: {data.get('check_out') or '-'}\n"
                    f"Amount: {format_amount_text(data.get('amount'))}\n\n"
                    "We look forward to hosting you."
                ),
                sms_body=(
                    f"EliteHotels: Your room booking for '{data.get('room_name') or 'Hotel Room'}' "
                    f"from {data.get('check_in') or '-'} to {data.get('check_out') or '-'} "
                    "has been received."
                ),
            )
            return jsonify({"message": "Room booking saved"})
        finally:
            cur.close()
            conn.close()
    except Exception as error:
        print("ROOM ERROR:", str(error))
        return jsonify({"error": str(error)}), 500


# ---------------- M-PESA (SANDBOX) ----------------
MPESA_ENV = os.getenv("MPESA_ENV", "sandbox").strip().lower()
CONSUMER_KEY = os.getenv("MPESA_CONSUMER_KEY", "GTWADFxIpUfDoNikNGqq1C3023evM6UH").strip()
CONSUMER_SECRET = os.getenv("MPESA_CONSUMER_SECRET", "amFbAoUByPV2rM5A").strip()
SHORTCODE = os.getenv("MPESA_SHORTCODE", "174379").strip()
PASSKEY = os.getenv("MPESA_PASSKEY", "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919").strip()
CALLBACK_URL = os.getenv("MPESA_CALLBACK_URL", "https://modcom.co.ke/api/confirmation.php").strip()
MPESA_ACCOUNT_REFERENCE = os.getenv("MPESA_ACCOUNT_REFERENCE", "account").strip()
MPESA_TRANSACTION_DESC = os.getenv("MPESA_TRANSACTION_DESC", "account").strip()


def get_mpesa_base_url():
    if MPESA_ENV == "production":
        return "https://api.safaricom.co.ke"
    return "https://sandbox.safaricom.co.ke"


def get_mpesa_error_message(payload):
    if isinstance(payload, str) and payload.strip():
        return payload

    if isinstance(payload, dict):
        for key in ("errorMessage", "CustomerMessage", "ResponseDescription", "responseDescription"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value

        error_code = payload.get("errorCode")
        request_id = payload.get("requestId")
        if error_code and request_id:
            return f"M-Pesa error {error_code}: {payload.get('errorMessage', 'Request failed')} ({request_id})"

    return "M-Pesa request failed. Confirm your credentials and try again."


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
    if not CONSUMER_KEY or not CONSUMER_SECRET:
        raise Exception("M-Pesa consumer key and consumer secret are required")

    url = f"{get_mpesa_base_url()}/oauth/v1/generate?grant_type=client_credentials"
    response = requests.get(url, auth=HTTPBasicAuth(CONSUMER_KEY, CONSUMER_SECRET), timeout=30)

    print("TOKEN STATUS:", response.status_code)
    print("TOKEN BODY:", response.text)

    if response.status_code != 200:
        raise Exception(f"Failed to get access token: {response.text}")

    token = response.json().get("access_token")
    if not token:
        raise Exception(f"No access token received: {response.text}")

    return token


@app.route("/api/mpesa_payment", methods=["POST", "OPTIONS"])
def mpesa():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        amount = request.form.get("amount") or data.get("amount")
        phone = request.form.get("phone") or data.get("phone")

        if not amount or not phone:
            return jsonify({"error": "Amount and phone are required"}), 400

        phone = format_phone(phone)
        amount = int(amount)

        api_url = f"{get_mpesa_base_url()}/oauth/v1/generate?grant_type=client_credentials"
        token_response = requests.get(api_url, auth=HTTPBasicAuth(CONSUMER_KEY, CONSUMER_SECRET), timeout=30)
        token_data = token_response.json()
        access_token = f"Bearer {token_data['access_token']}"

        timestamp = datetime.today().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(f"{SHORTCODE}{PASSKEY}{timestamp}".encode()).decode("utf-8")

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
            "AccountReference": MPESA_ACCOUNT_REFERENCE,
            "TransactionDesc": MPESA_TRANSACTION_DESC,
        }

        headers = {
            "Authorization": access_token,
            "Content-Type": "application/json",
        }

        response = requests.post(
            f"{get_mpesa_base_url()}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers=headers,
            timeout=30,
        )

        print("STK STATUS:", response.status_code)
        print("STK BODY:", response.text)

        response_data = response.json()
        if response_data.get("ResponseCode") == "0":
            return jsonify(
                {
                    "success": True,
                    "message": "Please Complete Payment in Your Phone and we will deliver in minutes",
                    "data": response_data,
                }
            )

        return jsonify(
            {
                "success": False,
                "error": get_mpesa_error_message(response_data),
                "details": response_data,
            }
        ), 400
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
