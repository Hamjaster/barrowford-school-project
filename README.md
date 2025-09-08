# School Portal Backend API
 
A comprehensive backend system for a UK primary school portal built with Node.js, TypeScript, Express, and Supabase (PostgreSQL).

## Features 

- **Multi-role Authentication System**: Admin, Staff/Teacher, Parent, and Student roles
- **JWT-based Authentication**: Secure token-based authentication with refresh tokens
- **Role-based Access Control**: Granular permissions based on user roles
- **Password Management**: Secure password hashing, reset functionality, and validation
- **Email Integration**: Welcome emails, password reset notifications
- **User Management**: CRUD operations for all user types
- **Academic Management**: Years, subjects, and staff assignments
- **Database Relations**: Proper foreign key constraints following ACID principles
- **Security Features**: Rate limiting, CORS, helmet security headers
- **Input Validation**: Comprehensive request validation using Joi
- **Error Handling**: Centralized error handling with proper HTTP status codes

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Drizzle ORM
- **Authentication**: JWT with bcryptjs
- **Validation**: Joi
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate Limiting

## Database Schema

The system implements the following entities with proper relationships:

- **Users**: Base user entity with authentication credentials
- **Staff**: Extends users for school staff members
- **Parents**: Extends users for student parents/guardians
- **Children**: Extends users for students (login with username only)
- **Years**: Academic years/grades
- **Subjects**: Academic subjects
- **Content**: Learning materials and content
- **Relationships**: Parent-child relationships with role definitions

## Installation

1. **Clone and navigate to the backend directory**:

```bash
cd nybble-bradford-primary-backend
```

2. **Install dependencies**:

```bash
npm install
```

3. **Set up environment variables**:
   Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/school_portal"
SUPABASE_URL="your-supabase-project-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="your-refresh-token-secret"
JWT_REFRESH_EXPIRES_IN="7d"

# Server Configuration
PORT=3000
NODE_ENV="development"

# Email Configuration (for password reset)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@school-portal.com"

# Application URLs
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3000"
```

4. **Set up the database**:

```bash
# Generate database schema
npm run db:generate

# Push schema to database
npm run db:push
```

5. **Start the development server**:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication Endpoints

| Method | Endpoint                    | Description                            | Access        |
| ------ | --------------------------- | -------------------------------------- | ------------- |
| POST   | `/api/auth/login`           | User login (email/username + password) | Public        |
| POST   | `/api/auth/refresh-token`   | Refresh access token                   | Public        |
| POST   | `/api/auth/forgot-password` | Request password reset                 | Public        |
| POST   | `/api/auth/reset-password`  | Reset password with token              | Public        |
| POST   | `/api/auth/change-password` | Change password (authenticated)        | Authenticated |
| GET    | `/api/auth/me`              | Get current user profile               | Authenticated |
| POST   | `/api/auth/logout`          | Logout user                            | Authenticated |

### User Management Endpoints

| Method | Endpoint                        | Description               | Access            |
| ------ | ------------------------------- | ------------------------- | ----------------- |
| POST   | `/api/users/staff`              | Create staff member       | Staff Admin+      |
| POST   | `/api/users/parents`            | Create parent account     | Staff+            |
| POST   | `/api/users/children`           | Create child account      | Staff+            |
| GET    | `/api/users/staff`              | List all staff members    | Staff+            |
| GET    | `/api/users/parents`            | List all parents          | Staff+            |
| GET    | `/api/users/children`           | List all children         | Staff+            |
| GET    | `/api/users/:userId`            | Get specific user details | Context-dependent |
| PUT    | `/api/users/:userId`            | Update user profile       | Context-dependent |
| PATCH  | `/api/users/:userId/deactivate` | Deactivate user account   | Staff Admin+      |
| PATCH  | `/api/users/:userId/activate`   | Activate user account     | Staff Admin+      |

### Academic Management Endpoints

| Method | Endpoint                                          | Description                    | Access       |
| ------ | ------------------------------------------------- | ------------------------------ | ------------ |
| POST   | `/api/academic/years`                             | Create academic year           | Staff Admin+ |
| GET    | `/api/academic/years`                             | List all years                 | Staff+       |
| GET    | `/api/academic/years/:yearId`                     | Get specific year              | Staff+       |
| PUT    | `/api/academic/years/:yearId`                     | Update year                    | Staff+       |
| PATCH  | `/api/academic/years/:yearId/activate`            | Activate year                  | Staff+       |
| PATCH  | `/api/academic/years/:yearId/deactivate`          | Deactivate year                | Staff+       |
| POST   | `/api/academic/subjects`                          | Create subject                 | Staff+       |
| GET    | `/api/academic/subjects`                          | List all subjects              | Staff+       |
| GET    | `/api/academic/subjects/:subjectId`               | Get specific subject           | Staff+       |
| PUT    | `/api/academic/subjects/:subjectId`               | Update subject                 | Staff+       |
| POST   | `/api/academic/assignments`                       | Assign staff to years/subjects | Staff+       |
| GET    | `/api/academic/assignments`                       | List all assignments           | Staff+       |
| GET    | `/api/academic/assignments/staff/:staffId`        | Get staff assignments          | Staff+       |
| DELETE | `/api/academic/assignments/year/:assignmentId`    | Remove year assignment         | Staff+       |
| DELETE | `/api/academic/assignments/subject/:assignmentId` | Remove subject assignment      | Staff+       |

## User Roles and Permissions

### Admin (Super Admin)

- Full system access
- Can create, edit, and manage all user types
- Can reset passwords for any account
- System configuration access

### Staff Admin

- Can create staff, parent, and child accounts
- Cannot create other staff admin or admin accounts
- Can manage years, subjects, and assignments
- Has more authority than regular staff

### Staff (Teacher)

- Cannot create other staff accounts
- Can create parent and child accounts
- Can upload and manage content for assigned years/classes
- Can edit child profiles and reset child passwords
- Limited to assigned year/class data

### Parent

- Can only see content related to their children
- Has separate account (not shared with child)
- Can view child's academic progress and content
- Limited access to only relevant sections

### Child

- Login with username and password only (no email)
- Limited access to only their content and related sections
- Cannot access other children's data

## Authentication Flow

### For Staff, Parents, and Admin:

1. Login with email and password
2. Receive JWT access token and refresh token
3. Use access token for authenticated requests
4. Refresh token when access token expires

### For Children:

1. Login with username and password (no email required)
2. Same token flow as other users
3. Limited access based on role permissions

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific field error"
    }
  ]
}
```

## Success Responses

Successful API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:push` - Push schema changes to database

### Database Operations

The system uses Drizzle ORM for type-safe database operations. All queries follow ACID principles with proper foreign key constraints.

### Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for frontend origins
- **Helmet**: Security headers
- **Input Validation**: All endpoints validate input data
- **Password Hashing**: bcryptjs with salt rounds of 12
- **JWT Security**: Separate access and refresh tokens

## Deployment

1. Set up PostgreSQL database (Supabase recommended)
2. Configure environment variables for production
3. Build the application: `npm run build`
4. Start the server: `npm start`

## Contributing

1. Follow TypeScript best practices
2. Maintain proper error handling
3. Add input validation for new endpoints
4. Follow the existing code structure
5. Update documentation for new features

## License

This project is for educational purposes as part of a school management system.
