from flask import Blueprint, render_template, redirect, url_for, request, session, flash
from flask_bcrypt import Bcrypt
from .models import User
from .forms import Registration, LoginForm
from flask_login import LoginManager, login_user, logout_user, login_required, login_remembered, current_user
from flask_session import Session
import datetime
from . import health_metrics_collection, appointments_collection
from flask import jsonify
import os
from datetime import datetime
from flask import current_app
from werkzeug.utils import secure_filename


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

from bson import ObjectId

# Configure allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@main_bp.route("/patient/new/record", methods=['GET', 'POST'])
@login_required
def add_record():
    from . import medical_record_info, doctors, pat_notification
    if request.method == 'POST':
        try:
            # Validate required fields
            if not all(k in request.form for k in ['record_type', 'title', 'description', 'record_date']):
                raise ValueError("Missing required fields")
            
            # Create record data structure
            record_data = {
                "patient_id": current_user.id,
                "record_type": request.form['record_type'],
                "title": request.form['title'],
                "description": request.form['description'],
                "date": datetime.strptime(request.form['record_date'], '%Y-%m-%d'),
                "doctor_id": ObjectId(request.form['doctor_id']) if request.form.get('doctor_id') else None,
                "facility": request.form.get('facility', '').strip(),
                "status": request.form.get('status', 'active'),
                "priority": request.form.get('priority', 'normal'),
                "notes": request.form.get('notes', '').strip(),
                "share_with_doctor": 'share_with_doctor' in request.form,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "attachments": []
            }

            # Process file uploads
            if 'files' in request.files:
                files = request.files.getlist('files')
                for file in files:
                    if file.filename == '':
                        continue
                        
                    if file and allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        # Create patient-specific upload directory
                        upload_dir = os.path.join(
                            current_app.root_path,
                            'static/uploads',
                            str(current_user.id)
                            )
                        os.makedirs(upload_dir, exist_ok=True)
                        
                        # Save file with timestamp prefix to avoid collisions
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        unique_filename = f"{timestamp}_{filename}"
                        filepath = os.path.join(upload_dir, unique_filename)
                        file.save(filepath)
                        
                        record_data['attachments'].append({
                            "original_name": filename,
                            "stored_name": unique_filename,
                            "filepath": f"uploads/{current_user.id}/{unique_filename}",
                            "content_type": file.content_type,
                            "size": os.path.getsize(filepath),
                            "uploaded_at": datetime.now()
                        })

            # Insert into MongoDB
            result = medical_record_info.insert_one(record_data)
            
            # Create notification for patient
            pat_notification.insert_one({
                "user_id": current_user.id,
                "type": "record_added",
                "message": f"New {record_data['record_type']} record added: {record_data['title']}",
                "related_record": result.inserted_id,
                "is_read": False,
                "created_at": datetime.now()
            })
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({
                    "success": True,
                    "redirect": url_for('main.medical_records'),
                    "message": "Record added successfully!"
                })
            
            flash('Medical record added successfully!', 'success')
            return redirect(url_for('main.medical_records'))
            
        except ValueError as ve:
            error_msg = str(ve)
        except Exception as e:
            error_msg = f"Error adding record: {str(e)}"
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({
                "success": False,
                "message": error_msg
            }), 400
        
        flash(error_msg, 'danger')
        return redirect(request.url)

    # GET request - fetch doctors list and render form
    doctors_list = list(doctors.find({}, {
        "_id": 1,
        "first_name": 1,
        "last_name": 1,
        "specialization": 1
    }))
    
    return render_template("add_record.html", 
                         doctors=doctors_list,
                         max_file_size=current_app.config['MAX_CONTENT_LENGTH'])

from flask import request, render_template, redirect, url_for, flash
from flask_login import login_required, current_user
from bson.objectid import ObjectId
from datetime import datetime
from werkzeug.datastructures import ImmutableMultiDict


def generate_pagination_links(page, total_records, per_page, left_edge=2, left_current=2, right_current=5, right_edge=2):
    total_pages = (total_records + per_page - 1) // per_page
    pages = []
    
    # Left edge
    pages.extend(range(1, min(left_edge, total_pages) + 1))
    
    # Left ellipsis
    if page - left_current - left_edge > 1:
        pages.append('...')
    
    # Current range
    pages.extend(range(max(left_edge + 1, page - left_current), 
                min(page + right_current, total_pages - right_edge) + 1))
    
    # Right ellipsis
    if page + right_current + right_edge < total_pages:
        pages.append('...')
    
    # Right edge
    pages.extend(range(max(total_pages - right_edge + 1, page + right_current + 1), 
                total_pages + 1))
    
    return pages

