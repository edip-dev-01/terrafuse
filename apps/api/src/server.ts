import cors from "cors";
import express from "express";
import { prototypeCapabilities } from "@terrafuse/core";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "terrafuse-api" });
});

app.get("/api/capabilities", (_request, response) => {
  response.json(prototypeCapabilities);
});

app.post("/api/workspaces", (request, response) => {
  const name = typeof request.body?.name === "string" ? request.body.name : "Untitled TerraFuse workspace";
  response.status(201).json({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    status: "prototype-local"
  });
});

app.listen(port, () => {
  console.log(`TerraFuse API listening on http://localhost:${port}`);
});
