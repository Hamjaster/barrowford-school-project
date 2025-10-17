# Bulk Student Import API

## Overview

This API endpoint allows bulk import of students from a CSV file with comprehensive error handling and detailed reporting.

## Endpoint

```
POST /api/student-bulk/bulk-import
```

## Authentication

- Requires authentication token
- Requires `manage_students` permission

## Request Format

- **Content-Type**: `multipart/form-data`
- **File Field**: `csvFile` (must be a CSV file)

## CSV File Format

The CSV file must contain the following columns (case-sensitive headers):

| Column Name   | Description          | Example           | Required |
| ------------- | -------------------- | ----------------- | -------- |
| Forename      | Student's first name | "Louie"           | Yes      |
| Legal Surname | Student's last name  | "Adamson"         | Yes      |
| Gender        | Student's gender     | "M" or "F"        | Yes      |
| DOB           | Date of birth        | "08 October 2014" | Yes      |
| Adno          | Admission number     | "C02414"          | Yes      |
| Year          | Academic year        | "Year Y6"         | Yes      |
| Reg           | Registration/Class   | "Year 6 Green"    | Yes      |

### Date Format

- Dates should be in "DD Month YYYY" format
- Examples: "08 October 2014", "27 December 2018", "05 June 2020"

### Sample CSV Content

```csv
Forename,Legal Surname,Gender,DOB,Adno,Year,Reg
Louie,Adamson,M,08 October 2014,C02414,Year Y6,Year 6 Green
Isaac,Afzal,M,27 December 2018,C02766,Year Y2,Year 1/2 Orange
Alex,Akulevicius,M,05 June 2020,C02854,Year Y1,Year 1/2 Green
```

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "message": "90 students imported, 10 failed to import",
  "summary": {
    "totalProcessed": 100,
    "successfulImports": 90,
    "failedImports": 10,
    "successRate": 90
  },
  "details": {
    "successful": [
      {
        "success": true,
        "data": {
          "student": {
            /* student object */
          },
          "action": "created",
          "admission_no": "C02414",
          "name": "Louie Adamson"
        },
        "row": 2
      }
    ],
    "failed": [
      {
        "success": false,
        "error": "Missing required fields: forename, legalSurname, gender, dob, adno, year, reg",
        "row": 5
      }
    ]
  }
}
```

### Error Responses

#### No File Uploaded (400)

```json
{
  "success": false,
  "error": "No CSV file uploaded. Please upload a CSV file."
}
```

#### Invalid File Type (400)

```json
{
  "success": false,
  "error": "Invalid file type. Please upload a CSV file."
}
```

#### Empty CSV File (400)

```json
{
  "success": false,
  "error": "No data found in CSV file or file is empty."
}
```

#### Server Error (500)

```json
{
  "success": false,
  "error": "Internal server error during bulk import"
}
```

## Features

### 1. Duplicate Handling

- If a student with the same admission number already exists, their record will be updated
- New students will be created with authentication accounts

### 2. Year Group and Class Management

- Automatically creates year groups if they don't exist
- Automatically creates classes if they don't exist
- Links students to appropriate year groups and classes

### 3. Error Handling

- Validates all required fields
- Validates date formats
- Validates gender values (M/F only)
- Provides detailed error messages for each failed row
- Continues processing even if some rows fail

### 4. Authentication Integration

- Creates Supabase Auth users for new students
- Sets default password: "test1234"
- Generates usernames and emails automatically

### 5. Comprehensive Reporting

- Shows total processed, successful, and failed imports
- Calculates success rate percentage
- Provides detailed breakdown of successful and failed operations
- Includes row numbers for easy CSV debugging

## Usage Examples

### Using cURL

```bash
curl -X POST \
  http://localhost:3000/api/student-bulk/bulk-import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "csvFile=@students.csv"
```

### Using JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append("csvFile", csvFile);

const response = await fetch("/api/student-bulk/bulk-import", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
console.log(result.message); // "90 students imported, 10 failed to import"
```

## File Size Limits

- Maximum file size: 10MB
- Only one file per request
- Only CSV files are accepted

## Notes

- The API processes students sequentially to maintain data integrity
- Failed imports don't affect successful ones
- All operations are logged for debugging purposes
- Year groups and classes are created automatically as needed
