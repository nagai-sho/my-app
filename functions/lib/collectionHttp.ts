export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}
export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Authentication required"): Response {
  return json({ error: message }, { status: 401 });
}

export function forbidden(message = "Access denied"): Response {
  return json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found"): Response {
  return json({ error: message }, { status: 404 });
}

export function methodNotAllowed(allow: string): Response {
  return json(
    { error: "Method not allowed" },
    { status: 405, headers: { allow } },
  );
}

export function internalError(requestId?: string): Response {
  return json(
    {
      error: "Internal server error",
      ...(requestId ? { request_id: requestId } : {}),
    },
    { status: 500 },
  );
}
