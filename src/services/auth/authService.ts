// =========================
// AuthService: Handles all authentication logic for TrackNest
// =========================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import  prisma  from '../../config/prisma';
import { logger } from '../../utils/logger';
import {logger} from '../../utils/logger'

// =========================
// Interfaces
// =========================

// User Registration Data
interface RegisterUserData {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  emergencyContact?: Array<{
    name: string;
    phone: string;
    relationship: string;
  }>;
  medicalInfo?: {
    bloodType?: string;
    allergies?: string[];
    medications?: string[];
    emergencyConditions?: string;
  };
}

// Login Data
interface LoginUserData {
  email: string;
  password: string;
}

// What to return after successful login or registration
interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string;
  };
  token: string;
}
//updatedData 
interface updateUserData {
  fullName?: string;
  phone?: string;
  emergencyContact?: Array<{
    name: string;
    phone: string;
    relationship: string;
  }>;
  medicalInfo?: {
    bloodType?: string;
    allergies?: string[];
    medications?: string[];
    emergencyConditions?: string;
  };

}

// =========================
// AuthService Class
// =========================

export class AuthService {

  // -------------------------
  // Register a new user
  // -------------------------
  async registerUser(userData: RegisterUserData): Promise<AuthResponse> {
    try {
      // 1. Check for duplicate email or phone
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userData.email },
            { phone: userData.phone },
          ],
        },
      });

      if (existingUser) {
        throw new Error('User already exists with this email or phone number');
      }

      // 2. Validate user input
      this.validateRegistrationData(userData);

      // 3. Hash the password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // 4. Create the user
      const newUser = await prisma.user.create({
        data: {
          email: userData.email,
          phone: userData.phone,
          fullName: userData.fullName,
          password: hashedPassword,
          emergencyContacts: userData.emergencyContact || [],
          medicalInfo: userData.medicalInfo || {},
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
        },
      });

      // 5. Generate token
      const token = this.generateToken(newUser.id);

      // 6. Log registration
      logger.info(`New user registered: ${newUser.email}`);

      // 7. Return token and user
      return { user: newUser, token };

    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  // -------------------------
  // Login a user
  // -------------------------
  async loginUser(loginData: LoginUserData): Promise<AuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: loginData.email },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          password: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new Error('Invalid email or password');
      }

      const isPasswordValid = await bcrypt.compare(loginData.password, user.password);

      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      const token = this.generateToken(user.id);

      logger.info(`User logged in: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
        },
        token,
      };

    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  // -------------------------
  // Verify JWT token
  // -------------------------
  async verifyToken(token: string): Promise<{ userId: string }> {
    try {
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) throw new Error('JWT_SECRET not set');

      const decoded = jwt.verify(token, JWT_SECRET) as any;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new Error('Invalid or expired token');
      }

      return { userId: user.id };

    } catch (error) {
      logger.error('Token verification failed:', error);
      throw new Error('Invalid or expired token');
    }
  }

  async updatedUserProfile(userId: string, updatedData: updateUserData) {
    try {
      const updateUser = await prisma.user.update({
      where: {id: userId},
      data: { 
        fullName: updatedData.fullName,
        phone: updatedData.phone,
        emergencyContacts: updatedData.emergencyContact? {set: updatedData.emergencyContact}
        : undefined,
        medicalInfo: updatedData.medicalInfo,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        emergencyContacts: true,
        medicalInfo: true
      },

    });
    logger.info(`User profile updated: ${updatedUser.email}`);
    return updateUser;
  }
     catch (error) {
    logger.error("Profile update failed:", error);
    }
  }
  
  // -------------------------
  // Generate JWT token
  // -------------------------
  private generateToken(userId: string): string {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) throw new Error('JWT_SECRET not set');

    return jwt.sign(
      { userId },
      JWT_SECRET,
      {
        expiresIn: '24h',
        issuer: 'TrackNest',
      }
    );
  }

  // -------------------------
  // Validate Registration Data
  // -------------------------
  private validateRegistrationData(userData: RegisterUserData): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Invalid email format');
    }

    if (!userData.phone || userData.phone.length < 10) {
      throw new Error('Phone number must be at least 10 digits');
    }

    if (!userData.password || userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!userData.fullName || userData.fullName.trim() === '') {
      throw new Error('Full name is required');
    }

    if (userData.emergencyContact && userData.emergencyContact.length > 5) {
      throw new Error('You can only have up to 5 emergency contacts');
    }

    if (userData.medicalInfo) {
      if (userData.medicalInfo.bloodType && userData.medicalInfo.bloodType.length < 2) {
        throw new Error('Blood type must be at least 2 characters long');
      }

      if (userData.medicalInfo.allergies && userData.medicalInfo.allergies.length > 10) {
        throw new Error('You can only have up to 10 allergies');
      }

      if (userData.medicalInfo.medications && userData.medicalInfo.medications.length > 10) {
        throw new Error('You can only have up to 10 medications');
      }
    }
  }
}
