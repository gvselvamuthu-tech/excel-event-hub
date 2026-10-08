const http = require("node:http");
const mongoose = require("mongoose");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const apiHandler = require("../api/index");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const Payment = require("../models/Payment");

function makeRequest(server, { method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        method,
        path,
        headers: {
          ...headers,
          ...(body ? { "Content-Type": "application/json" } : {})
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buffer.toString("utf8"));
          } catch (e) {}
          resolve({ status: res.statusCode, headers: res.headers, buffer, json });
        });
      }
    );
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runLocalTests() {
  console.log("=== Starting Local Integration Tests for Vercel API Handler ===");

  const server = http.createServer((req, res) => {
    apiHandler(req, res);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  try {
    // 1. Admin Login
    console.log("Test 1: Admin Login...");
    const loginRes = await makeRequest(server, {
      method: "POST",
      path: "/api/admin/verify",
      body: { username: "admin", password: "Admin@123" }
    });
    if (loginRes.status !== 200 || !loginRes.json?.verified) {
      throw new Error(`Admin login failed: ${JSON.stringify(loginRes.json)}`);
    }
    console.log("✔ Admin login passed.");

    // 2. GET events
    console.log("Test 2: GET /api/events...");
    const getEventsRes = await makeRequest(server, {
      method: "GET",
      path: "/api/events"
    });
    if (getEventsRes.status !== 200 || !Array.isArray(getEventsRes.json?.technical)) {
      throw new Error(`GET /api/events failed: ${JSON.stringify(getEventsRes.json)}`);
    }
    const techCount = getEventsRes.json.technical.length;
    const nonTechCount = getEventsRes.json.nonTechnical.length;
    console.log(`✔ GET /api/events returned ${techCount} technical and ${nonTechCount} non-technical events.`);

    // 3. Admin Event Edit / Save
    console.log("Test 3: Admin event edit / PUT /api/events...");
    const sampleEvent = getEventsRes.json.technical.find(e => String(e.status || "Open").toLowerCase() !== "closed") || getEventsRes.json.technical[0];
    const originalDesc = sampleEvent.description || "";
    sampleEvent.description = originalDesc + " [verified]";
    const putEventsRes = await makeRequest(server, {
      method: "PUT",
      path: "/api/events",
      body: getEventsRes.json
    });
    if (putEventsRes.status !== 200) {
      throw new Error(`PUT /api/events failed: ${JSON.stringify(putEventsRes.json)}`);
    }
    // Revert back
    sampleEvent.description = originalDesc;
    await makeRequest(server, { method: "PUT", path: "/api/events", body: getEventsRes.json });
    console.log("✔ Admin event edit and revert passed.");

    // 4. Payment QR Generation
    console.log("Test 4: GET /api/events/:eventId/payment-qr...");
    const qrRes = await makeRequest(server, {
      method: "GET",
      path: `/api/events/${encodeURIComponent(sampleEvent.id)}/payment-qr`
    });
    if (qrRes.status !== 200 || qrRes.headers["content-type"] !== "image/png" || qrRes.buffer.length < 100) {
      throw new Error(`Payment QR failed: status ${qrRes.status}`);
    }
    console.log(`✔ Payment QR generated successfully (${qrRes.buffer.length} bytes).`);

    // 5. Registration Submission
    console.log("Test 5: POST /api/registrations...");
    const testRegRef = `TEST-REG-${Date.now()}`;
    const regPayload = {
      referenceId: testRegRef,
      eventId: sampleEvent.id,
      eventName: sampleEvent.title,
      fullName: "Test Participant",
      email: "test@example.com",
      mobile: "9876543210",
      department: "CSE",
      year: "3rd Year",
      teamName: "Solo",
      participationType: "Individual",
      registrationDateTime: new Date().toISOString()
    };
    const regPostRes = await makeRequest(server, {
      method: "POST",
      path: "/api/registrations",
      body: regPayload
    });
    if (regPostRes.status !== 201 || !regPostRes.json?.success) {
      throw new Error(`Registration POST failed: ${JSON.stringify(regPostRes.json)}`);
    }
    console.log("✔ Registration submitted.");

    // 6. Registration appears in GET /api/registrations
    console.log("Test 6: Verify registration appears in GET /api/registrations...");
    const regGetRes = await makeRequest(server, {
      method: "GET",
      path: "/api/registrations"
    });
    if (regGetRes.status !== 200 || !Array.isArray(regGetRes.json)) {
      throw new Error("GET /api/registrations failed");
    }
    const foundReg = regGetRes.json.find((r) => r.referenceId === testRegRef);
    if (!foundReg) {
      throw new Error("Created registration not found in GET /api/registrations");
    }
    console.log("✔ Registration verified in Admin records.");

    // 7. Payment Submission
    console.log("Test 7: POST /api/payments...");
    const testPayRef = testRegRef;
    const payPayload = {
      referenceId: testPayRef,
      eventId: sampleEvent.id,
      eventName: sampleEvent.title,
      participantName: "Test Participant",
      email: "test@example.com",
      phone: "9876543210",
      department: "CSE",
      year: "3rd Year",
      team: "Solo",
      amount: sampleEvent.registrationFee || 100,
      paymentTransactionId: "UPI1234567890",
      paymentStatus: "Submitted",
      registrationDateTime: new Date().toISOString(),
      paymentMethod: "UPI",
      paymentDate: new Date().toISOString()
    };
    const payPostRes = await makeRequest(server, {
      method: "POST",
      path: "/api/payments",
      body: payPayload
    });
    if (payPostRes.status !== 201 || !payPostRes.json?.success) {
      throw new Error(`Payment POST failed: ${JSON.stringify(payPostRes.json)}`);
    }
    console.log("✔ Payment submitted.");

    // 8. Payment appears in GET /api/payments
    console.log("Test 8: Verify payment in GET /api/payments...");
    const payGetRes = await makeRequest(server, {
      method: "GET",
      path: "/api/payments"
    });
    if (payGetRes.status !== 200 || !Array.isArray(payGetRes.json)) {
      throw new Error("GET /api/payments failed");
    }
    const foundPay = payGetRes.json.find((p) => p.referenceId === testPayRef);
    if (!foundPay) {
      throw new Error("Created payment not found in GET /api/payments");
    }
    console.log("✔ Payment verified in Admin records.");

    // 9. Excel Downloads
    console.log("Test 9: GET /api/registrations/download...");
    const regDlRes = await makeRequest(server, {
      method: "GET",
      path: "/api/registrations/download"
    });
    if (regDlRes.status !== 200 || !regDlRes.headers["content-type"]?.includes("spreadsheetml")) {
      throw new Error("Registrations Excel download failed");
    }
    console.log(`✔ Registrations Excel downloaded (${regDlRes.buffer.length} bytes).`);

    console.log("Test 10: GET /api/payments/download...");
    const payDlRes = await makeRequest(server, {
      method: "GET",
      path: "/api/payments/download"
    });
    if (payDlRes.status !== 200 || !payDlRes.headers["content-type"]?.includes("spreadsheetml")) {
      throw new Error("Payments Excel download failed");
    }
    console.log(`✔ Payments Excel downloaded (${payDlRes.buffer.length} bytes).`);

    // Clean up test registration and payment records
    await Registration.deleteOne({ referenceId: testRegRef });
    await Payment.deleteOne({ referenceId: testPayRef });
    console.log("✔ Cleaned up test records from MongoDB.");

    console.log("=== ALL LOCAL INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runLocalTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
