// Runs against an isolated temporary database, never the real catalogue.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = await mkdtemp(path.join(tmpdir(), "halici-test-"));
const dotnet = process.env.DOTNET_EXE || "dotnet";
const base = "http://127.0.0.1:5091";
const password = randomBytes(20).toString("hex");
let server,
  output = "",
  checks = 0,
  cookies = new Map(),
  token;
async function start() {
  server = spawn(
    dotnet,
    [
      path.join(root, "src/Halici.Web/bin/Debug/net10.0/Halici.Web.dll"),
      "--urls",
      base,
    ],
    {
      cwd: path.join(root, "src/Halici.Web"),
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: "Development",
        DataDirectory: data,
        Admin__Username: "testadmin",
        Admin__Password: password,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (b) => (output += b));
  server.stderr.on("data", (b) => (output += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch {}
    if (server.exitCode !== null) throw Error(output);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Server did not start: " + output);
}
async function stop() {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once("exit", r));
  }
}
async function req(url, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Cookie", [...cookies].map(([k, v]) => `${k}=${v}`).join("; "));
  if (token && options.method) headers.set("X-CSRF-TOKEN", token);
  const response = await fetch(base + url, { ...options, headers });
  for (const c of response.headers.getSetCookie()) {
    const first = c.split(";")[0],
      i = first.indexOf("=");
    cookies.set(first.slice(0, i), first.slice(i + 1));
  }
  return response;
}
async function csrf() {
  token = (await (await req("/api/csrf")).json()).token;
}
function check(value, message) {
  assert.ok(value, message);
  checks++;
  console.log("PASS " + message);
}
function productForm(input, files = []) {
  const body = new FormData();
  body.set("data", JSON.stringify(input));
  for (const f of files) body.append("photos", f.blob, f.name);
  return body;
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=",
  "base64",
);
const photo = {
  blob: new Blob([png], { type: "image/png" }),
  name: "test.png",
};
try {
  await start();
  check((await req("/")).status === 200, "Public catalogue loads");
  check(
    (await req("/api/products")).headers.get("Cache-Control") === "no-store",
    "Catalogue API avoids stale cache",
  );
  check(
    (await req("/api/admin/products/0", { method: "POST" })).status === 401,
    "Anonymous write is blocked",
  );
  check(
    (
      await req("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testadmin", password }),
      })
    ).status === 400,
    "Login without CSRF is blocked",
  );
  await csrf();
  check(
    (
      await req("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testadmin", password: "wrong" }),
      })
    ).status === 401,
    "Wrong password is rejected",
  );
  check(
    (
      await req("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testadmin", password }),
      })
    ).status === 200,
    "Administrator can sign in",
  );
  await csrf();
  check(
    (await (await req("/api/auth/me")).json()).authenticated,
    "Authentication cookie is active",
  );
  const input = {
    name: "Test kilim",
    type: "Kilim",
    width: 160,
    length: 230,
    material: "Yün",
    description: "Test açıklaması",
    available: true,
    keepPhotos: [],
  };
  check(
    (
      await req("/api/admin/products/0", {
        method: "POST",
        body: productForm(input),
      })
    ).status === 400,
    "A photo is required",
  );
  check(
    (
      await req("/api/admin/products/0", {
        method: "POST",
        body: productForm({ ...input, width: -1 }, [photo]),
      })
    ).status === 400,
    "Invalid dimensions are rejected",
  );
  const invalid = {
    blob: new Blob(["<script>alert(1)</script>"], { type: "image/png" }),
    name: "fake.png",
  };
  check(
    (
      await req("/api/admin/products/0", {
        method: "POST",
        body: productForm(input, [photo, invalid]),
      })
    ).status === 400,
    "Disguised HTML upload is rejected",
  );
  const { readdir } = await import("node:fs/promises");
  check(
    (await readdir(path.join(data, "uploads"))).length === 0,
    "Failed batch leaves no uploaded files",
  );
  const createdResponse = await req("/api/admin/products/0", {
    method: "POST",
    body: productForm(input, [photo, photo]),
  });
  check(createdResponse.status === 200, "Multiple photos can be uploaded");
  let rug = await createdResponse.json();
  check(rug.photos.length === 2, "Both photos persist");
  const oldUrl = rug.photos[0].url;
  check(
    (await req(oldUrl)).headers.get("Content-Type").startsWith("image/png"),
    "Photo is served with an image content type",
  );
  check(
    (
      await req("/api/admin/products/" + rug.id, {
        method: "POST",
        body: productForm({
          ...input,
          keepPhotos: [{ url: "/uploads/not-owned.png" }],
        }),
      })
    ).status === 400,
    "Foreign photo references are rejected",
  );
  rug = await (
    await req("/api/admin/products/" + rug.id, {
      method: "POST",
      body: productForm(
        {
          ...input,
          name: "Düzenlenen kilim",
          available: false,
          keepPhotos: rug.photos,
          photoOrder: [2, 1, 0],
        },
        [photo],
      ),
    })
  ).json();
  check(
    rug.photos.length === 3 &&
      rug.photos[2].url === oldUrl &&
      rug.name === "Düzenlenen kilim" &&
      !rug.available,
    "Edit, status and mixed photo ordering persist atomically",
  );
  await stop();
  await start();
  const persisted = (await (await req("/api/products")).json()).find(
    (p) => p.id === rug.id,
  );
  check(
    persisted?.name === rug.name && persisted.photos.length === 3,
    "Database and photos survive a restart",
  );
  const removed = rug.photos[1].url;
  rug = await (
    await req("/api/admin/products/" + rug.id, {
      method: "POST",
      body: productForm({ ...input, keepPhotos: [rug.photos[0]] }),
    })
  ).json();
  check(
    rug.photos.length === 1 && (await req(removed)).status === 404,
    "Removed photos are cleaned up",
  );
  check(
    (await req("/api/admin/products/" + rug.id, { method: "DELETE" }))
      .status === 204,
    "Administrator can delete a product",
  );
  check(
    (await req(rug.photos[0].url)).status === 404,
    "Delete cleans up uploaded photo",
  );
  const all = await (await req("/api/products")).json();
  for (const p of all)
    await req("/api/admin/products/" + p.id, { method: "DELETE" });
  await stop();
  await start();
  check(
    (await (await req("/api/products")).json()).length === 0,
    "Deleting all products does not reseed them on restart",
  );
  check(
    (await req("/api/auth/logout", { method: "POST" })).status === 204,
    "Administrator can sign out",
  );
  check(
    (await req("/api/admin/products/1", { method: "DELETE" })).status === 401,
    "Signed-out users cannot mutate products",
  );
  console.log(`\n${checks} checks passed.`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await stop();
  await rm(data, { recursive: true, force: true });
}
