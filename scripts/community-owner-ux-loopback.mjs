import assert from "node:assert/strict";
import http from "node:http";

const project = "mikke-community-owner-ux-20260910";
const network = `${project}-loopback`;
const dedicatedMountMarker = "mikke-community-owner-ux-runtime-20260910";
const expectedPorts = new Map([
  [`supabase_db_${project}`, "56322"],
  [`supabase_kong_${project}`, "56321"],
]);
let publishedServices = 0;

assert.equal(process.argv[2], "--fix-loopback");
assert.equal(process.env.COMMUNITY_OWNER_UX_LOOPBACK_CONFIRM, project);

function api(method, requestPath, body, expectedStatuses) {
  return new Promise((resolve, reject) => {
    const bytes = body ? Buffer.from(JSON.stringify(body)) : null;
    const request = http.request({
      socketPath: "//./pipe/dockerDesktopLinuxEngine",
      method,
      path: `/v1.55${requestPath}`,
      headers: bytes ? { "Content-Type": "application/json", "Content-Length": bytes.length } : {},
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        if (!expectedStatuses.includes(response.statusCode)) {
          reject(new Error(`${method} ${requestPath} failed with HTTP ${response.statusCode}; body omitted`));
          return;
        }
        const raw = Buffer.concat(chunks).toString();
        resolve({ status: response.statusCode, data: raw ? JSON.parse(raw) : null });
      });
    });
    request.setTimeout(60_000, () => request.destroy(new Error(`${method} ${requestPath} timed out`)));
    request.on("error", reject);
    request.end(bytes);
  });
}

function archiveApi(method, requestPath, body, expectedStatuses) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      socketPath: "//./pipe/dockerDesktopLinuxEngine",
      method,
      path: `/v1.55${requestPath}`,
      headers: body ? { "Content-Type": "application/x-tar", "Content-Length": body.length } : {},
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        if (!expectedStatuses.includes(response.statusCode)) {
          reject(new Error(`${method} ${requestPath} failed with HTTP ${response.statusCode}; body omitted`));
          return;
        }
        resolve({ status: response.statusCode, data: Buffer.concat(chunks) });
      });
    });
    request.setTimeout(60_000, () => request.destroy(new Error(`${method} ${requestPath} timed out`)));
    request.on("error", reject);
    request.end(body);
  });
}

async function inspect(name) {
  return (await api("GET", `/containers/${name}/json`, null, [200])).data;
}

const filters = encodeURIComponent(JSON.stringify({ label: [`com.supabase.cli.project=${project}`] }));
const listed = (await api("GET", `/containers/json?all=true&filters=${filters}`, null, [200])).data;
assert.ok(listed.length >= 5, "The dedicated Supabase project is incomplete");
const names = listed.flatMap((item) => item.Names.map((name) => name.replace(/^\//, "")));
for (const expectedName of expectedPorts.keys()) assert.ok(names.includes(expectedName), `${expectedName} is missing`);

for (const name of names) {
  const container = await inspect(name);
  assert.equal(container.Config.Labels["com.supabase.cli.project"], project);
  assert.equal(container.State.Running, true);
  assert.equal(container.HostConfig.NetworkMode, network);
  assert.deepEqual(Object.keys(container.NetworkSettings.Networks), [network]);

  const portKeys = Object.keys(container.HostConfig.PortBindings ?? {});
  if (portKeys.length === 0) continue;
  publishedServices += 1;
  const bindings = Object.values(container.HostConfig.PortBindings).flat();
  assert.ok(bindings.length > 0 && bindings.every((binding) => /^\d{2,5}$/.test(binding.HostPort)));
  if (expectedPorts.has(name)) {
    assert.equal(portKeys.length, 1, `${name} must publish exactly one port`);
    assert.ok(bindings.every((binding) => binding.HostPort === expectedPorts.get(name)));
  }
  const published = Object.values(container.NetworkSettings.Ports ?? {}).filter(Boolean).flat();
  if (published.length > 0 && published.every((binding) => binding.HostIp === "127.0.0.1")) continue;

  for (const mount of container.Mounts) {
    if (mount.Type === "volume") {
      assert.ok(container.HostConfig.Binds.some((binding) => binding.startsWith(`${mount.Name}:${mount.Destination}`)));
      continue;
    }
    assert.equal(mount.Type, "bind", `${name} has an unsupported mount type`);
    assert.ok(mount.Source.toLowerCase().includes(dedicatedMountMarker), `${name} bind mount is outside the dedicated runtime`);
    assert.ok(container.HostConfig.Binds.some((binding) => binding.includes(mount.Destination)));
  }
  for (const binding of bindings) binding.HostIp = "127.0.0.1";
  const backup = `${name}-initial-port-binding`;
  assert.equal((await api("GET", `/containers/${backup}/json`, null, [200, 404])).status, 404);
  await api("POST", `/containers/${name}/stop?t=10`, null, [204, 304]);
  await api("POST", `/containers/${name}/rename?name=${backup}`, null, [204]);
  await api("POST", `/containers/create?name=${name}`, {
    ...container.Config,
    HostConfig: container.HostConfig,
    NetworkingConfig: {
      EndpointsConfig: {
        [network]: { Aliases: container.NetworkSettings.Networks[network].Aliases },
      },
    },
  }, [201]);
  if (name.includes("_kong_")) {
    for (const certificate of ["localhost.crt", "localhost.key"]) {
      const archive = await archiveApi("GET", `/containers/${backup}/archive?path=${encodeURIComponent(`/home/kong/${certificate}`)}`, null, [200, 404]);
      if (archive.status === 200) {
        await archiveApi("PUT", `/containers/${name}/archive?path=${encodeURIComponent("/home/kong")}`, archive.data, [200]);
      }
    }
  }
  await api("POST", `/containers/${name}/start`, null, [204, 304]);
  let rebound;
  for (let attempt = 0; attempt < 60; attempt++) {
    rebound = await inspect(name);
    if (rebound.State.Running && (!rebound.State.Health || rebound.State.Health.Status === "healthy")) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(rebound.State.Running && (!rebound.State.Health || rebound.State.Health.Status === "healthy"), `${name} did not become healthy`);
  assert.deepEqual(
    rebound.Mounts.map((mount) => [mount.Name, mount.Destination]).sort(),
    container.Mounts.map((mount) => [mount.Name, mount.Destination]).sort(),
  );
  assert.ok(Object.values(rebound.NetworkSettings.Ports).filter(Boolean).flat().every((binding) => binding.HostIp === "127.0.0.1"));
  await api("DELETE", `/containers/${backup}?v=false&force=false`, null, [204]);
}

for (const name of names) {
  const container = await inspect(name);
  const published = Object.values(container.NetworkSettings.Ports ?? {}).filter(Boolean).flat();
  assert.ok(published.every((binding) => binding.HostIp === "127.0.0.1"), `${name} is not loopback-only`);
  if (expectedPorts.has(name)) {
    assert.ok(published.length > 0 && published.every((binding) => binding.HostPort === expectedPorts.get(name)), `${name} lost its required published port`);
  }
}

console.log(JSON.stringify({ result: "community_owner_ux_loopback_ok", project, services: names.length, publishedServices }));
