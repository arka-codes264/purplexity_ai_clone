import type { Request, Response, NextFunction } from "express";
import { createSupabaseClient } from "./client";
import { prisma } from "./db";

// CRITICAL: This block allows TypeScript to recognize req.userId
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

const client = createSupabaseClient();

export async function middleware(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization;

    if (!token) {
        res.status(401).json({ message: "No token provided" });
        return;
    }

    const { data, error } = await client.auth.getUser(token);
    const userId = data.user?.id;

    if (error || !userId) {
        res.status(403).json({
            message: "Unauthorized or invalid token"
        });
        return;
    }

    let finalUserId = userId;

    try {
        const provider = data.user?.app_metadata?.provider === 'github' ? 'Github' : 'Google';
        const userEmail = data.user?.email || `no-email-${userId}@example.com`;
        const userName = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || data.user?.email || "Unknown";

        try {
            await prisma.user.upsert({
                where: { id: userId },
                update: { name: userName },
                create: {
                    id: userId,
                    email: userEmail,
                    provider: provider,
                    name: userName,
                }
            });
        } catch (e: any) {
            // Handle unique constraint violation on email
            if (e.code === 'P2002') {
                const existingUser = await prisma.user.findUnique({
                    where: { email: userEmail }
                });
                if (existingUser) {
                    finalUserId = existingUser.id;
                } else {
                    throw e;
                }
            } else {
                throw e;
            }
        }
    } catch (e) {
        console.error("Failed to sync user to database:", e);
    }

    // This line is required so that index.ts can access the user ID
    req.userId = finalUserId;
    next();
}

