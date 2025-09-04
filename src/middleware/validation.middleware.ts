import { ZodType, ZodObject } from "zod";
import { Request, Response, NextFunction } from "express";

export const validate = (schema: ZodObject<any> | ZodType<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body); // Validate request body
      next(); // If valid, continue
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        errors: error.errors, // zod gives structured errors
      });
    }
  };
};
export const validateQuery = (schema: ZodObject<any> | ZodType<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query); // Validate request query
      next(); // If valid, continue
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        errors: error.errors, // zod gives structured errors
      });
    }
  };
};
export const validateParams = (schema: ZodObject<any> | ZodType<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params); // Validate request params
      next(); // If valid, continue
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        errors: error.errors, // zod gives structured errors
      });
    }
  };
}