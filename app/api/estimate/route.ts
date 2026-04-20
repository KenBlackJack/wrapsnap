import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { generatePDF } from "@/lib/generate-pdf";
import type { PanelPDF } from "@/components/EstimatePDF";

export const runtime = "nodejs";

// Claude only accepts these image types
const CLAUDE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function toClaudeMediaType(raw: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const t = raw.toLowerCase().split(";")[0].trim();
  if (CLAUDE_MEDIA_TYPES.has(t)) return t as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return "image/jpeg";
}

const ESTIMATION_PROMPT = `\
You are VinylSizer, an expert vinyl wrap estimator for Advertising Vehicles, a fleet graphics company. Analyze the provided vehicle panel photos and produce a precise square-footage estimate for all vinyl graphics.

Follow these 5 steps for EACH panel photo:

STEP 1 — VALIDATE THE PHOTO
Confirm the photo shows a vehicle panel with TWO 12-inch diameter circular fiducial reference cards placed flat on the surface — one near the front edge of the panel, one near the rear edge. If the photo is missing a vehicle, has fewer than two cards visible, is too dark, too blurry, too close, or shot at an extreme angle, mark valid: false and add the panel name to invalid_panels. If only one card is found, still attempt measurement but set confidence to "medium" and note it in confidence_note.

STEP 2 — DUAL-CARD PIXEL CALIBRATION
Locate BOTH 12-inch diameter fiducial cards. For each card, measure its pixel diameter independently:
- near_card_pixels_per_inch = near_card_diameter_pixels / 12  (card closest to camera / larger in frame)
- far_card_pixels_per_inch  = far_card_diameter_pixels  / 12  (card farthest from camera / smaller in frame)

If the two measurements differ by more than 5%, perspective compression is significant:
- perspective_correction_applied: true
- Calculate a perspective_ratio = near_card_pixels_per_inch / far_card_pixels_per_inch
- When measuring vinyl zones, interpolate pixels_per_inch linearly across the panel length based on each zone's position relative to the two card positions.

If the measurements are within 5% of each other, use the average as a single pixels_per_inch and set perspective_correction_applied: false.

If only one card is found, use it as the sole reference and set perspective_correction_applied: false.

STEP 3 — VINYL DETECTION AND ZONE GROUPING
Do NOT draw individual boxes around each letter, word, or small graphic element. Group related visual elements into logical PRODUCTION ZONES that reflect how a printer would produce and install the work:

- TEXT CLUSTERS: All text appearing together as a unit gets ONE bounding box. Company name, phone number, address, and tagline printed together = one zone named e.g. "Company name and contact info"
- LOGO + TEXT: A logo and any text directly associated with it as a branded unit = ONE zone named e.g. "Flame logo with company name"
- STRIPES AND BANDS: A color stripe or band running along the vehicle = ONE wide rectangular zone spanning its full length, named e.g. "Blue lower body stripe"
- REAR PANEL: All graphics on a rear door panel = ONE zone encompassing all content, named e.g. "Rear door graphics"
- FULL WRAPS: A background color or printed image covering most of the panel = ONE zone for the entire wrap area

Classify each zone as:
- "printed_wrap" — large-format printed vinyl (full-color graphics, backgrounds, wraps, gradients)
- "cut_vinyl" — individually cut vinyl letters, logos, or shapes (single color, no print)
- "review" — ambiguous areas needing human confirmation

Give each zone a short descriptive name (e.g. "Blue lower stripe", "Company logo block", "Rear door graphics").

STEP 4 — SQUARE FOOTAGE CALCULATION
For each vinyl zone, measure pixel dimensions, convert to inches using the perspective-corrected pixels_per_inch for that zone's position, then add bleed:
- Printed wrap: +1.5 inches per edge before calculating sq ft
- Cut vinyl: +0.5 inches per edge before calculating sq ft
Convert to square feet (sq in ÷ 144). Provide best-estimate sqft, conservative sqft_low, and generous sqft_high.
Set paint_color_warning: true for any cut vinyl whose color is within one shade of the vehicle's base paint color.

Also estimate a bounding box for each vinyl zone as percentages of the image dimensions (0.0 to 1.0), with (0,0) at the top-left corner of the image:
- x_pct: left edge of the zone / image width
- y_pct: top edge of the zone / image height
- width_pct: zone width / image width
- height_pct: zone height / image height

Bounding box rules:
- Extend each box to capture the FULL visual extent of the graphic including any gradient transitions or fade edges
- For text zones, the box must encompass the entire text block — do not clip ascenders, descenders, or surrounding glow/shadow
- When in doubt, draw a LARGER bounding box rather than a smaller one

CRITICAL PRODUCTION RULE — BOUNDING BOXES MUST INCLUDE ALL INTERNAL WHITESPACE:

In vinyl production, the printer outputs the ENTIRE rectangular bounding box of a graphic — including all internal white space, gaps between letters, and negative space within the design. The installer then weeds (removes) unwanted material. The COST and MATERIAL USAGE is based on the full rectangle, not just the colored/printed area.

Therefore, bounding boxes MUST be drawn to the OUTER EXTENT of each graphic zone including all internal white space.

STEP 5 — PRODUCE JSON OUTPUT
Return ONLY valid JSON — no markdown fences, no explanation, no trailing text:

{
  "vehicle_type": "cargo_van | box_truck | pickup_truck | sedan | suv | sprinter | other",
  "paint_color": "<description of vehicle base paint color>",
  "panels": [
    {
      "panel": "driver_side | passenger_side | front | rear",
      "valid": true,
      "fiducial_count": 2,
      "near_card_pixels_per_inch": 0.0,
      "far_card_pixels_per_inch": 0.0,
      "perspective_correction_applied": false,
      "coverage_type": "printed_wrap | cut_vinyl | mixed | none",
      "vinyl_zones": [
        {
          "name": "<short descriptive zone name>",
          "type": "printed_wrap | cut_vinyl | review",
          "sqft": 0.0,
          "sqft_low": 0.0,
          "sqft_high": 0.0,
          "cut_vinyl_color": "<color description if cut_vinyl, else null>",
          "paint_color_warning": false,
          "bbox": { "x_pct": 0.0, "y_pct": 0.0, "width_pct": 0.0, "height_pct": 0.0 }
        }
      ],
      "panel_sqft": 0.0,
      "panel_sqft_low": 0.0,
      "panel_sqft_high": 0.0
    }
  ],
  "totals": {
    "printed_wrap_sqft": 0.0,
    "cut_vinyl_sqft": 0.0,
    "total_sqft": 0.0,
    "total_low": 0.0,
    "total_high": 0.0
  },
  "confidence": "high | medium | low",
  "confidence_note": "<explanation of confidence level and any caveats>",
  "invalid_panels": ["<panel names that could not be measured>"]
}`;

