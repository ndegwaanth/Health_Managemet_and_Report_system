from flask import Flask
from dotenv import load_dotenv
from flask_bcrypt import Bcrypt
import secrets
from flask_wtf.csrf import CSRFProtect
import os
from flask_login import LoginManager
from pymongo import MongoClient
from flask_session import Session
from datetime import timedelta
from .models import User

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__, template_folder="templates")

# Essential configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))

# Flask-Session configuration
app.config.update({
    'SESSION_TYPE': 'filesystem',
    'SESSION_FILE_DIR': './flask_sessions',
    'SESSION_PERMANENT': True,
    'PERMANENT_SESSION_LIFETIME': timedelta(days=1),
    'SESSION_COOKIE_NAME': 'pa_session',
    'SESSION_COOKIE_SECURE': False,  # True in production
    'SESSION_COOKIE_HTTPONLY': True,
    'SESSION_COOKIE_SAMESITE': 'Lax',
    'SESSION_REFRESH_EACH_REQUEST': True,
    'SESSION_COOKIE_PATH': 'flask_session/Sessions',
    'PERMANENT_SESSION_LIFETIME': timedelta(days=1)
})


# Initialize extensions in correct order
csrf = CSRFProtect(app)
Session(app)

# MongoDB Configuration
Mongo_url = os.getenv("MONGODB")
client = MongoClient(Mongo_url)
db = client['Users']
collection = db['users-info']

bcrypt = Bcrypt(app)

# Flask-Login configuration
login_manager = LoginManager(app)
login_manager.login_view = 'main.login'
login_manager.session_protection = "strong"

@login_manager.user_loader
def load_user(user_id):
    try:
        # MongoDB uses ObjectId - ensure proper conversion
        from bson.objectid import ObjectId
        user_dict = collection.find_one({"_id": ObjectId(user_id)})
        if user_dict:
            return User(user_dict)
        return None
    except:
        return None

# Register blueprints
from .routes import main_bp
app.register_blueprint(main_bp)


# Create session directory if it doesn't exist
if app.config['SESSION_TYPE'] == 'filesystem':
    os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)