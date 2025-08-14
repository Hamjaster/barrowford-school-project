import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }
    
    next();
  };
};

// Common validation schemas
export const loginSchema = Joi.object({
  email: Joi.string().email().when('username', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  username: Joi.string().min(3).max(50).when('email', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  password: Joi.string().min(6).required(),
});

export const passwordResetRequestSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const passwordResetSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
});

export const createStaffSchema = Joi.object({
  email: Joi.string().email().required(),
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('staff_admin', 'staff').required(),
  phoneNumber: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{10,15}$/).optional(),
  address: Joi.string().max(500).optional(),
  dateOfBirth: Joi.date().iso().optional(),
  employeeId: Joi.string().max(50).optional(),
  department: Joi.string().max(100).optional(),
  position: Joi.string().max(100).optional(),
  hireDate: Joi.date().iso().optional(),
});

export const createParentSchema = Joi.object({
  email: Joi.string().email().required(),
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  phoneNumber: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{10,15}$/).optional(),
  address: Joi.string().max(500).optional(),
  dateOfBirth: Joi.date().iso().optional(),
  occupation: Joi.string().max(100).optional(),
  workPhone: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{10,15}$/).optional(),
  emergencyContact: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{10,15}$/).optional(),
});

export const createChildSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  dateOfBirth: Joi.date().iso().required(),
  yearId: Joi.string().uuid().optional(),
  medicalInfo: Joi.string().max(1000).optional(),
  allergies: Joi.string().max(1000).optional(),
  emergencyContact: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{10,15}$/).optional(),
  admissionNumber: Joi.string().max(50).optional(),
  admissionDate: Joi.date().iso().optional(),
  parentIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  relationshipTypes: Joi.array().items(Joi.string().valid('parent', 'guardian', 'emergency_contact')).required(),
});

export const updateUserSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).optional(),
  lastName: Joi.string().min(2).max(100).optional(),
  phoneNumber: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{10,15}$/).optional(),
  address: Joi.string().max(500).optional(),
  dateOfBirth: Joi.date().iso().optional(),
  profileImage: Joi.string().uri().optional(),
  // Staff specific
  employeeId: Joi.string().max(50).optional(),
  department: Joi.string().max(100).optional(),
  position: Joi.string().max(100).optional(),
  hireDate: Joi.date().iso().optional(),
  // Parent specific
  occupation: Joi.string().max(100).optional(),
  workPhone: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{10,15}$/).optional(),
  // Child specific
  yearId: Joi.string().uuid().optional(),
  medicalInfo: Joi.string().max(1000).optional(),
  allergies: Joi.string().max(1000).optional(),
  admissionNumber: Joi.string().max(50).optional(),
  admissionDate: Joi.date().iso().optional(),
  // Common
  emergencyContact: Joi.string().pattern(/^[\+]?[0-9\s\-\(\)]{10,15}$/).optional(),
});

export const createYearSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
});

export const createSubjectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
});

export const assignStaffSchema = Joi.object({
  staffId: Joi.string().uuid().required(),
  yearIds: Joi.array().items(Joi.string().uuid()).optional(),
  subjectIds: Joi.array().items(Joi.string().uuid()).optional(),
  isClassTeacher: Joi.boolean().optional(),
});

export const createContentSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  content: Joi.string().optional(),
  fileUrl: Joi.string().uri().optional(),
  mediaType: Joi.string().valid('image', 'video', 'document', 'pdf', 'word_doc').optional(),
  subjectId: Joi.string().uuid().optional(),
  yearId: Joi.string().uuid().optional(),
  isPublished: Joi.boolean().optional(),
});
