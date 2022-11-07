import { z } from "zod";
import { prisma } from "../lib/prisma";
import { FastifyInstance } from "fastify";
import { authenticate } from "../plugins/authenticate";

export async function authRoutes(fastify: FastifyInstance) {
    fastify.get('/me', { onRequest: [authenticate] },
        async (request) => {
            return { user: request.user }
        }
    );

    fastify.post("/users", async (request, reply) => {
        const validation = z.object({
            access_token: z.string(),
        });

        const { access_token } = validation.parse(request.body);

        console.log(access_token);

        const fetch = require('node-fetch')
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${access_token}`,
                'content-type': 'application/json'
            }
        });

        const userData = await userResponse.json();

        const userInfoSchema = z.object({
            id: z.string(),
            name: z.string(),
            picture: z.string().url(),
            email: z.string().email(),
        });

        const userInfo = userInfoSchema.parse(userData);

        let user = await prisma.user.findUnique({ where: { googleId: userInfo.id } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: userInfo.name,
                    email: userInfo.email,
                    googleId: userInfo.id,
                    avatarUrl: userInfo.picture,
                }
            });
        }

        const token = fastify.jwt.sign({
            name: user.name,
            avatarUrl: user.avatarUrl
        }, {
            sub: user.id,
            expiresIn: '7 days',
        });

        return { token };
    });
}