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

@main_bp.route('/medications', methods=['GET', 'POST'])
@login_required
def medications():
    from bson import ObjectId
    from datetime import datetime
    from flask import jsonify
    from . import medications as med_collection, doctors
    
    if request.method == 'GET':
        try:
            # Get and validate parameters
            page = max(1, int(request.args.get('page', 1)))
            per_page = min(50, max(1, int(request.args.get('perPage', 10))))
            
            filters = {
                'status': request.args.get('status', ''),
                'type': request.args.get('type', ''),
                'search': request.args.get('search', '')
            }

            # Build base query
            query = {"patient_id": current_user.id}
            
            # Apply filters
            if filters['status']:
                query["status"] = filters['status']
            
            if filters['type']:
                query["type"] = filters['type']
            
            if filters['search']:
                search = filters['search'].strip()
                query["$or"] = [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"dosage": {"$regex": search, "$options": "i"}},
                    {"instructions": {"$regex": search, "$options": "i"}}
                ]

            # Get total count
            total = med_collection.count_documents(query)
            
            # Calculate pagination
            total_pages = (total + per_page - 1) // per_page if total > 0 else 1
            page = max(1, min(page, total_pages))
            skip = (page - 1) * per_page

            # Get medications with doctor info
            pipeline = [
                {"$match": query},
                {"$sort": {"start_date": -1}},
                {"$skip": skip},
                {"$limit": per_page},
                {"$lookup": {
                    "from": "doctors",
                    "localField": "prescribing_doctor",
                    "foreignField": "_id",
                    "as": "prescribing_doctor"
                }},
                {"$unwind": {"path": "$prescribing_doctor", "preserveNullAndEmptyArrays": True}}
            ]

            medications = list(med_collection.aggregate(pipeline))
            
            # Convert ObjectId and dates
            for med in medications:
                med['_id'] = str(med['_id'])
                if 'prescribing_doctor' in med and med['prescribing_doctor']:
                    med['prescribing_doctor']['_id'] = str(med['prescribing_doctor']['_id'])
                if 'start_date' in med and isinstance(med['start_date'], datetime):
                    med['start_date'] = med['start_date'].isoformat()
                if 'end_date' in med and isinstance(med['end_date'], datetime):
                    med['end_date'] = med['end_date'].isoformat()

            # Return appropriate response
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({
                    "medications": medications,
                    "total": total,
                    "page": page,
                    "per_page": per_page,
                    "total_pages": total_pages
                })
            
            # Get doctors list for the form
            doctors_list = list(doctors.find({}, {
                "_id": 1,
                "first_name": 1,
                "last_name": 1,
                "specialization": 1
            }))
            
            return render_template('medications.html', 
                                medications=medications,
                                doctors=doctors_list,
                                pagination={
                                    "page": page,
                                    "per_page": per_page,
                                    "total": total,
                                    "total_pages": total_pages
                                },
                                filters=filters)

        except Exception as e:
            current_app.logger.error(f"Error in medications: {str(e)}", exc_info=True)
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"error": str(e)}), 500
            flash("An error occurred while loading medications", "danger")
            return redirect(url_for('main.homepage'))
    
    elif request.method == 'POST':
        try:
            # Validate required fields
            required_fields = ['name', 'type', 'dosage', 'frequency', 'status', 'start_date']
            if not all(field in request.json for field in required_fields):
                return jsonify({"error": "Missing required fields"}), 400
            
            # Create medication data
            medication_data = {
                "patient_id": current_user.id,
                "name": request.json['name'],
                "type": request.json['type'],
                "dosage": request.json['dosage'],
                "frequency": request.json['frequency'],
                "status": request.json['status'],
                "start_date": datetime.strptime(request.json['start_date'], '%Y-%m-%d'),
                "end_date": datetime.strptime(request.json['end_date'], '%Y-%m-%d') if request.json.get('end_date') else None,
                "instructions": request.json.get('instructions'),
                "prescribing_doctor": ObjectId(request.json['prescribing_doctor']) if request.json.get('prescribing_doctor') else None,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }

            # Insert into MongoDB
            result = med_collection.insert_one(medication_data)
            
            # Return success response
            return jsonify({
                "success": True,
                "message": "Medication added successfully",
                "medication_id": str(result.inserted_id)
            })

        except ValueError as ve:
            return jsonify({"error": str(ve)}), 400
        except Exception as e:
            current_app.logger.error(f"Error adding medication: {str(e)}", exc_info=True)
            return jsonify({"error": str(e)}), 500


