import "dotenv/config";
import cors from "cors";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FITNESS_USER_ID,
  FITNESS_READ_TOKEN,
  PORT = "8787",
} = process.env;

const missing = [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
  ["FITNESS_USER_ID", FITNESS_USER_ID],
  ["FITNESS_READ_TOKEN", FITNESS_READ_TOKEN],
].filter(([, value]) => !value);

if (missing.length) {
  console.error(`Missing environment variables: ${missing.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function isAuthorized(req) {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : req.get("x-fitness-token");
  return token && token === FITNESS_READ_TOKEN;
}

function requireAuth(req, res, next) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days));
  return date.toISOString().slice(0, 10);
}

function cleanLimit(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(Math.floor(n), max));
}

function dateRangeFilter(query, { days, startDate, endDate }) {
  let next = query;
  if (startDate) next = next.gte("date", startDate);
  else if (days) next = next.gte("date", daysAgoIso(days));
  if (endDate) next = next.lte("date", endDate);
  return next;
}

function jsonContent(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function throwIfError(result) {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data || [];
}

function workoutFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    durationMinutes: row.duration_minutes ?? null,
    intensity: row.intensity ?? null,
    notes: row.notes || "",
    exercises: row.exercises || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bodyFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    weight: row.weight ?? null,
    waist: row.waist ?? null,
    chest: row.chest ?? null,
    hips: row.hips ?? null,
    thigh: row.thigh ?? null,
    arm: row.arm ?? null,
    bodyFat: row.body_fat ?? null,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sleepFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    sleepScore: row.sleep_score ?? null,
    wakeFeeling: row.wake_feeling || "",
    sleepIssues: row.sleep_issues || [],
    afternoonScore: row.afternoon_score ?? null,
    severity: row.severity || "",
    impactWindow: row.impact_window || "",
    symptoms: row.symptoms || [],
    factors: row.factors || [],
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function photoFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    imagePath: row.image_path,
    capturedAt: row.captured_at || "",
    angle: row.angle || "front",
    weight: row.weight ?? null,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function selectWorkouts({ days, startDate, endDate, limit = 20 }) {
  let query = supabase
    .from("workouts")
    .select("id,date,title,duration_minutes,intensity,notes,exercises,created_at,updated_at")
    .eq("user_id", FITNESS_USER_ID)
    .order("date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(cleanLimit(limit, 20, 100));
  query = dateRangeFilter(query, { days, startDate, endDate });
  return throwIfError(await query).map(workoutFromRow);
}

async function selectBodyMeasurements({ days, startDate, endDate, limit = 200 }) {
  let query = supabase
    .from("body_measurements")
    .select("id,date,weight,waist,chest,hips,thigh,arm,body_fat,notes,created_at,updated_at")
    .eq("user_id", FITNESS_USER_ID)
    .order("date", { ascending: true })
    .limit(cleanLimit(limit, 200, 1000));
  query = dateRangeFilter(query, { days, startDate, endDate });
  return throwIfError(await query).map(bodyFromRow);
}

async function selectSleepRecords({ days, startDate, endDate, limit = 60 }) {
  let query = supabase
    .from("sleep_records")
    .select("id,date,sleep_score,wake_feeling,sleep_issues,afternoon_score,severity,impact_window,symptoms,factors,notes,created_at,updated_at")
    .eq("user_id", FITNESS_USER_ID)
    .order("date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(cleanLimit(limit, 60, 365));
  query = dateRangeFilter(query, { days, startDate, endDate });
  return throwIfError(await query).map(sleepFromRow);
}

async function selectPhotos({ days, startDate, endDate, angle, limit = 50, ids }) {
  let query = supabase
    .from("progress_photos")
    .select("id,date,image_path,captured_at,angle,weight,notes,created_at,updated_at")
    .eq("user_id", FITNESS_USER_ID)
    .order("date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(cleanLimit(limit, 50, 200));
  if (ids?.length) query = query.in("id", ids);
  query = dateRangeFilter(query, { days, startDate, endDate });
  if (angle && angle !== "all") query = query.eq("angle", angle);
  return throwIfError(await query).map(photoFromRow);
}

async function signedPhoto(photo, expiresInSeconds = 300) {
  const expires = cleanLimit(expiresInSeconds, 300, 3600);
  const { data, error } = await supabase.storage
    .from("progress-photos")
    .createSignedUrl(photo.imagePath, expires);
  if (error) throw new Error(error.message);
  return {
    ...photo,
    signedUrl: data?.signedUrl || "",
    expiresInSeconds: expires,
  };
}

async function imageContentFromUrl(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch photo ${label}: ${response.status}`);
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    type: "image",
    mimeType,
    data: buffer.toString("base64"),
  };
}

