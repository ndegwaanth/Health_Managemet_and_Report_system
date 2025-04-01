from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

class User(UserMixin):
    def __init__(self, user_dict):
        """Initialize user from MongoDB document."""
        self.id = str(user_dict['_id'])  # Convert ObjectId to string
        self.username = user_dict['Username']
        self.email = user_dict['Email']
        self.password_hash = user_dict['Password']
        self.profile_info = user_dict.get('profile_info', '')
    
    def set_password(self, password):
        """Hashes the password and stores it."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Checks the hashed password against the provided one."""
        return check_password_hash(self.password_hash, password)