@main_bp.route("/appointment")
def appointments():
    return render_template("appointments.html")

@main_bp.route("/expenses", methods=['GET', 'POST'])
@login_required
def expenses():
    from bson import ObjectId
    from datetime import datetime
    from flask import jsonify
    from . import medical_expenses, insurance_provider
    
    try:
        if request.method == 'POST':
            # Handle POST request (adding new expense)
            if not request.is_json:
                return jsonify({"error": "Request must be JSON"}), 400
            
            data = request.get_json()
            
            # Validate required fields
            required_fields = ['date', 'category', 'amount', 'description']
            if not all(field in data for field in required_fields):
                return jsonify({
                    "error": "Missing required fields",
                    "required_fields": required_fields,
                    "received_fields": list(data.keys())
                }), 400
            
            try:
                # Prepare expense data
                expense_data = {
                    "patient_id": current_user.id,
                    "date": datetime.strptime(data['date'], '%Y-%m-%d'),
                    "category": data['category'],
                    "amount": float(data['amount']),
                    "description": data['description'],
                    "provider": data.get('provider', ''),
                    "status": data.get('status', 'pending'),
                    "insurance_provider_id": ObjectId(data['insurance_provider_id']) if data.get('insurance_provider_id') else None,
                    "claim_submitted": data.get('claim_submitted', False),
                    "reimbursement_amount": float(data.get('reimbursement_amount', 0)),
                    "notes": data.get('notes', ''),
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                }
                
                # Insert into MongoDB
                result = medical_expenses.insert_one(expense_data)
                
                return jsonify({
                    "success": True,
                    "message": "Expense added successfully",
                    "expense_id": str(result.inserted_id)
                }), 201
                
            except ValueError as e:
                return jsonify({"error": f"Invalid data format: {str(e)}"}), 400
            except Exception as e:
                return jsonify({"error": f"Data processing error: {str(e)}"}), 400

        else:
            # Handle GET request (displaying expenses)
            # Get and validate parameters
            page = max(1, int(request.args.get('page', 1)))
            per_page = min(50, max(1, int(request.args.get('perPage', 10))))
            
            filters = {
                'category': request.args.get('category', ''),
                'date_from': request.args.get('date_from', ''),
                'date_to': request.args.get('date_to', ''),
                'search': request.args.get('search', ''),
                'sort': request.args.get('sort', 'date-desc'),
                'status': request.args.get('status', '')
            }

            # Build base query
            query = {"patient_id": current_user.id}
            
            # Apply filters
            if filters['category']:
                query["category"] = filters['category']
            
            if filters['status']:
                query["status"] = filters['status']
            
            if filters['date_from'] and filters['date_to']:
                try:
                    date_from = datetime.strptime(filters['date_from'], '%Y-%m-%d')
                    date_to = datetime.strptime(filters['date_to'], '%Y-%m-%d')
                    query["date"] = {"$gte": date_from, "$lte": date_to}
                except ValueError:
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return jsonify({"error": "Invalid date format"}), 400
                    flash("Invalid date format", "danger")
            
            if filters['search']:
                search = filters['search'].strip()
                query["$or"] = [
                    {"description": {"$regex": search, "$options": "i"}},
                    {"provider": {"$regex": search, "$options": "i"}}
                ]

            # Sorting
            sort_mapping = {
                'date-desc': [("date", -1)],
                'date-asc': [("date", 1)],
                'amount-desc': [("amount", -1)],
                'amount-asc': [("amount", 1)]
            }
            sort = sort_mapping.get(filters['sort'], [("date", -1)])

            # Get total count
            total = medical_expenses.count_documents(query)
            
            # Calculate pagination
            total_pages = (total + per_page - 1) // per_page if total > 0 else 1
            page = max(1, min(page, total_pages))
            skip = (page - 1) * per_page

            # Get expenses with insurance info
            pipeline = [
                {"$match": query},
                {"$sort": dict(sort)},
                {"$skip": skip},
                {"$limit": per_page},
                {"$lookup": {
                    "from": "insurance-provide",
                    "localField": "insurance_provider_id",
                    "foreignField": "_id",
                    "as": "insurance_provider"
                }},
                {"$unwind": {"path": "$insurance_provider", "preserveNullAndEmptyArrays": True}}
            ]

            expenses = list(medical_expenses.aggregate(pipeline))
            
            # Convert ObjectId and dates
            for expense in expenses:
                expense['_id'] = str(expense['_id'])
                if 'insurance_provider' in expense and expense['insurance_provider']:
                    expense['insurance_provider']['_id'] = str(expense['insurance_provider']['_id'])
                if 'date' in expense and isinstance(expense['date'], datetime):
                    expense['date'] = expense['date'].strftime('%Y-%m-%d')
                if 'created_at' in expense and isinstance(expense['created_at'], datetime):
                    expense['created_at'] = expense['created_at'].isoformat()

            # Return appropriate response
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({
                    "expenses": expenses,
                    "total": total,
                    "page": page,
                    "per_page": per_page,
                    "total_pages": total_pages,
                    "filters": filters
                })
            
            # Get insurance providers for the form
            insurance_providers = list(insurance_provider.find({}, {
                "_id": 1,
                "name": 1,
                "plan_name": 1
            }))
            
            return render_template('expenses.html', 
                                expenses=expenses,
                                insurance_providers=insurance_providers,
                                pagination={
                                    "page": page,
                                    "per_page": per_page,
                                    "total": total,
                                    "total_pages": total_pages
                                },
                                filters=filters)

    except Exception as e:
        current_app.logger.error(f"Error in expenses route: {str(e)}", exc_info=True)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({"error": "Server error processing request"}), 500
        flash("An error occurred while processing your request", "danger")
        return redirect(url_for('main.homepage'))

