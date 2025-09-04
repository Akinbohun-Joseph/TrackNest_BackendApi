// src/utils/logger.ts
import { createLogger, format, transports } from "winston";

const logger = createLogger({
  level: "info", // default log level
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(
      (info) => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`
    )
  ),
  transports: [
    new transports.Console(), // log to console
    new transports.File({ filename: "logs/error.log", level: "error" }), // log errors
    new transports.File({ filename: "logs/combined.log" }), // log everything
  ],
});

export default logger; 
