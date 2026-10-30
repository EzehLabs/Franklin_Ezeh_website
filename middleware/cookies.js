export function parseCookies(request, response, next) {
  const cookies = Object.create(null);
  const header = request.headers.cookie;

  if (header) {
    for (const part of header.split(";")) {
      const separator = part.indexOf("=");
      if (separator < 0) continue;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (name && cookies[name] === undefined) cookies[name] = value;
    }
  }

  request.cookies = cookies;
  next();
}
