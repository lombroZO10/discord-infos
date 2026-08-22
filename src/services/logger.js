import { createLogger, format, transports } from "winston";

export function setupLogger() {
    return createLogger({
        format: format.combine(
            format.timestamp({ format: "HH:mm:ss DD-MM-YYYY" }),
            format.printf(({ timestamp, level, message }) => {
                return `[${timestamp}]: ${message}`;
            })
        ),
        transports: [
            new transports.File({ filename: "./logs/app.log" }),
            new transports.Console()
        ]
    });
}
