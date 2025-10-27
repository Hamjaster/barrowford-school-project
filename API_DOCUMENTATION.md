# API Documentation

Base URL: `http://localhost:PORT/api`

All protected routes require `Authorization: Bearer <token>` header.

---

## 🔐 Authentication (`/api/auth`)

### `POST /api/auth/login`

**Public** - User login

**Request:**

```json
{
  "email": "user@example.com",
  "username": "student1", // For students
  "password": "password123"
}
```

**Response:**

```json
{
  "access_token": "jwt_token",
  "user": {
    "id": "auth_user_id",
    "email": "user@example.com",
    "role": "student",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

---

### `POST /api/auth/create-user`

**Protected** - Create new user (Admin/Staff only)

**Request:**

```json
{
  "email": "student@school.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "student",
  "year_group_id": 1,
  "class_id": 2,
  "parent_ids": [1, 2]
}
```

**Response:**

```json
{
  "success": true,
  "message": "User created successfully",
  "user": { ... }
}
```

---

### `POST /api/auth/forgot-password`

**Public** - Request password reset

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### `POST /api/auth/reset-password`

**Protected** - Reset another user's password (Admin only)

**Request:**

```json
{
  "email": "target@example.com",
  "newPassword": "newPassword123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## 👥 Users (`/api/user`)

### `GET /api/user`

**Protected** - Get all users (filtered by role)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "role": "student",
      "first_name": "John",
      "last_name": "Doe",
      "status": "active"
    }
  ]
}
```

---

### `POST /api/user/status`

**Protected** - Toggle user status (Admin only)

**Request:**

```json
{
  "userId": 1,
  "role": "student"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User status updated"
}
```

---

### `DELETE /api/user`

**Protected** - Delete user (Admin only)

**Request:**

```json
{
  "userId": 1,
  "role": "student"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 👨‍🎓 Students (`/api/student`)

### `GET /api/student/details/me`

**Protected** - Get own student details

**Response:**

```json
{
  "fullName": "John Doe",
  "className": "1A",
  "age": 10,
  "hairColor": "brown",
  "height": 130,
  "profilePhoto": "url"
}
```

---

### `POST /api/student/images`

**Protected** - Upload student image

**Request:** `multipart/form-data`

- `image`: File
- `student_id`: Number

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "image_url": "cloudinary_url"
  }
}
```

---

### `GET /api/student/images/me`

**Protected** - Get own student images

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "image_url": "url",
      "year_group_id": 1,
      "year_group_name": "Year 1"
    }
  ]
}
```

---

### `DELETE /api/student/images/:id`

**Protected** - Delete own image

**Response:**

```json
{
  "success": true,
  "message": "Image deleted"
}
```

---

### `POST /api/student/learning/`

**Protected** - Add student learning

**Request:**

```json
{
  "title": "Math Lesson",
  "description": "Learned addition",
  "subject_id": 1,
  "attachment_url": "url"
}
```

**Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

---

### `GET /api/student/learning/me`

**Protected** - Get own learnings

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Math",
      "subject": "Mathematics"
    }
  ]
}
```

---

### `DELETE /api/student/learning/:id`

**Protected** - Delete learning

**Response:**

```json
{
  "success": true,
  "message": "Learning deleted"
}
```

---

### `PUT /api/student/impacts`

**Protected** - Update impact

**Request:**

```json
{
  "impact": "Made friends"
}
```

---

### `GET /api/student/impacts/me`

**Protected** - Get own impacts

---

### `PUT /api/student/experiences`

**Protected** - Update experience

**Request:**

```json
{
  "experience": "School trip"
}
```

---

### `GET /api/student/experiences/me`

**Protected** - Get own experiences

---

## 👨‍🏫 Teachers (`/api/teacher`)

### `GET /api/teacher/getStudents`

**Protected** - Get assigned students

**Response:**

```json
{
  "success": true,
  "students": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "username": "john.doe"
    }
  ]
}
```

---

### `GET /api/teacher/teacher-profile`

**Protected** - Get own teacher profile

**Response:**

```json
{
  "success": true,
  "teacher": {
    "id": 1,
    "first_name": "Jane",
    "email": "teacher@school.com",
    "class_name": "1A"
  }
}
```

---

### `POST /api/teacher/update-student-profile`

**Protected** - Update student profile photo

**Request:**

```json
{
  "studentId": 1,
  "profilePhoto": "cloudinary_url"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Profile updated"
}
```

---

## 👨‍👩‍👧 Parents (`/api/parent`)

### `GET /api/parent/children`

**Protected** - Get all children

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "username": "john.doe"
    }
  ]
}
```

