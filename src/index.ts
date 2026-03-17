import fastify, { FastifyInstance } from "fastify";
import dotenv from "dotenv";

dotenv.config();

const app: FastifyInstance = fastify();

const portEnv: string | undefined = process.env.PORT;
const port: number = portEnv ? Number(portEnv) : 4000;

void app.get("/health", async () => {
  return { status: "ok" };
});

void app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    console.log(`Server is running on port ${port}`);
  })
  .catch((error: unknown) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
