import prisma from "../config/prisma";

export interface LocationData {
  latitude: number;
  longitude: number;
}
// Create a new location
export const createLocation = async (data: LocationData) => {
  return await prisma.location.create({
    data,
  });
};
// Get a location by Id
export const getLocationById = async (id: string) => {
  return await prisma.location.findUnique({
    where: { id },
  });
};
// Get all location
export const getAllLocation = async () => {
  return await prisma.location.findMany();
};
// Update a location
export const updateLocation = async (id: string, data: Partial<Location>) => {
  return await prisma.location.update({
    where: { id },
    data,
  });
};
// Delete a location
export const deleteLocation = async (id: string) => {
  return await prisma.location.delete({
    where: { id },
  });
};

export default prisma;
