import Joi from 'joi';

// Auth validation schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// Room validation schemas
export const createRoomSchema = Joi.object({
  name: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Room name must be at least 3 characters long',
    'string.max': 'Room name cannot exceed 100 characters',
    'any.required': 'Room name is required',
  }),
  description: Joi.string().max(500).allow('').optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
  isPublic: Joi.boolean().default(true),
  password: Joi.alternatives().conditional('isPublic', {
    is: false,
    then: Joi.string().min(4).max(50).required().messages({
      'string.min': 'Room password must be at least 4 characters long',
      'string.max': 'Room password cannot exceed 50 characters',
      'any.required': 'Room password is required for private rooms',
    }),
    otherwise: Joi.string().allow('', null).optional()
  }),
  maxUsers: Joi.number().integer().min(2).max(50).default(10).messages({
    'number.min': 'Room must allow at least 2 users',
    'number.max': 'Room cannot exceed 50 users',
  }),
  language: Joi.string().valid(
    'javascript',
    'python',
    'java',
    'cpp'
  ).default('javascript').messages({
    'any.only': 'Please select a valid programming language',
  }),
});

export const updateRoomSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional().messages({
    'string.min': 'Room name must be at least 3 characters long',
    'string.max': 'Room name cannot exceed 100 characters',
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
  password: Joi.string().min(4).max(50).optional().messages({
    'string.min': 'Room password must be at least 4 characters long',
    'string.max': 'Room password cannot exceed 50 characters',
  }),
  isPublic: Joi.boolean().optional(),
  maxUsers: Joi.number().integer().min(2).max(50).optional().messages({
    'number.min': 'Room must allow at least 2 users',
    'number.max': 'Room cannot exceed 50 users',
  }),
  language: Joi.string().valid(
    'javascript',
    'python',
    'java',
    'cpp'
  ).optional().messages({
    'any.only': 'Please select a valid programming language',
  }),
});

export const joinRoomSchema = Joi.object({
  roomId: Joi.string().uuid().required().messages({
    'string.uuid': 'Invalid room ID format',
    'any.required': 'Room ID is required',
  }),
  password: Joi.string().allow('').optional().messages({
    'string.base': 'Password must be a string',
  }),
});

// Code execution validation schemas
export const executeCodeSchema = Joi.object({
  code: Joi.string().required().messages({
    'any.required': 'Code is required',
  }),
  language: Joi.string().valid(
    'javascript',
    'python',
    'java',
    'cpp'
  ).required().messages({
    'any.only': 'Please select a valid programming language',
    'any.required': 'Language is required',
  }),
  input: Joi.string().allow('').optional(),
  roomId: Joi.string().uuid().required().messages({
    'string.uuid': 'Invalid room ID format',
    'any.required': 'Room ID is required',
  }),
});

// Chat validation schemas
export const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required().messages({
    'string.min': 'Message cannot be empty',
    'string.max': 'Message cannot exceed 1000 characters',
    'any.required': 'Message content is required',
  }),
  type: Joi.string().valid('text', 'system', 'code').default('text').messages({
    'any.only': 'Invalid message type',
  }),
  roomId: Joi.string().uuid().required().messages({
    'string.uuid': 'Invalid room ID format',
    'any.required': 'Room ID is required',
  }),
});

// User validation schemas
export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
  }),
  avatar: Joi.string().uri().optional().messages({
    'string.uri': 'Avatar must be a valid URL',
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'New password must be at least 8 characters long',
    'any.required': 'New password is required',
  }),
});

// Generic validation middleware
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: 'VALIDATION_ERROR',
      });
    }
    
    next();
  };
};

// Query parameter validation
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: 'VALIDATION_ERROR',
      });
    }
    
    next();
  };
};

// Room query schemas
export const getRoomsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().max(100).optional(),
  language: Joi.string().valid(
    'javascript',
    'python',
    'java',
    'cpp'
  ).optional(),
  isPublic: Joi.boolean().optional(),
});

// Code execution validation schema
export const codeExecutionSchema = Joi.object({
  code: Joi.string().required().max(10000).messages({
    'string.empty': 'Code cannot be empty',
    'string.max': 'Code too long (max 10,000 characters)',
    'any.required': 'Code is required'
  }),
  language: Joi.string().required().valid(
    'javascript', 'python', 'java', 'cpp'
  ).messages({
    'any.only': 'Unsupported programming language',
    'any.required': 'Language is required'
  }),
  input: Joi.string().allow('').optional().max(1000).messages({
    'string.max': 'Input too long (max 1,000 characters)'
  }),
  roomId: Joi.string().required().uuid().messages({
    'string.guid': 'Invalid room ID format',
    'any.required': 'Room ID is required'
  })
  // Note: userId is extracted from auth middleware, not from request body
});
