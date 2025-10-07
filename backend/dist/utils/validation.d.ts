import Joi from 'joi';
export declare const registerSchema: Joi.ObjectSchema<any>;
export declare const loginSchema: Joi.ObjectSchema<any>;
export declare const createRoomSchema: Joi.ObjectSchema<any>;
export declare const updateRoomSchema: Joi.ObjectSchema<any>;
export declare const joinRoomSchema: Joi.ObjectSchema<any>;
export declare const executeCodeSchema: Joi.ObjectSchema<any>;
export declare const sendMessageSchema: Joi.ObjectSchema<any>;
export declare const updateUserSchema: Joi.ObjectSchema<any>;
export declare const changePasswordSchema: Joi.ObjectSchema<any>;
export declare const validate: (schema: Joi.ObjectSchema) => (req: any, res: any, next: any) => any;
export declare const validateQuery: (schema: Joi.ObjectSchema) => (req: any, res: any, next: any) => any;
export declare const getRoomsQuerySchema: Joi.ObjectSchema<any>;
export declare const codeExecutionSchema: Joi.ObjectSchema<any>;
//# sourceMappingURL=validation.d.ts.map