function createMcpServer() {
  const server = new McpServer({
    name: "fitness-tracker-readonly",
    version: "0.1.0",
  });

  server.tool(
    "get_recent_workouts",
    "Read recent workout records, including exercises, sets, cardio time, heart rate, notes, and dates.",
    {
      days: z.number().int().positive().max(3650).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().int().positive().max(100).optional(),
    },
    async (args) => jsonContent({
      workouts: await selectWorkouts(args),
    })
  );

  server.tool(
    "get_workout_detail",
    "Read one workout by id.",
    {
      id: z.string().uuid(),
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("workouts")
        .select("id,date,title,duration_minutes,intensity,notes,exercises,created_at,updated_at")
        .eq("user_id", FITNESS_USER_ID)
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return jsonContent({ workout: workoutFromRow(data) });
    }
  );

  server.tool(
    "get_body_trends",
    "Read body measurement trends such as weight, waist, chest, hips, arm, thigh, and body fat.",
    {
      days: z.number().int().positive().max(3650).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().int().positive().max(1000).optional(),
    },
    async (args) => jsonContent({
      measurements: await selectBodyMeasurements(args),
    })
  );

  server.tool(
    "get_sleep_status",
    "Read sleep/status records, including sleep score, afternoon score, symptoms, factors, and notes.",
    {
      days: z.number().int().positive().max(3650).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().int().positive().max(365).optional(),
    },
    async (args) => jsonContent({
      sleepRecords: await selectSleepRecords(args),
    })
  );

  server.tool(
    "list_progress_photos",
    "List progress photo metadata without returning image data.",
    {
      days: z.number().int().positive().max(3650).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      angle: z.enum(["front", "side", "back", "other", "all"]).optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
    async (args) => jsonContent({
      photos: await selectPhotos(args),
    })
  );

  server.tool(
    "get_progress_photo_links",
    "Get short-lived signed URLs for progress photos. Use includeImages only for a few selected photos.",
    {
      photoIds: z.array(z.string().uuid()).max(12).optional(),
      days: z.number().int().positive().max(3650).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      angle: z.enum(["front", "side", "back", "other", "all"]).optional(),
      limit: z.number().int().positive().max(12).optional(),
      expiresInSeconds: z.number().int().positive().max(3600).optional(),
      includeImages: z.boolean().optional(),
    },
    async ({ photoIds, includeImages = false, expiresInSeconds = 300, ...args }) => {
      const photos = await selectPhotos({
        ...args,
        ids: photoIds,
        limit: photoIds?.length || args.limit || 6,
      });
      const signed = await Promise.all(photos.map((photo) => signedPhoto(photo, expiresInSeconds)));
      if (!includeImages) return jsonContent({ photos: signed });

      const content = [
        {
          type: "text",
          text: JSON.stringify({ photos: signed }, null, 2),
        },
      ];
      for (const photo of signed.slice(0, 6)) {
        content.push(await imageContentFromUrl(photo.signedUrl, photo.id));
      }
      return { content };
    }
  );

  server.tool(
    "get_fitness_overview",
    "Read a compact overview across workouts, body measurements, sleep/status, and photo metadata.",
    {
      days: z.number().int().positive().max(3650).optional().default(30),
    },
    async ({ days = 30 }) => {
      const [workouts, measurements, sleepRecords, photos] = await Promise.all([
        selectWorkouts({ days, limit: 100 }),
        selectBodyMeasurements({ days, limit: 1000 }),
        selectSleepRecords({ days, limit: 365 }),
        selectPhotos({ days, limit: 200 }),
      ]);
      return jsonContent({
        range: {
          endDate: todayIso(),
          days,
        },
        counts: {
          workouts: workouts.length,
          measurements: measurements.length,
          sleepRecords: sleepRecords.length,
          photos: photos.length,
        },
        latest: {
          workout: workouts[0] || null,
          bodyMeasurement: measurements.at(-1) || null,
          sleepRecord: sleepRecords[0] || null,
          photo: photos[0] || null,
        },
        workouts,
        bodyMeasurements: measurements,
        sleepRecords,
        photoMetadata: photos,
      });
    }
  );

  return server;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    name: "fitness-tracker-readonly",
  });
});

app.post("/mcp", requireAuth, async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", requireAuth, (_req, res) => {
  res.status(405).json({ error: "Use POST /mcp" });
});

app.delete("/mcp", requireAuth, (_req, res) => {
  res.status(405).json({ error: "Stateless MCP endpoint" });
});

app.listen(Number(PORT), () => {
  console.log(`Fitness read-only MCP listening on http://localhost:${PORT}/mcp`);
});
