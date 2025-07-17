import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from './mongodb';
import User from '@/models/User';
import InviteCode from '@/models/InviteCode';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        inviteCode: { label: 'Invite Code', type: 'text' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        await dbConnect();

        // Check if user exists
        const existingUser = await User.findOne({ email: credentials.email }).select('+password');

        if (existingUser) {
          // Login flow
          const isValid = await existingUser.comparePassword(credentials.password);
          if (!isValid) {
            throw new Error('Invalid email or password');
          }

          return {
            id: existingUser._id.toString(),
            email: existingUser.email,
            name: existingUser.name,
            isAdmin: existingUser.isAdmin,
          };
        } else {
          // Registration flow - requires invite code
          if (!credentials.inviteCode || !credentials.name) {
            throw new Error('Invite code and name are required for registration');
          }

          // Validate invite code
          const inviteCode = await InviteCode.findOne({ 
            code: credentials.inviteCode.toUpperCase(),
            isActive: true,
            usedBy: null,
            expiresAt: { $gt: new Date() }
          });

          if (!inviteCode) {
            throw new Error('Invalid or expired invite code');
          }

          // Create new user
          const newUser = await User.create({
            email: credentials.email,
            password: credentials.password,
            name: credentials.name,
            inviteCodeUsed: inviteCode.code,
            isAdmin: false,
          });

          // Mark invite code as used
          inviteCode.usedBy = newUser.email;
          inviteCode.isActive = false;
          await inviteCode.save();

          return {
            id: newUser._id.toString(),
            email: newUser.email,
            name: newUser.name,
            isAdmin: newUser.isAdmin,
          };
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update' && session) {
        token = { ...token, ...session };
      }
      
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.isAdmin = user.isAdmin;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          isAdmin: token.isAdmin as boolean,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};