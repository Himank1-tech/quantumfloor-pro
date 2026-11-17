import { betterAuth } from "better-auth";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export const auth = betterAuth({
  database: new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "gh_oauth_client_id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "gh_oauth_client_secret",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "google_oauth_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "google_oauth_client_secret",
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || "32935f1a6d7d088b9ce37ba714b4dbf87975f939713c12b834d3b2d324025748",
  baseURL: process.env.BETTER_AUTH_URL || "https://quantumfloor-pro.onrender.com",
});