// ─── Types shared between request handler and background worker ───────────────

interface SessionRecord {
  id: string;
  status: string;
  expires_at: string;
  created_by: string;
  client_name: string;
  vehicle_description: string | null;
}

interface UploadRecord {
  panel: string;
  storage_path: string;
}

// ─── Background estimation worker ────────────────────────────────────────────

async function runEstimation(session: SessionRecord, uploads: UploadRecord[]) {
  const supabase = getSupabaseClient();

  console.log("Estimate[bg]: starting for session", session.id);

  // Download each image from Supabase Storage and encode as base64
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  const panelLabels: string[] = [];

  for (const upload of uploads) {
    console.log("Estimate[bg]: downloading", upload.storage_path);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("vehicle-photos")
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      console.error("Estimate[bg]: download failed", {
        path: upload.storage_path,
        error: downloadError?.message,
      });
      // Mark failed so it doesn't stay stuck in 'processing'
      await supabase
        .from("sessions")
        .update({ status: "pending" })
        .eq("id", session.id);
      return;
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const blobType   = fileData.type || "image/jpeg";
    const mediaType  = toClaudeMediaType(blobType);
    const base64     = Buffer.from(arrayBuffer).toString("base64");

    console.log("Estimate[bg]: image ready", {
      panel: upload.panel,
      bytes: arrayBuffer.byteLength,
      mediaType,
    });

    panelLabels.push(upload.panel);
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });
  }

  const panelContext = panelLabels
    .map((p, i) => `Image ${i + 1}: ${p.replace(/_/g, " ")}`)
    .join("\n");

  // ── Call Claude ────────────────────────────────────────────────────────────
  const anthropic = new Anthropic();
  let rawResponse: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `Panel order:\n${panelContext}\n\n${ESTIMATION_PROMPT}`,
            },
          ],
        },
      ],
    });

    console.log("Estimate[bg]: Claude responded", {
      stop_reason: message.stop_reason,
      usage: message.usage,
    });

    const textBlock = message.content.find((b) => b.type === "text");
    rawResponse = textBlock?.type === "text" ? textBlock.text : "";

    if (!rawResponse) {
      console.error("Estimate[bg]: Claude returned no text block");
      await supabase.from("sessions").update({ status: "pending" }).eq("id", session.id);
      return;
    }
  } catch (aiError) {
    console.error("Estimate[bg]: Claude API error", {
      message: aiError instanceof Error ? aiError.message : String(aiError),
    });
    await supabase.from("sessions").update({ status: "pending" }).eq("id", session.id);
    return;
  }

  // ── Parse JSON ────────────────────────────────────────────────────────────
  let estimate: Record<string, unknown>;
  try {
    const cleaned = rawResponse
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();
    estimate = JSON.parse(cleaned);
  } catch (parseError) {
    console.error("Estimate[bg]: JSON parse failed", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    await supabase.from("sessions").update({ status: "pending" }).eq("id", session.id);
    return;
  }

  const totals = estimate.totals as Record<string, number> | undefined;

  // ── Save estimate to DB ───────────────────────────────────────────────────
  const { data: estimateRow, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      session_id:      session.id,
      vehicle_type:    (estimate.vehicle_type as string) ?? null,
      panels:          estimate.panels ?? null,
      total_sqft:      totals?.total_sqft ?? null,
      sqft_low:        totals?.total_low  ?? null,
      sqft_high:       totals?.total_high ?? null,
      confidence:      (estimate.confidence as string) ?? null,
      confidence_note: (estimate.confidence_note as string) ?? null,
      raw_response:    rawResponse,
    })
    .select("id")
    .single();

  if (estimateError) {
    console.error("Estimate[bg]: DB insert error", estimateError.message);
  } else {
    console.log("Estimate[bg]: saved to DB", { estimateId: estimateRow?.id });
  }

  // ── Mark session complete ─────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ status: "complete" })
    .eq("id", session.id);

  if (updateError) {
    console.error("Estimate[bg]: failed to mark session complete", updateError.message);
  } else {
    console.log("Estimate[bg]: session marked complete", { sessionId: session.id });
  }

  // ── Email notification to AE ──────────────────────────────────────────────
  try {
    const resendKey = process.env.RESEND_API_KEY ?? "";
    if (!resendKey || resendKey === "re_PLACEHOLDER") {
      console.log("Estimate[bg]: skipping email (RESEND_API_KEY not configured)");
      return;
    }

    const resend     = new Resend(resendKey);
    const aeEmail    = session.created_by;
    const clientName = session.client_name;
    const vehicleDesc = session.vehicle_description ?? "";
    const subjectVehicle = vehicleDesc ? ` ${vehicleDesc}` : "";
    const sessionUrl = `https://wrapsnap.advertisingvehicles.com/ae/sessions/${session.id}`;
    const totalSqft  = totals?.total_sqft;
    const low        = totals?.total_low;
    const high       = totals?.total_high;
    const printedWrap = totals?.printed_wrap_sqft;
    const cutVinyl   = totals?.cut_vinyl_sqft;
    const confidence = (estimate.confidence as string) ?? "—";
    const confidenceNote = (estimate.confidence_note as string | null) ?? null;

    // Build signed photo URLs for PDF
    const photosByPanel: Record<string, string> = {};
    for (const upload of uploads) {
      const { data: signed } = await supabase.storage
        .from("vehicle-photos")
        .createSignedUrl(upload.storage_path, 3600);
      if (signed?.signedUrl) photosByPanel[upload.panel] = signed.signedUrl;
    }

    // Generate PDF attachment
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await generatePDF({
        clientName,
        vehicleDescription: vehicleDesc || null,
        vehicleType:   (estimate.vehicle_type as string) ?? null,
        sessionDate:   new Date().toISOString(),
        totalSqft:     totalSqft ?? null,
        sqftLow:       low ?? null,
        sqftHigh:      high ?? null,
        confidence:    confidence === "—" ? null : confidence,
        confidenceNote,
        panels:        (estimate.panels ?? []) as PanelPDF[],
        photosByPanel: Object.keys(photosByPanel).length > 0 ? photosByPanel : null,
      });
      console.log("Estimate[bg]: PDF generated", { bytes: pdfBuffer.length });
    } catch (pdfError) {
      console.error("Estimate[bg]: PDF generation failed", {
        error: pdfError instanceof Error ? pdfError.message : String(pdfError),
      });
    }

    const hasMaterialBreakdown =
      (printedWrap != null && printedWrap > 0) || (cutVinyl != null && cutVinyl > 0);

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr>
          <td style="background:#004876;padding:20px 28px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">WrapSnap</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">by Advertising Vehicles</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Estimate ready</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your WrapSnap estimate has been completed.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:20px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Client</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#111827;">${clientName}</p>
                  ${vehicleDesc ? `<p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${vehicleDesc}</p>` : ""}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:50%;padding-right:12px;">
                        <p style="margin:0;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Total sq ft</p>
                        <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#007BBA;">${totalSqft != null ? totalSqft.toFixed(1) : "—"}</p>
                        ${low != null && high != null ? `<p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Range: ${low.toFixed(1)} – ${high.toFixed(1)}</p>` : ""}
                      </td>
                      <td style="width:50%;padding-left:12px;">
                        <p style="margin:0;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Confidence</p>
                        <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#111827;text-transform:capitalize;">${confidence}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${hasMaterialBreakdown ? `
              <tr>
                <td style="padding:14px 20px;${confidenceNote ? "border-bottom:1px solid #e5e7eb;" : ""}">
                  <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Material breakdown</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${printedWrap != null && printedWrap > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">Printed Wrap</td><td style="padding:3px 0;font-size:13px;color:#111827;text-align:right;font-weight:600;">${printedWrap.toFixed(1)} sq ft</td></tr>` : ""}
                    ${cutVinyl != null && cutVinyl > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">Cut Vinyl</td><td style="padding:3px 0;font-size:13px;color:#111827;text-align:right;font-weight:600;">${cutVinyl.toFixed(1)} sq ft</td></tr>` : ""}
                  </table>
                </td>
              </tr>` : ""}
              ${confidenceNote ? `
              <tr>
                <td style="padding:14px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Notes</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">${confidenceNote}</p>
                </td>
              </tr>` : ""}
            </table>
            ${pdfBuffer ? `<p style="margin:0 0 20px;font-size:13px;color:#6b7280;text-align:center;">&#128206; Full estimate attached as PDF</p>` : ""}
            <a href="${sessionUrl}" style="display:block;text-align:center;background:#007BBA;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 24px;border-radius:8px;margin-bottom:20px;">
              View Full Estimate →
            </a>
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              You received this because you created this WrapSnap session.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await resend.emails.send({
      from: "WrapSnap <wrapsnap@mail.wrapsnap.advertisingvehicles.com>",
      to: [aeEmail],
      subject: `WrapSnap estimate ready — ${clientName}${subjectVehicle}`,
      html,
      ...(pdfBuffer
        ? {
            attachments: [
              {
                filename: `WrapSnap-Estimate-${clientName.replace(/\s+/g, "-")}.pdf`,
                content: pdfBuffer,
              },
            ],
          }
        : {}),
    });
    console.log("Estimate[bg]: email sent to", aeEmail, { hasAttachment: !!pdfBuffer });
  } catch (emailError) {
    console.error("Estimate[bg]: email send failed", {
      error: emailError instanceof Error ? emailError.message : String(emailError),
    });
  }
}