---

### `GET /api/parent/children/:studentId`

**Protected** - Get child details

**Response:**

```json
{
  "success": true,
  "student": {
    "id": 1,
    "first_name": "John",
    "learnings": [...],
    "images": [...],
    "reflections": [...]
  }
}
```

---

## 📚 Subjects (`/api/subject`)

### `GET /api/subject`

**Public** - Get all subjects

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Mathematics",
      "description": "Math subject",
      "status": "active"
    }
  ]
}
```

---

### `POST /api/subject`

**Protected** - Create subject (Admin/Staff only)

**Request:**

```json
{
  "name": "Mathematics",
  "description": "Math subject"
}
```

---

### `PUT /api/subject/:id`

**Protected** - Update subject

**Request:**

```json
{
  "name": "Math",
  "description": "Updated"
}
```

---

### `DELETE /api/subject/:id`

**Protected** - Delete subject

---

### `PATCH /api/subject/status/:id`

**Protected** - Toggle subject status

---

### `GET /api/subject/year-groups`

**Public** - Get all year groups

---

### `GET /api/subject/classes`

**Public** - Get all classes

---

### `GET /api/subject/year-groups/:yearGroupId/subjects`

**Public** - Get subjects by year group

---

### `GET /api/subject/eligible-year-groups`

**Protected** - Get eligible year groups

---

## 📝 Personal Sections (`/api/personalSection`)

### `POST /api/personalSection/topics`

**Protected** - Create topic (Admin/Staff only)

**Request:**

```json
{
  "title": "About Me",
  "description": "Personal info"
}
```

---

### `PUT /api/personalSection/topics/:id`

**Protected** - Update topic

---

### `DELETE /api/personalSection/topics/:id`

**Protected** - Delete topic

---

### `GET /api/personalSection/topics`

**Protected** - Get all topics

---

### `GET /api/personalSection/topics/all`

**Protected** - Get all topics for management

---

### `PATCH /api/personalSection/topics/status/:id`

**Protected** - Toggle topic status

---

### `POST /api/personalSection`

**Protected** - Create personal section

**Request:**

```json
{
  "topic_id": 1,
  "content": "My content"
}
```

---

### `GET /api/personalSection/me`

**Protected** - Get own personal sections

---

### `GET /api/personalSection/me/:topicId`

**Protected** - Get section by topic

---

### `PUT /api/personalSection/:id`

**Protected** - Update own section

---

### `GET /api/personalSection/student/:studentId`

**Protected** - Get student sections (Teacher)

---

### `PUT /api/personalSection/teacher/:id`

**Protected** - Update student section (Teacher)

---

## 🎯 Reflections (`/api/reflection`)

### `POST /api/reflection/createtopics`

**Protected** - Create reflection topic (Admin/Staff only)

**Request:**

```json
{
  "title": "Week 1",
  "description": "First week reflections"
}
```

---

### `GET /api/reflection/topics`

**Protected** - Get all topics

---

### `PUT /api/reflection/topics/:id`

**Protected** - Update topic

---

### `DELETE /api/reflection/topics/:id`

**Protected** - Delete topic

---

### `POST /api/reflection/createreflection`

**Protected** - Create reflection (Students)

**Request:** `multipart/form-data`

- `topic_id`: Number
- `content`: String
- `file`: File (optional)

---

### `GET /api/reflection/my`

**Protected** - Get own reflections

---

### `GET /api/reflection/all`

**Protected** - Get all reflections (Admins)

---

### `GET /api/reflection/:studentId`

**Protected** - Get student reflections (Parents)

---

### `PUT /api/reflection/update`

**Protected** - Update reflection

---

### `DELETE /api/reflection/:reflectionId`

**Protected** - Delete reflection (Admin/Staff)

---

### `DELETE /api/reflection/student/:reflectionId`

**Protected** - Request delete reflection (Student)

---

### `GET /api/reflection/activetopics`

**Protected** - Get active topics

---

### `POST /api/reflection/addcomment`

**Protected** - Add comment to reflection

**Request:**

```json
{
  "reflection_id": 1,
  "content": "Great work!"
}
```

---

### `GET /api/reflection/comment/:reflectionId`

**Protected** - Get comments

---

### `GET /api/reflection/weeks/previous`

**Protected** - Get previous weeks

---

## ✅ Moderation (`/api/moderation`)

### `GET /api/moderation`

**Protected** - List pending moderations

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "entity_type": "reflection",
      "status": "pending"
    }
  ]
}
```

