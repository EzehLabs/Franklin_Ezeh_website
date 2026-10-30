export function verifyRequestOrigin(request, response, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  if (request.get("sec-fetch-site") === "cross-site") {
    response.status(403).json({ error: "Cross-origin request rejected." });
    return;
  }

  const origin = request.get("origin");
  const allowedOrigin = process.env.APP_ORIGIN
    ? new URL(process.env.APP_ORIGIN).origin
    : undefined;
  if (origin && origin !== allowedOrigin) {
    response.status(403).json({ error: "Request origin is not allowed." });
    return;
  }
  next();
}
