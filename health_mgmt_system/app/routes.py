from flask import Blueprint, render_template, redirect, url_for, request, session, flash
from flask_bcrypt import Bcrypt
from .models import User
from .forms import Registration, LoginForm
from flask_login import LoginManager, login_user, logout_user, login_required, login_remembered, current_user
from flask_session import Session
import datetime
from . import health_metrics_collection, appointments_collection

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

@main_bp.route('/homepage')
@login_required
def homepage():
    # Fetch health metrics from MongoDB
    health_metrics = health_metrics_collection.find_one(
        {"patient_id": current_user.id},
        sort=[("date", -1)]  # Get the most recent entry
    )
    
    # Fetch recent appointments
    appointments = list(appointments_collection.find(
        {"patient_id": current_user.id},
        sort=[("date_time", -1)],
        limit=3
    ))
    
    return render_template(
        'homepage.html',
        health_metrics=health_metrics,
        appointments=appointments
    )

@main_bp.route('/health-metrics')
@login_required
def health_metrics():
    # Fetch all health metrics for the user
    metrics = list(health_metrics_collection.find(
        {"patient_id": current_user.id},
        sort=[("date", -1)]
    ))
    
    return render_template('health_metrics.html', metrics=metrics)

@main_bp.route('/add-health-metric', methods=['POST'])
@login_required
def add_health_metric():
    try:
        metric_data = {
            "patient_id": current_user.id,
            "date": datetime.strptime(request.form['date'], '%Y-%m-%d'),
            "blood_pressure": {
                "systolic": int(request.form['systolic']),
                "diastolic": int(request.form['diastolic'])
            },
            "heart_rate": int(request.form['heart_rate']),
            "blood_sugar": int(request.form['blood_sugar']),
            "weight": float(request.form['weight']),
            "notes": request.form['notes'],
            "created_at": datetime.now()
        }
        
        health_metrics_collection.insert_one(metric_data)
        flash('Health metric added successfully!', 'success')
    except Exception as e:
        flash(f'Error adding health metric: {str(e)}', 'danger')
    
    return redirect(url_for('main.health_metrics'))

@main_bp.route('/medical/records')
def medical_records():
    return render_template('medical_records.html')


@main_bp.route("/appointment")
def appointments():
    return render_template("appointments.html")


@main_bp.route("/expenses")
def expenses():
    return render_template("expenses.html")

@main_bp.route("/profile/settings")
def settings():
    return render_template("settings.html")

@main_bp.route("/finance/reports")
def reports():
    return render_template("reports.html")

@main_bp.route("/profile/view")
def profile():
    return render_template("profile.html")


@main_bp.route("/patient/info")
def patients():
    return render_template("patients.html")


@main_bp.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")



@main_bp.route('/medications')
def medications():
    return render_template("medications.html")


@main_bp.route("/appointment/new-appointment")
def new_appointment():
    return render_template("new_appointment.html")

@main_bp.route("/patient/new/record")
def add_record():
    return render_template("add_record.html")


@main_bp.route("/claim/submission")
def submit_claim():
    return render_template("claim.html")


@main_bp.route("/insuarance")
def insurance():
    return render_template("insurance.html")