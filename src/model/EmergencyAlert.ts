import prisma from "../config/prisma";

export interface EmergencyAlertData {
  type: string; // e.g., 'medical' , 'fire' , 'police'
  message?: string;
  userId: string; 
  isActive?: boolean; 
  status?: string; // e.g., 'pending', 'resolved'
  
  //createdAt?: Date;
  //updatedAt?: Date;
}
// Create a new emergency alert
export const createEmergencyAlert = async (data: EmergencyAlertData) => {
  return await prisma.alert.create({
    data: {
    isActive: data.isActive ?? true,
    type: data.type,
    message: data.message,
    status: data.status || "pending",
    user: { connect: { id: data.userId } }
  }
});

};
//Get all alerts for a user
export const getEmergencyAlertsById = async (userId: string) => {
  return await prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};
// Mark an alert as resolved 
export const resolvedEmergencyAlert = async (id: string) => {
  return await prisma.alert.update({
    where: { id },
    data: { isActive: false },
  });
};

// Get all active alerts
export const getAllActiveAlerts = async () => {
  return await prisma.alert.findMany({
    where: { isActive: true},
    orderBy: { createdAt: 'desc' },
  })
}
  //Delete an alert
  export const deleteEmergencyAlert = async (id: string) => {
    return await prisma.alert.delete({
      where: {id}
    })
  }