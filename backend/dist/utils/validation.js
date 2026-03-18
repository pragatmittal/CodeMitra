"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeExecutionSchema = exports.getRoomsQuerySchema = exports.validateQuery = exports.validate = exports.changePasswordSchema = exports.updateUserSchema = exports.sendMessageSchema = exports.executeCodeSchema = exports.joinRoomSchema = exports.updateRoomSchema = exports.createRoomSchema = exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
    }),
    password: joi_1.default.string().min(8).required().messages({
        'string.min': 'Password must be at least 8 characters long',
        'any.required': 'Password is required',
    }),
    name: joi_1.default.string().min(2).max(50).required().messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
        'any.required': 'Name is required',
    }),
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
    }),
    password: joi_1.default.string().required().messages({
        'any.required': 'Password is required',
    }),
});
exports.createRoomSchema = joi_1.default.object({
    name: joi_1.default.string().min(3).max(100).required().messages({
        'string.min': 'Room name must be at least 3 characters long',
        'string.max': 'Room name cannot exceed 100 characters',
        'any.required': 'Room name is required',
    }),
    description: joi_1.default.string().max(500).allow('').optional().messages({
        'string.max': 'Description cannot exceed 500 characters',
    }),
    visibility: joi_1.default.boolean().default(true),
    isPublic: joi_1.default.boolean().optional(),
    password: joi_1.default.alternatives().conditional(joi_1.default.ref('visibility'), {
        is: false,
        then: joi_1.default.string().min(4).max(50).required().messages({
            'string.min': 'Room password must be at least 4 characters long',
            'string.max': 'Room password cannot exceed 50 characters',
            'any.required': 'Room password is required for private rooms',
        }),
        otherwise: joi_1.default.string().allow('', null).optional()
    }),
    maxCapacity: joi_1.default.number().integer().min(2).max(50).default(10).messages({
        'number.min': 'Room must allow at least 2 users',
        'number.max': 'Room cannot exceed 50 users',
    }),
    maxUsers: joi_1.default.number().integer().min(2).max(50).optional().messages({
        'number.min': 'Room must allow at least 2 users',
        'number.max': 'Room cannot exceed 50 users',
    }),
    language: joi_1.default.string().valid('javascript', 'python', 'java', 'cpp').default('javascript').messages({
        'any.only': 'Please select a valid programming language',
    }),
});
exports.updateRoomSchema = joi_1.default.object({
    name: joi_1.default.string().min(3).max(100).optional().messages({
        'string.min': 'Room name must be at least 3 characters long',
        'string.max': 'Room name cannot exceed 100 characters',
    }),
    description: joi_1.default.string().max(500).optional().messages({
        'string.max': 'Description cannot exceed 500 characters',
    }),
    password: joi_1.default.string().min(4).max(50).optional().messages({
        'string.min': 'Room password must be at least 4 characters long',
        'string.max': 'Room password cannot exceed 50 characters',
    }),
    visibility: joi_1.default.boolean().optional(),
    isPublic: joi_1.default.boolean().optional(),
    maxCapacity: joi_1.default.number().integer().min(2).max(50).optional().messages({
        'number.min': 'Room must allow at least 2 users',
        'number.max': 'Room cannot exceed 50 users',
    }),
    maxUsers: joi_1.default.number().integer().min(2).max(50).optional().messages({
        'number.min': 'Room must allow at least 2 users',
        'number.max': 'Room cannot exceed 50 users',
    }),
    language: joi_1.default.string().valid('javascript', 'python', 'java', 'cpp').optional().messages({
        'any.only': 'Please select a valid programming language',
    }),
});
exports.joinRoomSchema = joi_1.default.object({
    roomId: joi_1.default.string().uuid().required().messages({
        'string.uuid': 'Invalid room ID format',
        'any.required': 'Room ID is required',
    }),
    password: joi_1.default.string().allow('').optional().messages({
        'string.base': 'Password must be a string',
    }),
});
exports.executeCodeSchema = joi_1.default.object({
    code: joi_1.default.string().required().messages({
        'any.required': 'Code is required',
    }),
    language: joi_1.default.string().valid('javascript', 'python', 'java', 'cpp').required().messages({
        'any.only': 'Please select a valid programming language',
        'any.required': 'Language is required',
    }),
    input: joi_1.default.string().allow('').optional(),
    roomId: joi_1.default.string().uuid().required().messages({
        'string.uuid': 'Invalid room ID format',
        'any.required': 'Room ID is required',
    }),
});
exports.sendMessageSchema = joi_1.default.object({
    content: joi_1.default.string().min(1).max(1000).required().messages({
        'string.min': 'Message cannot be empty',
        'string.max': 'Message cannot exceed 1000 characters',
        'any.required': 'Message content is required',
    }),
    type: joi_1.default.string().valid('text', 'system', 'code').default('text').messages({
        'any.only': 'Invalid message type',
    }),
    roomId: joi_1.default.string().uuid().required().messages({
        'string.uuid': 'Invalid room ID format',
        'any.required': 'Room ID is required',
    }),
});
exports.updateUserSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(50).optional().messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
    }),
    avatar: joi_1.default.string().uri().optional().messages({
        'string.uri': 'Avatar must be a valid URL',
    }),
});
exports.changePasswordSchema = joi_1.default.object({
    currentPassword: joi_1.default.string().required().messages({
        'any.required': 'Current password is required',
    }),
    newPassword: joi_1.default.string().min(8).required().messages({
        'string.min': 'New password must be at least 8 characters long',
        'any.required': 'New password is required',
    }),
});
const validate = (schema) => {
    return (req, res, next) => {
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
exports.validate = validate;
const validateQuery = (schema) => {
    return (req, res, next) => {
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
exports.validateQuery = validateQuery;
exports.getRoomsQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(10),
    search: joi_1.default.string().max(100).optional(),
    language: joi_1.default.string().valid('javascript', 'python', 'java', 'cpp').optional(),
    visibility: joi_1.default.boolean().optional(),
    isPublic: joi_1.default.boolean().optional(),
});
exports.codeExecutionSchema = joi_1.default.object({
    code: joi_1.default.string().required().max(10000).messages({
        'string.empty': 'Code cannot be empty',
        'string.max': 'Code too long (max 10,000 characters)',
        'any.required': 'Code is required'
    }),
    language: joi_1.default.string().required().valid('javascript', 'python', 'java', 'cpp').messages({
        'any.only': 'Unsupported programming language',
        'any.required': 'Language is required'
    }),
    input: joi_1.default.string().allow('').optional().max(1000).messages({
        'string.max': 'Input too long (max 1,000 characters)'
    }),
    roomId: joi_1.default.string().required().uuid().messages({
        'string.guid': 'Invalid room ID format',
        'any.required': 'Room ID is required'
    })
});
//# sourceMappingURL=validation.js.map