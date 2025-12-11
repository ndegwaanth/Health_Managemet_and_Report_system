from app import app
from flask import Flask

if not hasattr(Flask, "session_cookie_name"):
    Flask.session_cookie_name = "session"


if __name__ == '__main__':
    app.run(debug=True, port=5054)
