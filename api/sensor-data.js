const { getTelemetry, ingestTelemetry } = require("../dist/services/telemetryService.js");

module.exports = function sensorDataHandler(req, res) {
  if (req.method === "GET") {
    const query = req.query || {};
    const requestedLimit = Number(query.limit);
    const limit = Math.min(Math.max(requestedLimit || 50, 1), 1000);
    const nodeId = typeof query.node_id === "string" ? query.node_id : undefined;
    res.status(200).json(getTelemetry(nodeId, limit));
    return;
  }

  if (req.method === "POST") {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!payload || typeof payload !== "object") {
      res.status(400).json({ error: "Missing JSON payload" });
      return;
    }

    const record = ingestTelemetry(payload);
    res.status(200).json({
      status: "success",
      message: "Sensor telemetry received and processed",
      received: record,
      diagnostics: record.diagnostics,
    });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
};
