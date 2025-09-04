import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient();

export interface EmergencyContactData {
    name: string;
    phone: string;
    email?: string; 
    relationship: string; 
    priority?: number;
    isActive?: boolean;
    userId: string;
}
//Create  a new emergency contact
export const createEmergencyContact = async (data: EmergencyContactData) => {
    return await prisma.emergencyContact.create({
        data,
    });
};

//Get all emergency contacts for a user
export const getEmergencyContactsByUser =async(userId: string) => {
    return await prisma.emergencyContact.findMany({
        where: {userId},
    });
};

//Update an emergency contact
export const updateEmergencyContact = async (
    id: string,
    data: Partial<EmergencyContactData>
) => {
    return await prisma.emergencyContact.update({
        where: {id},
        data,
    });
};
//Delete emergency contact 
export const deleteEmergencyContact = async (id: string) => {
    return await prisma.emergencyContact.delete({
        where: {id},
    });
};

export default prisma;