// ─── Request handler — responds immediately with 202 ─────────────────────────

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token } = body;
  if (!token?.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  console.log("Estimate: received request for token", token.trim());

  const supabase = getSupabaseClient();

  // Verify session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, expires_at, created_by, client_name, vehicle_description")
    .eq("token", token.trim())
    .single();

  if (sessionError || !session) {
    console.error("Estimate: session lookup failed", { token, error: sessionError?.message });
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "complete") {
    return NextResponse.json({ error: "Session is already complete" }, { status: 403 });
  }
  if (session.status === "processing") {
    // Estimation already in flight — let the client know it's underway
    return NextResponse.json({ status: "processing" }, { status: 202 });
  }
  if (session.status === "expired") {
    return NextResponse.json({ error: "Session has expired" }, { status: 403 });
  }
  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: "Session has expired" }, { status: 410 });
  }

  // Verify uploads exist
  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("panel, storage_path")
    .eq("session_id", session.id)
    .order("uploaded_at", { ascending: true });

  if (uploadsError) {
    console.error("Estimate: uploads query failed", { sessionId: session.id, error: uploadsError.message });
    return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 });
  }
  if (!uploads?.length) {
    return NextResponse.json({ error: "No uploads found for this session" }, { status: 422 });
  }

  console.log("Estimate: uploads found", {
    count: uploads.length,
    panels: uploads.map((u) => u.panel),
  });

  // Mark as processing immediately
  const { error: markError } = await supabase
    .from("sessions")
    .update({ status: "processing" })
    .eq("id", session.id);

  if (markError) {
    console.error("Estimate: failed to mark processing", markError.message);
    return NextResponse.json({ error: "Failed to update session status" }, { status: 500 });
  }

  console.log("Estimate: marked processing, scheduling background work", { sessionId: session.id });

  // Schedule estimation to run after response is sent
  after(async () => {
    await runEstimation(session as SessionRecord, uploads as UploadRecord[]);
  });

  return NextResponse.json({ status: "processing" }, { status: 202 });
}
