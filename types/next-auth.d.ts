import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    username?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isAdmin: boolean;
      username?: string;
    } & DefaultSession['user'];
  }

  interface JWT {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    username?: string;
  }
}