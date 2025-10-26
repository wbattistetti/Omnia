// migrate_new_templates.js - Migrazione nuovi template gerarchici
const { MongoClient } = require('mongodb');

// Connection string MongoDB
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

// Nuovi template gerarchici puliti
const newTemplates = {
  // ATOMIC TEMPLATES
  "email": {
    "id": "email",
    "name": "email",
    "label": "Email Address",
    "type": "atomic",
    "icon": "Mail",
    "description": "Captures a valid email address with domain and format validation",
    "category": "contact",
    "subData": [],
    "constraints": [
      {
        "type": "required",
        "value": true,
        "message": "Email is required"
      },
      {
        "type": "pattern",
        "value": "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$",
        "message": "Invalid email format"
      },
      {
        "type": "minLength",
        "value": 6,
        "message": "Email must be at least 6 characters"
      },
      {
        "type": "maxLength",
        "value": 254,
        "message": "Email must be less than 254 characters"
      }
    ],
    "validation": {
      "type": "email",
      "pattern": "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$",
      "customFunction": "validateEmailRFC5322"
    },
    "frontendValidation": {
      "onChange": "validateEmailRFC5322",
      "onBlur": "validateEmailFormat",
      "realTime": true,
      "debounce": 300
    },
    "testValues": {
      "valid": [
        "john.doe@example.com",
        "user+alias@sub.domain.co.uk",
        "name.lastname@domain.it"
      ],
      "invalid": [
        "plainaddress",
        "@missinglocal.org",
        "user@.com"
      ],
      "edgeCases": [
        "a@b.co",
        "very.common@example.com",
        "user@[192.168.1.1]"
      ]
    },
    "metadata": {
      "translationKey": "email_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["contact", "required", "email"]
    }
  },

  "phone": {
    "id": "phone",
    "name": "phone",
    "label": "Phone Number",
    "type": "atomic",
    "icon": "Phone",
    "description": "International phone number with country code",
    "category": "contact",
    "subData": [],
    "constraints": [
      {
        "type": "required",
        "value": true,
        "message": "Phone number is required"
      },
      {
        "type": "pattern",
        "value": "^\\+(?:[1-9]\\d{0,2})[-\\s]?(?:\\d{6,14})$",
        "message": "Invalid phone number format"
      }
    ],
    "validation": {
      "type": "phone",
      "format": "+XX-XXXXXXXXX",
      "customFunction": "validateInternationalPhone"
    },
    "frontendValidation": {
      "onChange": "validateInternationalPhone",
      "onBlur": "validatePhoneFormat",
      "realTime": true,
      "debounce": 300
    },
    "testValues": {
      "valid": [
        "+39 3456789012",
        "+1-2025550123",
        "+44 7911123456"
      ],
      "invalid": [
        "123456",
        "+999999999999999999",
        "+44-ABC-123456"
      ],
      "edgeCases": [
        "+1 1234567",
        "+999 9999999999999"
      ]
    },
    "metadata": {
      "translationKey": "phone_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["contact", "phone", "required"]
    }
  },

  "singleName": {
    "id": "singleName",
    "name": "singleName",
    "label": "First or Last Name",
    "type": "atomic",
    "icon": "User",
    "description": "Single name field for first or last name",
    "category": "personal",
    "subData": [],
    "constraints": [
      {
        "type": "required",
        "value": true,
        "message": "Name is required"
      },
      {
        "type": "pattern",
        "value": "^[A-Za-zÀ-ÿ'\\-\\s]{2,50}$",
        "message": "Name must be 2-50 letters"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateNameCharacters"
    },
    "frontendValidation": {
      "onChange": "validateNameCharacters",
      "onBlur": "validateNameFormat",
      "realTime": true,
      "debounce": 300
    },
    "testValues": {
      "valid": [
        "Giulia",
        "O'Connor",
        "Jean-Luc"
      ],
      "invalid": [
        "A",
        "1234",
        "John@"
      ],
      "edgeCases": [
        "Élodie",
        "Al"
      ]
    },
    "metadata": {
      "translationKey": "singleName_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["personal", "name", "required"]
    }
  },

  "postalCode": {
    "id": "postalCode",
    "name": "postalCode",
    "label": "Postal Code",
    "type": "atomic",
    "icon": "MapPin",
    "description": "Postal or ZIP code validation by country",
    "category": "contact",
    "subData": [],
    "constraints": [
      {
        "type": "required",
        "value": true,
        "message": "Postal code is required"
      },
      {
        "type": "pattern",
        "value": "^(\\d{5}|[A-Z]\\d[A-Z] \\d[A-Z]\\d)$",
        "message": "Invalid postal code format"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validatePostalCodeByCountry"
    },
    "frontendValidation": {
      "onChange": "validatePostalCodeByCountry",
      "onBlur": "validatePostalFormat",
      "realTime": true,
      "debounce": 300
    },
    "testValues": {
      "valid": [
        "00144",
        "75008",
        "V6E 1B5"
      ],
      "invalid": [
        "ABCDE",
        "123",
        "999999"
      ],
      "edgeCases": [
        "00000",
        "H0H 0H0"
      ]
    },
    "metadata": {
      "translationKey": "postalCode_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["contact", "postal", "required"]
    }
  },

  "taxCode": {
    "id": "taxCode",
    "name": "taxCode",
    "label": "Codice Fiscale",
    "type": "atomic",
    "icon": "Fingerprint",
    "description": "Italian fiscal code validation",
    "category": "identification",
    "subData": [],
    "constraints": [
      {
        "type": "required",
        "value": true,
        "message": "Tax code is required"
      },
      {
        "type": "pattern",
        "value": "^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$",
        "message": "Invalid tax code format"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateItalianTaxCode"
    },
    "frontendValidation": {
      "onChange": "validateItalianTaxCode",
      "onBlur": "validateTaxCodeFormat",
      "realTime": true,
      "debounce": 300
    },
    "testValues": {
      "valid": [
        "RSSMRA85M01H501Z",
        "VRDLNZ78A01F205X"
      ],
      "invalid": [
        "1234567890123456",
        "ABCDEFGH1234567",
        "RSSMRA85M01H501"
      ],
      "edgeCases": [
        "AAAAAA00A00A000A"
      ]
    },
    "metadata": {
      "translationKey": "taxCode_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["identification", "tax", "required"]
    }
  },

  "iban": {
    "id": "iban",
    "name": "iban",
    "label": "IBAN",
    "type": "atomic",
    "icon": "Banknote",
    "description": "International Bank Account Number",
    "category": "financial",
    "subData": [],
    "constraints": [
      {
        "type": "required",
        "value": true,
        "message": "IBAN is required"
      },
      {
        "type": "pattern",
        "value": "^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$",
        "message": "Invalid IBAN format"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateIBANChecksum"
    },
    "frontendValidation": {
      "onChange": "validateIBANChecksum",
      "onBlur": "validateIBANFormat",
      "realTime": true,
      "debounce": 300
    },
    "testValues": {
      "valid": [
        "IT60X0542811101000000123456",
        "DE89370400440532013000"
      ],
      "invalid": [
        "1234567890",
        "IT60X05428111010000001234",
        "DE89-3704-0044-0532-013000"
      ],
      "edgeCases": [
        "FR7630006000011234567890189"
      ]
    },
    "metadata": {
      "translationKey": "iban_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["financial", "iban", "required"]
    }
  },

  "vatNumber": {
    "id": "vatNumber",
    "name": "vatNumber",
    "label": "VAT Number",
    "type": "atomic",
    "icon": "Receipt",
    "description": "European VAT identification number",
    "category": "financial",
    "subData": [],
    "constraints": [
      {
        "type": "required",
        "value": true,
        "message": "VAT number is required"
      },
      {
        "type": "pattern",
        "value": "^[A-Z]{2}[0-9A-Z]{8,12}$",
        "message": "Invalid VAT number format"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateVATStructure"
    },
    "frontendValidation": {
      "onChange": "validateVATStructure",
      "onBlur": "validateVATFormat",
      "realTime": true,
      "debounce": 300
    },
    "testValues": {
      "valid": [
        "IT12345678901",
        "DE123456789"
      ],
      "invalid": [
        "1234567890",
        "ITABCDEFGHIJK",
        "FR12"
      ],
      "edgeCases": [
        "ESX1234567X"
      ]
    },
    "metadata": {
      "translationKey": "vatNumber_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["financial", "vat", "required"]
    }
  },

  "number": {
    "id": "number",
    "name": "number",
    "label": "Numeric Value",
    "type": "atomic",
    "icon": "Hash",
    "description": "Generic numeric input for age, quantity, etc.",
    "category": "other",
    "subData": [],
    "constraints": [
      {
        "type": "required",
        "value": true,
        "message": "Number is required"
      },
      {
        "type": "integer",
        "value": true,
        "message": "Must be an integer"
      },
      {
        "type": "min",
        "value": 0,
        "message": "Minimum value is 0"
      },
      {
        "type": "max",
        "value": 9999,
        "message": "Maximum value is 9999"
      }
    ],
    "validation": {
      "type": "integer",
      "range": [0, 9999],
      "customFunction": "validateNumericRange"
    },
    "frontendValidation": {
      "onChange": "validateNumericRange",
      "onBlur": "validateNumberFormat",
      "realTime": true,
      "debounce": 300
    },
    "testValues": {
      "valid": [
        "0",
        "25",
        "100",
        "9999"
      ],
      "invalid": [
        "-1",
        "10000",
        "abc",
        "12.5"
      ],
      "edgeCases": [
        "0",
        "9999"
      ]
    },
    "metadata": {
      "translationKey": "number_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["numeric", "generic", "required"]
    }
  },

  // MOLECULAR TEMPLATES
  "name": {
    "id": "name",
    "name": "name",
    "label": "Full Name",
    "type": "molecular",
    "icon": "User",
    "description": "Captures full name composed of first and last name",
    "category": "personal",
    "subData": [
      {
        "label": "First Name",
        "type": "text",
        "icon": "User",
        "required": true,
        "templateRef": "singleName",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Last Name",
        "type": "text",
        "icon": "User",
        "required": true,
        "templateRef": "singleName",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateFullNameCharacters",
        "message": "Name must contain only valid characters"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateFullNameCharacters"
    },
    "testValues": {
      "valid": [
        { "firstName": "Anna", "lastName": "Rossi" },
        { "firstName": "Jean-Luc", "lastName": "Picard" }
      ],
      "invalid": [
        { "firstName": "123", "lastName": "Rossi" },
        { "firstName": "Anna", "lastName": "" }
      ],
      "edgeCases": [
        { "firstName": "É", "lastName": "Li" }
      ]
    },
    "metadata": {
      "translationKey": "name_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["molecular", "composite", "required"]
    }
  },

  "date": {
    "id": "date",
    "name": "date",
    "label": "Date of Birth",
    "type": "molecular",
    "icon": "Calendar",
    "description": "Captures a valid date of birth with leap year logic",
    "category": "personal",
    "subData": [
      {
        "label": "Day",
        "type": "number",
        "icon": "Calendar",
        "required": true,
        "templateRef": "number",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Month",
        "type": "number",
        "icon": "Calendar",
        "required": true,
        "templateRef": "number",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Year",
        "type": "number",
        "icon": "Calendar",
        "required": true,
        "templateRef": "number",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateDateConsistency",
        "message": "Invalid date combination"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateDateConsistency"
    },
    "testValues": {
      "valid": [
        { "day": 15, "month": 6, "year": 1990 },
        { "day": 29, "month": 2, "year": 2020 }
      ],
      "invalid": [
        { "day": 31, "month": 2, "year": 2021 },
        { "day": 0, "month": 12, "year": 2000 }
      ],
      "edgeCases": [
        { "day": 29, "month": 2, "year": 1900 }
      ]
    },
    "metadata": {
      "translationKey": "date_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["molecular", "composite", "required"]
    }
  },

  "address": {
    "id": "address",
    "name": "address",
    "label": "Full Address",
    "type": "molecular",
    "icon": "MapPin",
    "description": "Captures complete address including postal code and country",
    "category": "contact",
    "subData": [
      {
        "label": "Street",
        "type": "text",
        "icon": "MapPin",
        "required": true,
        "templateRef": "text",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "City",
        "type": "text",
        "icon": "MapPin",
        "required": true,
        "templateRef": "singleName",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Postal Code",
        "type": "text",
        "icon": "MapPin",
        "required": true,
        "templateRef": "postalCode",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Country",
        "type": "text",
        "icon": "Globe",
        "required": true,
        "templateRef": "singleName",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateAddressFormat",
        "message": "Invalid address format"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateAddressFormat"
    },
    "testValues": {
      "valid": [
        {
          "street": "Via Roma 12",
          "city": "Milano",
          "postalCode": "20121",
          "country": "Italy"
        }
      ],
      "invalid": [
        {
          "street": "",
          "city": "123",
          "postalCode": "ABCDE",
          "country": ""
        }
      ],
      "edgeCases": [
        {
          "street": "A",
          "city": "Li",
          "postalCode": "00000",
          "country": "ZZ"
        }
      ]
    },
    "metadata": {
      "translationKey": "address_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["molecular", "composite", "required"]
    }
  },

  "phoneComplete": {
    "id": "phoneComplete",
    "name": "phoneComplete",
    "label": "Complete Phone Number",
    "type": "molecular",
    "icon": "Phone",
    "description": "Captures full international phone number with country code and number",
    "category": "contact",
    "subData": [
      {
        "label": "Country Code",
        "type": "text",
        "icon": "Flag",
        "required": true,
        "templateRef": "phone",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Phone Number",
        "type": "text",
        "icon": "Phone",
        "required": true,
        "templateRef": "phone",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validatePhoneCompleteFormat",
        "message": "Invalid phone number format"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validatePhoneCompleteFormat"
    },
    "testValues": {
      "valid": [
        { "countryCode": "+39", "phoneNumber": "3456789012" },
        { "countryCode": "+1", "phoneNumber": "2025550123" }
      ],
      "invalid": [
        { "countryCode": "+999", "phoneNumber": "123" },
        { "countryCode": "", "phoneNumber": "3456789012" }
      ],
      "edgeCases": [
        { "countryCode": "+1", "phoneNumber": "1234567" }
      ]
    },
    "metadata": {
      "translationKey": "phoneComplete_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["molecular", "composite", "required"]
    }
  },

  "personalInfo": {
    "id": "personalInfo",
    "name": "personalInfo",
    "label": "Personal Information",
    "type": "molecular",
    "icon": "UserCircle",
    "description": "Captures basic personal data including full name and date of birth",
    "category": "personal",
    "subData": [
      {
        "label": "Full Name",
        "type": "text",
        "icon": "User",
        "required": true,
        "templateRef": "name",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Date of Birth",
        "type": "date",
        "icon": "Calendar",
        "required": true,
        "templateRef": "date",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateAgeRange",
        "message": "Age must be between 0 and 120"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateAgeRange"
    },
    "testValues": {
      "valid": [
        {
          "fullName": { "firstName": "Luca", "lastName": "Bianchi" },
          "dateOfBirth": { "day": 12, "month": 5, "year": 1985 }
        }
      ],
      "invalid": [
        {
          "fullName": { "firstName": "", "lastName": "Bianchi" },
          "dateOfBirth": { "day": 31, "month": 2, "year": 2021 }
        }
      ],
      "edgeCases": [
        {
          "fullName": { "firstName": "A", "lastName": "Z" },
          "dateOfBirth": { "day": 29, "month": 2, "year": 1900 }
        }
      ]
    },
    "metadata": {
      "translationKey": "personalInfo_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["molecular", "composite", "required"]
    }
  },

  "contactInfo": {
    "id": "contactInfo",
    "name": "contactInfo",
    "label": "Contact Information",
    "type": "molecular",
    "icon": "Contact",
    "description": "Captures user's contact details including email and phone",
    "category": "contact",
    "subData": [
      {
        "label": "Email",
        "type": "text",
        "icon": "Mail",
        "required": false,
        "templateRef": "email",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Phone",
        "type": "text",
        "icon": "Phone",
        "required": false,
        "templateRef": "phone",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateAtLeastOneContact",
        "message": "At least one contact method is required"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateAtLeastOneContact"
    },
    "testValues": {
      "valid": [
        { "email": "user@example.com", "phone": "" },
        { "email": "", "phone": "+39 3456789012" }
      ],
      "invalid": [
        { "email": "", "phone": "" },
        { "email": "invalid@", "phone": "123" }
      ],
      "edgeCases": [
        { "email": "a@b.co", "phone": "+1 1234567" }
      ]
    },
    "metadata": {
      "translationKey": "contactInfo_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["molecular", "composite", "required"]
    }
  },

  "identification": {
    "id": "identification",
    "name": "identification",
    "label": "Identification Documents",
    "type": "molecular",
    "icon": "IdCard",
    "description": "Captures Italian tax code and VAT number for identification",
    "category": "identification",
    "subData": [
      {
        "label": "Tax Code",
        "type": "text",
        "icon": "Fingerprint",
        "required": true,
        "templateRef": "taxCode",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "VAT Number",
        "type": "text",
        "icon": "Receipt",
        "required": true,
        "templateRef": "vatNumber",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateItalianIdentification",
        "message": "Invalid tax or VAT format"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateItalianIdentification"
    },
    "testValues": {
      "valid": [
        { "taxCode": "RSSMRA85M01H501Z", "vatNumber": "IT12345678901" }
      ],
      "invalid": [
        { "taxCode": "1234567890", "vatNumber": "FR12" },
        { "taxCode": "", "vatNumber": "" }
      ],
      "edgeCases": [
        { "taxCode": "AAAAAA00A00A000A", "vatNumber": "IT00000000000" }
      ]
    },
    "metadata": {
      "translationKey": "identification_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["molecular", "composite", "required"]
    }
  },

  // AGGREGATE TEMPLATES
  "personalData": {
    "id": "personalData",
    "name": "personalData",
    "label": "Personal Data Profile",
    "type": "aggregate",
    "icon": "UserCircle",
    "description": "Captures full personal profile including name, birth date, and contact details",
    "category": "profile",
    "subData": [
      {
        "label": "Full Name",
        "type": "molecular",
        "icon": "User",
        "required": true,
        "templateRef": "name",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Date of Birth",
        "type": "molecular",
        "icon": "Calendar",
        "required": true,
        "templateRef": "date",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Contact Information",
        "type": "molecular",
        "icon": "Contact",
        "required": true,
        "templateRef": "contactInfo",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validatePersonalCompleteness",
        "message": "All personal fields must be completed"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validatePersonalCompleteness"
    },
    "testValues": {
      "valid": [
        {
          "name": { "firstName": "Anna", "lastName": "Rossi" },
          "date": { "day": 15, "month": 6, "year": 1990 },
          "contactInfo": { "email": "anna.rossi@example.com", "phone": "+39 3456789012" }
        }
      ],
      "invalid": [
        {
          "name": { "firstName": "", "lastName": "Rossi" },
          "date": { "day": 31, "month": 2, "year": 2021 },
          "contactInfo": { "email": "", "phone": "" }
        }
      ],
      "edgeCases": [
        {
          "name": { "firstName": "É", "lastName": "Li" },
          "date": { "day": 29, "month": 2, "year": 1900 },
          "contactInfo": { "email": "a@b.co", "phone": "+1 1234567" }
        }
      ]
    },
    "metadata": {
      "translationKey": "personalData_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["aggregate", "comprehensive", "profile"]
    }
  },

  "customerProfile": {
    "id": "customerProfile",
    "name": "customerProfile",
    "label": "Customer Profile",
    "type": "aggregate",
    "icon": "Briefcase",
    "description": "Captures full customer data including personal info, identification, and financial details",
    "category": "customer",
    "subData": [
      {
        "label": "Personal Data",
        "type": "aggregate",
        "icon": "UserCircle",
        "required": true,
        "templateRef": "personalData",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Identification",
        "type": "molecular",
        "icon": "IdCard",
        "required": true,
        "templateRef": "identification",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Bank Account",
        "type": "atomic",
        "icon": "Banknote",
        "required": true,
        "templateRef": "iban",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateCustomerIntegrity",
        "message": "Customer profile must include valid identification and financial data"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateCustomerIntegrity"
    },
    "testValues": {
      "valid": [
        {
          "personalData": {
            "name": { "firstName": "Luca", "lastName": "Bianchi" },
            "date": { "day": 12, "month": 5, "year": 1985 },
            "contactInfo": { "email": "luca.b@example.com", "phone": "+39 3281234567" }
          },
          "identification": {
            "taxCode": "RSSMRA85M01H501Z",
            "vatNumber": "IT12345678901"
          },
          "iban": "IT60X0542811101000000123456"
        }
      ],
      "invalid": [
        {
          "personalData": {},
          "identification": { "taxCode": "", "vatNumber": "" },
          "iban": "123456"
        }
      ],
      "edgeCases": [
        {
          "personalData": {
            "name": { "firstName": "A", "lastName": "Z" },
            "date": { "day": 29, "month": 2, "year": 1900 },
            "contactInfo": { "email": "a@b.co", "phone": "+1 1234567" }
          },
          "identification": {
            "taxCode": "AAAAAA00A00A000A",
            "vatNumber": "IT00000000000"
          },
          "iban": "FR7630006000011234567890189"
        }
      ]
    },
    "metadata": {
      "translationKey": "customerProfile_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["aggregate", "comprehensive", "customer"]
    }
  },

  "businessProfile": {
    "id": "businessProfile",
    "name": "businessProfile",
    "label": "Business Profile",
    "type": "aggregate",
    "icon": "Building2",
    "description": "Captures business-related information including contact, identification, and VAT",
    "category": "business",
    "subData": [
      {
        "label": "Contact Information",
        "type": "molecular",
        "icon": "Contact",
        "required": true,
        "templateRef": "contactInfo",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Identification",
        "type": "molecular",
        "icon": "IdCard",
        "required": true,
        "templateRef": "identification",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "VAT Number",
        "type": "atomic",
        "icon": "Receipt",
        "required": true,
        "templateRef": "vatNumber",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateBusinessRegistration",
        "message": "Business registration data is incomplete or invalid"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateBusinessRegistration"
    },
    "testValues": {
      "valid": [
        {
          "contactInfo": { "email": "info@azienda.it", "phone": "+39 3281234567" },
          "identification": {
            "taxCode": "VRDLNZ78A01F205X",
            "vatNumber": "IT12345678901"
          },
          "vatNumber": "IT12345678901"
        }
      ],
      "invalid": [
        {
          "contactInfo": { "email": "", "phone": "" },
          "identification": { "taxCode": "", "vatNumber": "" },
          "vatNumber": "123"
        }
      ],
      "edgeCases": [
        {
          "contactInfo": { "email": "a@b.co", "phone": "+1 1234567" },
          "identification": {
            "taxCode": "AAAAAA00A00A000A",
            "vatNumber": "IT00000000000"
          },
          "vatNumber": "IT00000000000"
        }
      ]
    },
    "metadata": {
      "translationKey": "businessProfile_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["aggregate", "comprehensive", "business"]
    }
  },

  "completeProfile": {
    "id": "completeProfile",
    "name": "completeProfile",
    "label": "Complete Profile",
    "type": "aggregate",
    "icon": "Layers",
    "description": "Captures full personal and business profile including preferences",
    "category": "complete",
    "subData": [
      {
        "label": "Personal Data",
        "type": "aggregate",
        "icon": "UserCircle",
        "required": true,
        "templateRef": "personalData",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Business Profile",
        "type": "aggregate",
        "icon": "Building2",
        "required": true,
        "templateRef": "businessProfile",
        "constraints": [],
        "validation": {},
        "testValues": {}
      },
      {
        "label": "Preferences",
        "type": "atomic",
        "icon": "Settings",
        "required": false,
        "templateRef": "text",
        "constraints": [],
        "validation": {},
        "testValues": {}
      }
    ],
    "constraints": [
      {
        "type": "custom",
        "value": "validateCompleteProfile",
        "message": "Complete profile must include valid personal and business data"
      }
    ],
    "validation": {
      "type": "custom",
      "customFunction": "validateCompleteProfile"
    },
    "testValues": {
      "valid": [
        {
          "personalData": {
            "name": { "firstName": "Marco", "lastName": "Verdi" },
            "date": { "day": 10, "month": 3, "year": 1980 },
            "contactInfo": { "email": "marco.v@example.com", "phone": "+39 3456789012" }
          },
          "businessProfile": {
            "contactInfo": { "email": "info@azienda.it", "phone": "+39 3281234567" },
            "identification": {
              "taxCode": "VRDLNZ78A01F205X",
              "vatNumber": "IT12345678901"
            },
            "vatNumber": "IT12345678901"
          },
          "preferences": "Contact via email only"
        }
      ],
      "invalid": [
        {
          "personalData": {},
          "businessProfile": {},
          "preferences": ""
        }
      ],
      "edgeCases": [
        {
          "personalData": {
            "name": { "firstName": "A", "lastName": "Z" },
            "date": { "day": 29, "month": 2, "year": 1900 },
            "contactInfo": { "email": "a@b.co", "phone": "+1 1234567" }
          },
          "businessProfile": {
            "contactInfo": { "email": "", "phone": "" },
            "identification": {
              "taxCode": "AAAAAA00A00A000A",
              "vatNumber": "IT00000000000"
            },
            "vatNumber": "IT00000000000"
          },
          "preferences": "—"
        }
      ]
    },
    "metadata": {
      "translationKey": "completeProfile_validation",
      "created": "2024-01-01",
      "version": "1.0",
      "tags": ["aggregate", "comprehensive", "profile"]
    }
  }
};

async function migrateNewTemplates() {
  const client = new MongoClient(uri);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully');
    
    const db = client.db('factory');
    const collection = db.collection('type_templates');
    
    console.log('🗑️ Clearing existing templates...');
    await collection.deleteMany({});
    console.log('✅ Existing templates cleared');
    
    console.log('📝 Inserting new hierarchical templates...');
    const templatesArray = Object.values(newTemplates);
    const result = await collection.insertMany(templatesArray);
    
    console.log(`✅ Successfully inserted ${result.insertedCount} templates`);
    
    // Verify insertion
    const count = await collection.countDocuments();
    console.log(`📊 Total templates in database: ${count}`);
    
    // List all template names
    const templateNames = await collection.find({}, { projection: { name: 1, type: 1 } }).toArray();
    console.log('📋 Template names:');
    templateNames.forEach(t => console.log(`  - ${t.name} (${t.type})`));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.close();
    console.log('🔌 Connection closed');
  }
}

migrateNewTemplates().catch(console.error);
