import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isAdmin: boolean;
    } & DefaultSession['user'];
  }

  interface JWT {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
  }
}