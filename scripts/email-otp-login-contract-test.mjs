import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loginPage = await readFile(path.join(root, "app/login/page.tsx"), "utf8");

assert.match(loginPage, /signInWithOtp\(\{[\s\S]*shouldCreateUser: false/);
assert.match(loginPage, /pendingCodePurpose === "login" \? "email" : "signup"/);
assert.match(loginPage, /signInWithPassword/);
assert.match(loginPage, /type: "signup"/);
assert.match(loginPage, /確認番号でログイン/);
assert.doesNotMatch(loginPage, /shouldCreateUser: true/);

console.log("email OTP login contract: ok");
