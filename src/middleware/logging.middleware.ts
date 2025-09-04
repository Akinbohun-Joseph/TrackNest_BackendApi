import morgan from "morgan";
import fs from "fs";
import path from "path";
import { stream } from "winston";

//Create a write stream (append mode) for logs
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, "../../logs/access.log"),
    {flags: "a"}
);
//Morgan middleware setup
export const logger = morgan ("combined,"{stream: accessLogStream});

export const devLogger = morgan("dev");