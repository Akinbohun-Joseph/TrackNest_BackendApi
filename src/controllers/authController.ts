import {Request, Response, NextFunction} from 'express';
import {logger} from '../utils/logger'
import { AuthService } from '../services/auth/authService';
import { error } from 'console';

const authService = new AuthService();

export class AuthController {
    //Register a user

    async register (req: Request, res: Response): Promise<void> {
        try{
            const userData = req.body //take the data from client
            const result = await authService.registerUser(userData); //call auth service
            res.status(201).json({success: true, data: result})
        } catch (error: any) {
            logger.error("Register failed", error);
            res.status(500).json({success: false, data: error.message});
        }
    }
    //Login a user
async login (req: Request, res: Response): Promise<void> {
    try {
        const loginData = req.body;
        const result = await authService.loginUser(loginData);
        res.status(200).json({sucess: true, data:result });
    } catch (error: any) {
        logger.error("Login failed", error);
        res.status(500).json({sucess: false, data: error.message})
    }
}
//Get current user profile from token

async getProfile (req:Request, res: Response): Promise<void> {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        // const userId = (req as any).user?.id; // we'll populate this later vai middleare 
        if(!token) {
            res.status(401).json({success: false, message: "No token provided"})
            return;
        }
        const result = await authService.verifyToken(token);
        res.status(200).json({success: true, data: result})
    } catch (error: any) {
        logger.error("Get profile failed:", error);
        res.status(401).json({success: true, message: error.message });
    }
}
// Update current user profile
async updateProfile (req: Request, res: Response): Promise<void> {
    {
        try {
        const userId = (req as any).user?.id;
        if(!userId) {
            res.status(401).json({success: true, message: "Unauthorize"});
            return;
        }
        const updatedData = req.body;
        const result = await authService.updatedUserProfile(userId, updatedData);
        res.status(200).json({success: true, data: result})
    } catch (error: any) {
        logger.error("User update failed", error);
        res.status(400).json({success: false, message: error.message})
    }}
}
}