# School Portal Backend - Setup Guide

## Quick Start

1. **Install Dependencies**
```bash
npm install
```

2. **Create Environment File**
Create a `.env` file in the root directory with the following content:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/school_portal"

# JWT Configuration (CHANGE THESE IN PRODUCTION!)
JWT_SECRET="your-super-secret-jwt-key-here-change-this-in-production"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="your-refresh-token-secret-change-this-in-production"
JWT_REFRESH_EXPIRES_IN="7d"

# Server Configuration
PORT=3000
NODE_ENV="development"

# Email Configuration (Optional - for password reset)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@school-portal.com"

# Application URLs
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3000"
```

3. **Set up Database**
- Create a PostgreSQL database
- Update the `DATABASE_URL` in your `.env` file
- Run database migrations:

```bash
npm run db:push
```

4. **Start Development Server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Database Setup with Supabase (Recommended)

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Get your database URL from Project Settings > Database

2. **Update Environment Variables**
```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

3. **Push Database Schema**
```bash
npm run db:push
```

## API Testing

Once the server is running, you can test the endpoints:

### Health Check
```bash
curl http://localhost:3000/health
```

### Create First Admin User (Manual Database Insert)
Since this is the initial setup, you'll need to create the first admin user directly in the database:

```sql
-- Insert into users table
INSERT INTO users (id, email, password_hash, role, is_active, email_verified) 
VALUES (
  gen_random_uuid(),
  'admin@school.com',
  '$2a$12$LQv3c1yqBw2hTYEJc9fQ8eGOdpOzq.5h7F1X6xJ2K3L4M5N6O7P8Q',  -- password: 'admin123'
  'admin',
  true,
  true
);

-- Insert into staff table
INSERT INTO staff (id, user_id, first_name, last_name, employee_id)
SELECT 
  gen_random_uuid(),
  u.id,
  'System',
  'Administrator',
  'ADMIN001'
FROM users u WHERE u.email = 'admin@school.com';
```

### Login Test
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.com",
    "password": "admin123"
  }'
```

## Project Structure

```
src/
├── config/           # Configuration files
├── db/              # Database schema and connection
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── utils/           # Utility functions
└── index.ts         # Main application entry point
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:push` - Push schema to database

## Authentication Flow

1. **Login**: POST `/api/auth/login` with email/username and password
2. **Get Token**: Receive JWT access token and refresh token
3. **Use Token**: Include `Authorization: Bearer <token>` header in requests
4. **Refresh**: POST `/api/auth/refresh-token` when access token expires

## User Roles

- **Admin**: Full system access
- **Staff Admin**: Can manage staff, parents, and children
- **Staff**: Can manage parents and children, limited to assigned classes
- **Parent**: Can only view their children's data
- **Child**: Can only view their own data (login with username)

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Rate limiting
- Input validation
- CORS configuration
- Security headers with Helmet

## Troubleshooting

### Database Connection Issues
- Verify your DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check firewall settings

### Email Issues
- Email functionality is optional
- Configure SMTP settings for password reset features
- Use app-specific passwords for Gmail

### TypeScript Errors
- Run `npx tsc --noEmit` to check for type errors
- Ensure all dependencies are installed

## Next Steps

1. Create your first admin user in the database
2. Test the login endpoint
3. Use the admin token to create other users via the API
4. Set up your frontend to consume these APIs
5. Configure email settings for production use

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong, unique JWT secrets
3. Configure proper CORS origins
4. Set up SSL/TLS
5. Configure production database
6. Set up proper logging
7. Configure email service

For detailed API documentation, see the main README.md file.
