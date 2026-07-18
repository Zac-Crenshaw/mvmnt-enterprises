// Vercel Serverless Function — thin proxy from the public calculator to the
// CRM intake endpoint. Its only job is to attach the shared INTAKE_SECRET
// server-side so the secret is never exposed in the browser/static HTML.
//
// CommonJS on purpose: this repo has no package.json, so Vercel's Node runtime
// treats .js as CommonJS. Global fetch is available on Node 18+.

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const secret = process.env.INTAKE_SECRET;
  const url =
    process.env.CRM_INTAKE_URL || "https://crm.mvmntenterprises.com/api/intake/calculator";

  // Misconfigured env — respond quietly. The client fires-and-forgets and
  // ignores the response, so there's no reason to surface a 500.
  if (!secret) return res.status(204).end();

  try {
    // Vercel parses JSON bodies; forward the raw shape either way.
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-intake-secret": secret },
      body,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ error: "proxy failed" });
  }
};