@main_bp.route('/expenses/export')
@login_required
def export_expenses():
    from bson import ObjectId
    from datetime import datetime
    from flask import send_file
    from io import BytesIO
    import pandas as pd
    from . import medical_expenses
    
    try:
        # Get filters from query parameters
        filters = {
            'category': request.args.get('category', ''),
            'status': request.args.get('status', ''),
            'date_from': request.args.get('date_from', ''),
            'date_to': request.args.get('date_to', ''),
            'search': request.args.get('search', ''),
            'format': request.args.get('format', 'csv')
        }

        # Build query
        query = {"patient_id": current_user.id}
        
        if filters['category']:
            query["category"] = filters['category']
        
        if filters['status']:
            query["status"] = filters['status']
        
        if filters['date_from'] and filters['date_to']:
            try:
                date_from = datetime.strptime(filters['date_from'], '%Y-%m-%d')
                date_to = datetime.strptime(filters['date_to'], '%Y-%m-%d')
                query["date"] = {"$gte": date_from, "$lte": date_to}
            except ValueError:
                return jsonify({"error": "Invalid date format"}), 400
        
        if filters['search']:
            search = filters['search'].strip()
            query["$or"] = [
                {"description": {"$regex": search, "$options": "i"}},
                {"provider": {"$regex": search, "$options": "i"}}
            ]

        # Get all matching expenses
        expenses = list(medical_expenses.find(query))
        
        if not expenses:
            return jsonify({"error": "No expenses found matching your criteria"}), 404
        
        # Convert to DataFrame
        df = pd.DataFrame(expenses)
        
        # Clean up data
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        df['amount'] = df['amount'].apply(lambda x: f"${x:.2f}")
        df['reimbursement_amount'] = df['reimbursement_amount'].apply(lambda x: f"${x:.2f}" if pd.notnull(x) else '')
        df['insurance_provider'] = df['insurance_provider_id'].apply(lambda x: "None" if pd.isnull(x) else "Yes")
        
        # Select and rename columns
        df = df[[
            'date', 'category', 'description', 'provider', 
            'amount', 'status', 'insurance_provider', 
            'reimbursement_amount', 'notes'
        ]]
        
        df.columns = [
            'Date', 'Category', 'Description', 'Provider',
            'Amount', 'Status', 'Insurance Provider',
            'Reimbursement Amount', 'Notes'
        ]
        
        # Handle different export formats
        if filters['format'] == 'csv':
            output = BytesIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return send_file(
                output,
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'medical_expenses_{datetime.now().strftime("%Y%m%d")}.csv'
            )
        elif filters['format'] == 'excel':
            output = BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, index=False, sheet_name='Expenses')
                writer.book.close()
            output.seek(0)
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=f'medical_expenses_{datetime.now().strftime("%Y%m%d")}.xlsx'
            )
        elif filters['format'] == 'pdf':
            # PDF export would require additional libraries like reportlab
            # For simplicity, we'll just return a CSV in this example
            output = BytesIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return send_file(
                output,
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'medical_expenses_{datetime.now().strftime("%Y%m%d")}.csv'
            )
        else:
            return jsonify({"error": "Invalid export format"}), 400
    
    except Exception as e:
        current_app.logger.error(f"Error exporting expenses: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@main_bp.route("/finance/reports")
@login_required
def reports():
    from datetime import datetime
    from . import medical_expenses
    
    try:
        # Get basic report data
        total_expenses = medical_expenses.aggregate([
            {"$match": {"patient_id": current_user.id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).next().get('total', 0)
        
        # Get expenses by category
        expenses_by_category = list(medical_expenses.aggregate([
            {"$match": {"patient_id": current_user.id}},
            {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
            {"$sort": {"total": -1}}
        ]))
        
        # Get monthly trends
        monthly_trends = list(medical_expenses.aggregate([
            {"$match": {"patient_id": current_user.id}},
            {"$project": {
                "year": {"$year": "$date"},
                "month": {"$month": "$date"},
                "amount": 1
            }},
            {"$group": {
                "_id": {"year": "$year", "month": "$month"},
                "total": {"$sum": "$amount"}
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1}},
            {"$limit": 12}
        ]))
        
        # Get insurance coverage
        insurance_coverage = list(medical_expenses.aggregate([
            {"$match": {"patient_id": current_user.id, "insurance_provider_id": {"$exists": True}}},
            {"$group": {
                "_id": "$insurance_provider_id",
                "total_claims": {"$sum": 1},
                "total_amount": {"$sum": "$amount"},
                "total_reimbursed": {"$sum": "$reimbursement_amount"}
            }}
        ]))
        
        return render_template("reports.html",
                            total_expenses=total_expenses,
                            expenses_by_category=expenses_by_category,
                            monthly_trends=monthly_trends,
                            insurance_coverage=insurance_coverage,
                            has_data=total_expenses > 0)
        
    except StopIteration:  # No data in database
        return render_template("reports.html", has_data=False)
    except Exception as e:
        current_app.logger.error(f"Error generating reports: {str(e)}", exc_info=True)
        flash("An error occurred while generating reports", "danger")
        return render_template("reports.html", has_data=False)


@main_bp.route("/profile/settings")
def settings():
    return render_template("settings.html")


@main_bp.route("/profile/view")
def profile():
    return render_template("profile.html")


@main_bp.route("/patient/info")
def patients():
    return render_template("patients.html")


@main_bp.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


@main_bp.route("/appointment/new-appointment")
def new_appointment():
    return render_template("new_appointment.html")


@main_bp.route("/claim/submission")
def submit_claim():
    return render_template("claim.html")


@main_bp.route("/insuarance")
def insurance():
    return render_template("insurance.html")