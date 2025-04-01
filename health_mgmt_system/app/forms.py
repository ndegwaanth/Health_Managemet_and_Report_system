from flask_wtf import FlaskForm
from wtforms import (StringField, EmailField, PasswordField,
                     SubmitField, SelectField, SelectMultipleField,
                     FloatField, IntegerField, BooleanField)
from wtforms.validators import (EqualTo, DataRequired, Email,
                                Length, DataRequired, Optional,
                                Regexp, ValidationError)

def password_strength(form, field):
    password = field.data
    if not any(char.islower() for char in password):
        raise ValidationError("Password must contain at least one lowercase letter.")
    if not any(char.isupper() for char in password):
        raise ValidationError("Password must contain at least one uppercase letter.")
    if not any(char.isdigit() for char in password):
        raise ValidationError("Password must contain at least one digit.")
    if not any(char in "!@#$%^&*()_+-=[]{}|;:',.<>?/" for char in password):
        raise ValidationError("Password must contain at least one special character.")


class Registration(FlaskForm):
    firstname = StringField('First Name', validators=[DataRequired(), Length(min=2, max=50)])
    lastname = StringField("Last Name", validators=[DataRequired(), Length(min=2, max=50)])
    username = StringField("Username", validators=[DataRequired(), Length(min=2, max=50)])
    email = EmailField("Email", validators=[DataRequired(), Email()])
    password = PasswordField("Password", validators=[DataRequired(), Length(min=8), password_strength])
    confirm_password = PasswordField("Confirm Password", validators=[
        DataRequired(),
        EqualTo('password', message='Password must match')
    ])
    submit = SubmitField("Register")

class LoginForm(FlaskForm):
    email = EmailField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=8), password_strength])
    submit = SubmitField('Login')