import dotenv from "dotenv";
import {
  STATE_SERVICE_DEFAULT_PORT,
  STATE_SERVICE_HEALTH_PATH,
  STATE_SERVICE_HOST,
} from "./state-service.constants";
import { createStateServiceApp } from "./state-service.server";

function getStateServicePort(): number {
  const portEnv = process.env.STATE_SERVICE_PORT;
  const port = portEnv ? Number(portEnv) : STATE_SERVICE_DEFAULT_PORT;
  if (!Number.isFinite(port) || port <= 0) return STATE_SERVICE_DEFAULT_PORT;
  return port;
}

async function startStateService(): Promise<void> {
  dotenv.config();
  const app = createStateServiceApp();
  const port = getStateServicePort();

  await app.listen({ port, host: STATE_SERVICE_HOST });
  console.log(
    `State service is running on ${STATE_SERVICE_HOST}:${port} (${STATE_SERVICE_HEALTH_PATH})`,
  );
}

void startStateService().catch((error: unknown) => {
  console.error("Failed to start state service", error);
  process.exit(1);
});