@main_bp.route('/medical/records')
@login_required
def medical_records():
    from bson import ObjectId
    from datetime import datetime
    from flask import jsonify
    from . import medical_record_info, doctors  # Import collections directly
    
    try:
        current_app.logger.info(f"Medical records request from user {current_user.id}")
        
        # Get and validate parameters
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(50, max(1, int(request.args.get('perPage', 10))))  # Limit to 50 max
        
        filters = {
            'record_type': request.args.get('record_type', ''),
            'status': request.args.get('status', ''),
            'date_from': request.args.get('date_from', ''),
            'date_to': request.args.get('date_to', ''),
            'search': request.args.get('search', ''),
            'sort': request.args.get('sort', 'date-desc')
        }

        # Build base query - ensure we only get records for current user
        query = {"patient_id": current_user.id}
        
        # Apply filters
        if filters['record_type']:
            query["record_type"] = filters['record_type']
        
        if filters['status']:
            query["status"] = filters['status']
        
        if filters['date_from'] and filters['date_to']:
            try:
                date_from = datetime.strptime(filters['date_from'], '%Y-%m-%d')
                date_to = datetime.strptime(filters['date_to'], '%Y-%m-%d')
                query["date"] = {"$gte": date_from, "$lte": date_to}
            except ValueError:
                current_app.logger.warning("Invalid date format received")
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"error": "Invalid date format"}), 400
                flash("Invalid date format", "danger")
        
        if filters['search']:
            search = filters['search'].strip()
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]

        # Sorting
        sort_mapping = {
            'date-desc': [("date", -1)],
            'date-asc': [("date", 1)],
            'title-asc': [("title", 1)],
            'title-desc': [("title", -1)]
        }
        sort = sort_mapping.get(filters['sort'], [("date", -1)])

        # Get total count for pagination
        total = medical_record_info.count_documents(query)
        total_pages = (total + per_page - 1) // per_page if total > 0 else 1
        page = max(1, min(page, total_pages))  # Ensure page is within bounds

        # Aggregation pipeline
        pipeline = [
            {"$match": query},
            {"$sort": dict(sort)},
            {"$skip": (page - 1) * per_page},
            {"$limit": per_page},
            {"$lookup": {
                "from": "doctors",
                "localField": "doctor_id",
                "foreignField": "_id",
                "as": "doctor_info"
            }},
            {"$unwind": {"path": "$doctor_info", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "doctor_name": {
                    "$cond": [
                        {"$eq": ["$doctor_info", None]},
                        "Not specified",
                        {"$concat": [
                            "Dr. ",
                            "$doctor_info.last_name",
                            ", ",
                            "$doctor_info.specialization"
                        ]}
                    ]
                }
            }}
        ]

        # Execute query
        records = list(medical_record_info.aggregate(pipeline))
        
        # Prepare data for response
        for record in records:
            record['_id'] = str(record['_id'])
            if 'doctor_info' in record and record['doctor_info']:
                record['doctor_info']['_id'] = str(record['doctor_info']['_id'])
            if 'date' in record and isinstance(record['date'], datetime):
                record['date'] = record['date'].isoformat()
            if 'created_at' in record and isinstance(record['created_at'], datetime):
                record['created_at'] = record['created_at'].isoformat()
            if 'updated_at' in record and isinstance(record['updated_at'], datetime):
                record['updated_at'] = record['updated_at'].isoformat()

        # Build response
        response_data = {
            "records": records,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": total_pages
            },
            "filters": filters
        }

        # Return appropriate response format
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify(response_data)
        
        return render_template('medical_records.html',
                            records=records,
                            pagination=response_data['pagination'],
                            filters=filters)

    except Exception as e:
        current_app.logger.error(f"Error in medical_records: {str(e)}", exc_info=True)
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({"error": "An error occurred loading records"}), 500
        
        flash("An error occurred while loading medical records", "danger")
        return redirect(url_for('main.homepage'))


@main_bp.route('/medical/records/<record_id>')
@login_required
def view_record(record_id):
    from . import medical_record_info
    try:
        from bson.objectid import ObjectId
        
        # Get record with doctor information
        record = medical_record_info.aggregate([
            {"$match": {"_id": ObjectId(record_id), "patient_id": current_user.id}},
            {"$lookup": {
                "from": "doctors",
                "localField": "doctor_id",
                "foreignField": "_id",
                "as": "doctor_id"
            }},
            {"$unwind": {"path": "$doctor_id", "preserveNullAndEmptyArrays": True}}
        ]).next()

        return render_template('view_record.html', record=record)

    except Exception as e:
        current_app.logger.error(f"Error viewing record {record_id}: {str(e)}")
        flash("Record not found or you don't have permission to view it", "danger")
        return redirect(url_for('main.medical_records'))


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


@main_bp.route("/claim/submission")
def submit_claim():
    return render_template("claim.html")


@main_bp.route("/insuarance")
def insurance():
    return render_template("insurance.html")