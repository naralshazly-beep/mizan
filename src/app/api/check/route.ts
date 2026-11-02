import type { NextRequest } from "next/server";
import { SITES, USERNAME_RE, fill } from "@/lib/sites";

export type CheckStatus = "found" | "not_found" | "unknown";

export type CheckResult = {
  site: string;
  status: CheckStatus;
  url: string;
  httpStatus?: number;
  reason?: string;
};

const TIMEOUT_MS = 10_000;
const MAX_BODY = 512 * 1024;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Bot-protection pages that come back as HTTP 200 but say nothing about the user. */
const CHALLENGE_MARKERS = [
  "<title>Client Challenge",
  "<title>Just a moment",
  "<title>Attention Required",
  "cf-browser-verification",
  "captcha-delivery.com",
];

function isChallenge(body: string): boolean {
  return CHALLENGE_MARKERS.some((m) => body.includes(m));
}

/** Redirects to these pages tell us nothing about whether the user exists. */
const GATE_REDIRECT = /consent\.|\/consent|login|signin|sign_in|accounts\.|captcha|challenge/i;

async function readBody(res: Response): Promise<string> {
  const text = await res.text();
  return text.length > MAX_BODY ? text.slice(0, MAX_BODY) : text;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const siteId = params.get("site") ?? "";
  const username = (params.get("username") ?? "").trim();

  const site = SITES.find((s) => s.id === siteId);
  if (!site) {
    return Response.json({ error: "unknown site" }, { status: 400 });
  }
  if (!USERNAME_RE.test(username)) {
    return Response.json({ error: "invalid username" }, { status: 400 });
  }

  const url = fill(site.url, username);
  const probe = fill(site.probe ?? site.url, username);
  const result: CheckResult = { site: site.id, status: "unknown", url };

  try {
    const res = await fetch(probe, {
      headers: { ...HEADERS, ...site.headers },
      // Most "user doesn't exist" pages redirect somewhere else, so a
      // redirect counts as "not found" for status-based checks.
      redirect: site.check.type === "status" ? "manual" : "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    result.httpStatus = res.status;

    if (site.check.type === "status") {
      if (res.status === 200) {
        if (isChallenge(await readBody(res))) result.reason = "bot check";
        else result.status = "found";
      }
      else if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location") ?? "";
        if (GATE_REDIRECT.test(location)) result.reason = "redirected to consent/login page";
        else result.status = "not_found";
      } else if (res.status === 404 || res.status === 410) result.status = "not_found";
      else result.reason = `HTTP ${res.status}`;
    } else if (res.status === 429 || res.status === 403 || res.status >= 500) {
      result.reason = `HTTP ${res.status}`;
    } else {
      const body = await readBody(res);
      if (isChallenge(body)) {
        result.reason = "bot check";
        return Response.json(result);
      }
      const has = body.includes(site.check.text);
      if (site.check.type === "found") {
        result.status = has ? "found" : "not_found";
      } else {
        result.status = has || res.status === 404 ? "not_found" : "found";
      }
    }
  } catch (err) {
    result.reason =
      err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network error";
  }

  return Response.json(result, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
