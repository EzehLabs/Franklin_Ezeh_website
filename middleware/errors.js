export function notFound(request, response) {
  response.status(404).json({ error: "Not found." });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  console.error("Request failed", {
    method: request.method,
    path: request.path,
    error: error.message,
  });

  if (error.name === "ZodError") {
    response.status(400).json({
      error: "Invalid request.",
      details: error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
    });
    return;
  }

  if (error.type === "entity.parse.failed") {
    response.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }

  if (error.code === "23505") {
    response.status(409).json({ error: "That record already exists." });
    return;
  }

  const statusCode = error.statusCode ?? 500;
  response.status(statusCode).json({
    error: statusCode < 500 ? error.message : "An unexpected server error occurred.",
  });
}
