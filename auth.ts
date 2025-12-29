import NextAuth, { AuthOptions, DefaultSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { PrismaAdapter } from "@auth/prisma-adapter";
import { generateUserId } from "./lib/utils";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
    } & DefaultSession["user"];
  }
}

export const authOptions: AuthOptions = {
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: async (data) => {
      // console.log("default createUser", data);

      if (!data.email || data.email.trim() === '') {
        throw new Error('Email is required and cannot be empty');
      }

      const maxAttempts = 3;
      for (let i = 0; i < maxAttempts; i++) {
        const userId = generateUserId(data.email, 8+i, true);

        try {
          // 长度随重试增加: 8 -> 9 -> 10
          return await prisma.user.create({
            data: {
              ...data,
              id: userId,
            },
          });
          // console.log("User created successfully:", user);
          // return user;
        } catch (error) {
          if ((error as any).code === 'P2002') {
            console.log(`CreateUser: Duplicate ID detected, retrying... Attempt ${i + 1}`);
            continue;
          } else {
            console.error("CreateUser: Error occurred", error);
            throw error;
          }
        }
      }

      console.log("All attempts failed, using cuid as userId");
      return prisma.user.create({
        data: {
          ...data,
          // id: crypto.randomUUID(),
          id: generateUserId(data.email, 16, true),
        },
      });
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (!isPasswordValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // This callback is called whenever a JWT is created or updated.
      // `user` is only available on sign-in.
      if (user) {
        token.name = user.name
      }

      // `session` is only available when the `update` trigger is used.
      if (trigger === "update" && session?.name) {
        token.name = session.name
      }

      return token
    },
    async session({ session, token }) {
      // We are adding the user's name from the token to the session object.
      if (session.user) {
        if (token.name) {
          session.user.name = token.name as string
        }
        if (token.sub) {
          session.user.id = token.sub
        }
      }

      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }