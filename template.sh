#!/bin/bash

# Create main project directory
mkdir -p health_mgmt_system/{app/static,app/templates,migrations,instance,tests}

# Create Python files
touch health_mgmt_system/app/{routes.py,models.py,forms.py,utils.py,__init__.py}
touch health_mgmt_system/{requirements.txt,config.py,mana.py,README.md}

touch health_mgmt_system/instance/config.py

touch health_mgmt_system/tests/test_main.py

# Initialize a virtual environment
python3 -m venv health_mgmt_system/venv

# Print completion message
echo "Flask Health Management System structure created successfully."