---

### `GET /api/moderation/:id`

**Protected** - Get moderation by ID

---

### `POST /api/moderation/:id/approve`

**Protected** - Approve moderation

---

### `POST /api/moderation/:id/reject`

**Protected** - Reject moderation

---

## 📋 Assignments (`/api/assignment`)

### `GET /api/assignment/student/:studentId`

**Protected** - Get student assignments

**Response:**

```json
{
  "success": true,
  "data": {
    "student": {...},
    "assignedParents": [...],
    "assignedTeacher": {...},
    "availableParents": [...],
    "availableTeachers": [...]
  }
}
```

---

### `POST /api/assignment/student/:studentId/parents`

**Protected** - Assign parents to student

**Request:**

```json
{
  "parentIds": [1, 2]
}
```

---

### `POST /api/assignment/student/:studentId/teacher`

**Protected** - Assign teacher to student

**Request:**

```json
{
  "teacherId": 1
}
```

---

### `DELETE /api/assignment/student/:studentId/teacher`

**Protected** - Remove teacher assignment

---

## 📊 Bulk Operations

### Students (`/api/student-bulk`)

#### `POST /api/student-bulk/create-student`

**Public** - Create single student from CSV data

**Request:**

```json
{
  "misId": "123",
  "forename": "John",
  "legalSurname": "Doe",
  "reg": "1A",
  "year": "Year 1",
  "primaryEmail": "parent@email.com"
}
```

---

#### `POST /api/student-bulk/bulk-import`

**Public** - Bulk import students from CSV file

**Request:** `multipart/form-data`

- `csvFile`: File

---

#### `GET /api/student-bulk/admission/:admissionNo`

**Protected** - Get student by admission number

---

### Parents (`/api/parent-bulk`)

#### `POST /api/parent-bulk/single`

**Public** - Create single parent

**Request:**

```json
{
  "misId": "123",
  "forename": "Jane",
  "legalSurname": "Doe",
  "primaryEmail": "parent@email.com"
}
```

---

#### `POST /api/parent-bulk/bulk`

**Public** - Bulk import parents from CSV

**Request:** `multipart/form-data`

- `csvFile`: File

---

#### `GET /api/parent-bulk/email/:email`

**Protected** - Get parent by email

---

## 📝 Notes

- All protected routes require authentication token in header
- Role-based permissions enforced on backend
- CSV imports use `multipart/form-data`
- Image uploads use `multipart/form-data`
- Base URL includes `/api` prefix
- Successful responses typically return `{"success": true, ...}`
- Error responses include `{"success": false, "error": "message"}`
