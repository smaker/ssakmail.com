import "next-auth";

declare module "next-auth" {
  interface Session {
    gmail: {
      connected: boolean;
      error?: "RefreshAccessTokenError";
    };
  }
}
