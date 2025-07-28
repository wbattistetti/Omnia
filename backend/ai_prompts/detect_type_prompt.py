def get_detect_type_prompt(user_desc):
    EN_MEANINGS = [
        'date of birth', 'email', 'phone number', 'address', 'number', 'text', 'boolean'
    ]
    ICON_LIST = [
        'Sparkles', 'CheckSquare', 'Hash', 'Type', 'IdCard', 'Gift', 'Phone', 'Calendar', 'Mail', 'HelpCircle', 'MapPin', 'FileQuestion'
    ]
    return f"""
You are a data type classifier.

Given the following user intent (in English), extract the most specific data type from this list:
{EN_MEANINGS}

If the type is not included in the list, suggest a new one (in English).

Also, assign the most appropriate Lucide icon name from this list:
{ICON_LIST}

If no suitable icon is found, use 'HelpCircle'.

Respond ONLY with a JSON object in this format:
{{ "type": "<English label>", "icon": "<Lucide icon name>" }}

User intent: '{user_desc}'
""" 