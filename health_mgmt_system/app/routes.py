from flask import Blueprint, render_template, redirect, url_for, request, session, flash
from flask_bcrypt import Bcrypt
from .models import User
from .forms import Registration, LoginForm
from flask_login import LoginManager, login_user, logout_user, login_required, login_remembered, current_user
from flask_session import Session


main_bp = Blueprint('main', __name__)

bcrypt = Bcrypt()


@main_bp.route('/')
def landing_page():
    return render_template('index.html')


@main_bp.route('/logout')
@login_required
def logout():
    session.clear()
    logout_user()
    flash("You have been logged out successfully.")
    return redirect(url_for('main.login'))

@main_bp.route('/homepage')
def homepage():
    return render_template('homepage.html')


@main_bp.route("/signup", methods=["POST", "GET"])
def register():
    from . import collection
    form = Registration()
    if form.validate_on_submit() and request.method == 'POST':
        # Collect form data
        firstname = form.firstname.data
        lastname = form.lastname.data
        username_reg = form.username.data
        email_reg = form.email.data
        password_reg = form.password.data
        confirm_password = form.confirm_password.data

        # Check if passwords match
        if password_reg != confirm_password:
            return render_template("register.html", form=form, error="Passwords do not match")

        # Hash the password
        password_hash = bcrypt.generate_password_hash(password_reg).decode('utf-8')

        try:
            # Check if the email or username already exists
            if collection.find_one({"Email": email_reg}) or collection.find_one({"Username": username_reg}):
                return render_template("register.html", form=form, error="Email or username already taken")

            # Insert the new user into MongoDB
            user_data = {
                "FirstName": firstname,
                "LastName": lastname,
                "Username": username_reg,
                "Email": email_reg,
                "Password": password_hash
            }
            collection.insert_one(user_data)

            print("Connection Successful")

            # Automatically log in the user after registration
            user_dict = collection.find_one({"Email": email_reg})
            user = User(user_dict)
            login_user(user)

            flash(f"Welcome, {current_user.username}!", "success")
            return redirect(url_for("main.homepage"))
        except Exception as e:
            return render_template("register.html", form=form, error="Database error: " + str(e))
    print("Connection failled")
    return render_template("register.html", form=form)



@main_bp.route('/login', methods=['POST', 'GET'])
def login():
    from . import collection

    if current_user.is_authenticated:
        return redirect(url_for('main.homepage'))

    form = LoginForm()
    if form.validate_on_submit():
        user_dict = collection.find_one({"Email": form.email.data})
        if user_dict and bcrypt.check_password_hash(user_dict["Password"], form.password.data):
            user = User(user_dict)
            login_user(user, remember=True)  # Add remember=True
            
            # Set session variables
            session['user_id'] = str(user_dict['_id'])
            session['logged_in'] = True
            session.permanent = True  # Make session persistent
            session.modified = True   # Mark session as modified
            
            flash('Login successful!', 'success')
            return redirect(url_for('main.homepage'))
    
    return render_template('login.html', form=form)



