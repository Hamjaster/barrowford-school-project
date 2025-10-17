# Student Bulk Upload API

## Overview

This API allows you to create individual students from CSV data format. It handles the complete student creation process including Supabase Auth user creation and database record creation.

## Database Changes

- Added `admission_no` field to the `students` table
- Added unique constraint and index for `admission_no`

## API Endpoints

### 1. Create Student from CSV Data

**POST** `/api/student-bulk/create-student`

**Headers:**

```
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "forename": "Louie",
  "legalSurname": "Adamson",
  "gender": "M",
  "dob": "08 October 2014",
  "adno": "C02414",
  "year": "Year Y6",
  "reg": "Year 6 G"
}
```

**Response (Success - New Student):**

```json
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "student": {
      "id": 123,
      "auth_user_id": "uuid-here",
      "first_name": "Louie",
      "last_name": "Adamson",
      "gender": "M",
      "dob": "2014-10-08T00:00:00.000Z",
      "admission_no": "C02414",
      "year_group_id": 1,
      "current_year_group_id": 1,
      "class_id": 5,
      "username": "louie.adamson",
      "email": "louie.adamson@school.com",
      "status": "active"
    },
    "yearGroup": {
      "id": 1,
      "name": "Year Y6"
    },
    "class": {
      "id": 5,
      "name": "Year 6 G"
    },
    "authUser": {
      "id": "uuid-here",
      "email": "louie.adamson@school.com"
    },
    "action": "created"
  }
}
```

**Response (Success - Updated Student):**

```json
{
  "success": true,
  "message": "Student updated successfully",
  "data": {
    "student": {
      /* updated student data */
    },
    "yearGroup": {
      /* year group data */
    },
    "class": {
      /* class data */
    },
    "action": "updated"
  }
}
```

### 2. Get Student by Admission Number

**GET** `/api/student-bulk/admission/:admissionNo`

**Example:**

```
GET /api/student-bulk/admission/C02414
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "first_name": "Louie",
    "last_name": "Adamson",
    "gender": "M",
    "dob": "2014-10-08T00:00:00.000Z",
    "admission_no": "C02414",
    "year_groups": { "name": "Year Y6" },
    "classes": { "name": "Year 6 G" }
  }
}
```

## Features

### ✅ Implemented Features:

1. **Username/Email Generation**: `forename.surname` and `forename.surname@school.com`
2. **Password**: Fixed password `test1234` for all students
3. **Admission Number**: Stored in `admission_no` field
4. **Year Group Matching**: Finds by name, creates if doesn't exist
5. **Class Matching**: Finds by name, creates if doesn't exist
6. **Date Parsing**: Converts "DD Month YYYY" to ISO format
7. **Gender Storage**: Stores as M/F
8. **Update Logic**: Updates existing students by admission_no
9. **Supabase Auth**: Creates auth user with proper metadata
10. **Error Handling**: Comprehensive error handling and validation

### 🔄 Update vs Create Logic:

- If student exists (by `admission_no`): **Updates** all fields
- If student doesn't exist: **Creates** new student with auth user

### 📝 Data Mapping:

| CSV Field    | Database Field | Notes              |
| ------------ | -------------- | ------------------ |
| forename     | first_name     | Direct mapping     |
| legalSurname | last_name      | Direct mapping     |
| gender       | gender         | M/F format         |
| dob          | dob            | Parsed to ISO date |
| adno         | admission_no   | Unique identifier  |
| year         | year_group_id  | Matched by name    |
| reg          | class_id       | Matched by name    |

## Error Handling

- **400**: Missing required fields, invalid gender, date parsing errors
- **404**: Student not found (for GET requests)
- **500**: Server errors, database errors, auth creation failures

## Permissions Required

- `create-user`: For creating/updating students
- `fetch-users`: For retrieving student data

## Next Steps

This single student function can be used as a building block for bulk CSV upload functionality. The bulk upload would:

1. Parse CSV file
2. Call this function for each row
3. Collect success/failure statistics
4. Return summary of results
