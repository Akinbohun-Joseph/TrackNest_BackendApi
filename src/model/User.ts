import prisma from '../config/prisma'
export const createUser = async (data: {
  fullName: string;
  email: string;
  passwordHash: string;
  phone: string;
  isActive?: boolean;
  // emergencyContacts?: EmergencyContact[];
  // medicalInfo?: MedicalInfo;

}) => {
  return await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      password: data.passwordHash,
      phone: data.phone,
      isActive: data.isActive,
    }
  })
};