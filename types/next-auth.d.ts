import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      planId?: number | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    openid?: string;
    planId?: number | null;
  }
}
