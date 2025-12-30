import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateUserId } from "./utils";

export const getUserByEmail = async (email: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
      select: {
        name: true,
        emailVerified: true,
      },
    });

    return user;
  } catch {
    return null;
  }
};

export const getUserById = async (id: string) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });

    return user;
  } catch {
    return null;
  }
};

export async function createUserWithCustomId(data: Prisma.UserCreateInput) {
  if (!data.email || data.email.trim() === '') {
    throw new Error('Email is required and cannot be empty');
  }

  const maxAttempts = 6;
  for (let i = 0; i < maxAttempts; i++) {
    const userId = generateUserId(8 + Math.floor(i / 2), true);

    try {
      const user = await prisma.user.create({
        data: {
          ...data,
          id: userId,
        },
      });
      return user;
    } catch (error) {
      if ((error as any).code === 'P2002') {
        console.log(`createUserWithCustomId: Duplicate ID detected, retrying... Attempt ${i + 1}`);
        continue;
      } else {
        console.error("createUserWithCustomId: Error occurred", error);
        throw error;
      }
    }
  }

  console.log("All attempts failed, using default as userId");
  return prisma.user.create({
    data: {
      ...data,
      // id: crypto.randomUUID(),
      id: generateUserId(16, true),
    },
  });
}