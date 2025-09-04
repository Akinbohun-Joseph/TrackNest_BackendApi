import cors from 'cors';

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",   // Dev frontend
  process.env.FRONTEND_PROD_URL || "https://tracknest.com", // Prod frontend
];
export const corsOptions = {
    origin: (origin, callback) => {
        if(!origin || allowedOrigins.includes(origin)){
            callback(null, true); // allow request
        } else {
            callback(new Error("Not allowed by CORS")); // BLOCK REQUEST
        }
    },
    credentials: true, // allow cookies/auth headers
};
