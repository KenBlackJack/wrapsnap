import { NextRequest, NextResponse } from "next/server";
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
  // HEIC, HEIF, and unknown formats — treat as JPEG (closest Claude accepts)
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

Therefore, bounding boxes MUST be drawn to the OUTER EXTENT of each graphic zone including all internal white space:

CORRECT: 'IMPACT FIRE' text — draw one box from the leftmost edge of 'I' to the rightmost edge of 'E', full height including ascenders and descenders, including all letter spacing between words. The white gaps between letters are inside the box.
WRONG: Drawing tight boxes that hug only the colored pixels, excluding white space between elements.

CORRECT: A flame logo with a white halo or gradient fade — draw the box to include the full visual extent where the graphic exists, including the faded edges.
WRONG: Drawing the box only around the fully opaque/saturated colored area.

CORRECT: Multiple lines of text stacked (company name on top, phone number below) — one box encompassing ALL lines including the vertical space between them.
WRONG: Separate boxes for each line of text.

The square footage of each zone represents the MATERIAL that would be ordered, printed, and cut — not just the colored surface area.

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

  console.log("Estimate: starting for token", token.trim());

  const supabase = getSupabaseClient();

  // Verify session — also fetch fields needed for email notification
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, expires_at, created_by, client_name, vehicle_description")
    .eq("token", token.trim())
    .single();

  if (sessionError || !session) {
    console.error("Estimate: session lookup failed", { token, error: sessionError?.message });
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "expired" || session.status === "complete") {
    console.error("Estimate: session closed", { token, status: session.status });
    return NextResponse.json({ error: `Session is ${session.status}` }, { status: 403 });
  }
  if (new Date(session.expires_at) < new Date()) {
    console.error("Estimate: session past expiry", { token, expires_at: session.expires_at });
    return NextResponse.json({ error: "Session has expired" }, { status: 410 });
  }

  console.log("Estimate: session ok", { sessionId: session.id, status: session.status });

  // Fetch upload records
  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("panel, storage_path")
    .eq("session_id", session.id)
    .order("uploaded_at", { ascending: true });

  if (uploadsError) {
    console.error("Estimate: uploads query failed", { sessionId: session.id, error: uploadsError.message });
    return NextResponse.json({ error: "Failed to fetch uploads", detail: uploadsError.message }, { status: 500 });
  }
  if (!uploads?.length) {
    console.error("Estimate: no uploads found", { sessionId: session.id });
    return NextResponse.json({ error: "No uploads found for this session" }, { status: 422 });
  }

  console.log("Estimate: uploads found", { count: uploads.length, panels: uploads.map((u) => u.panel) });

  // Download each image from Supabase Storage and encode as base64
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  const panelLabels: string[] = [];

  for (const upload of uploads) {
    console.log("Estimate: downloading", upload.storage_path);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("vehicle-photos")
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      console.error("Estimate: download failed", {
        path: upload.storage_path,
        error: downloadError?.message,
        hasData: !!fileData,
      });
      return NextResponse.json(
        { error: `Failed to download image for panel: ${upload.panel}`, detail: downloadError?.message },
        { status: 500 },
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = arrayBuffer.byteLength;
    const blobType = fileData.type || "image/jpeg";
    const mediaType = toClaudeMediaType(blobType);
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    console.log("Estimate: image ready", { panel: upload.panel, bytes, blobType, mediaType });

    panelLabels.push(upload.panel);
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });
  }

  // Build panel context label for Claude
  const panelContext = panelLabels
    .map((p, i) => `Image ${i + 1}: ${p.replace(/_/g, " ")}`)
    .join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  console.log("Estimate: calling Claude", {
    model: "claude-sonnet-4-6",
    imageCount: imageBlocks.length,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 10) + "…" : "MISSING",
  });

  // Call Claude
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

    console.log("Estimate: Claude responded", {
      stop_reason: message.stop_reason,
      content_blocks: message.content.length,
      usage: message.usage,
    });

    const textBlock = message.content.find((b) => b.type === "text");
    rawResponse = textBlock?.type === "text" ? textBlock.text : "";

    if (!rawResponse) {
      console.error("Estimate: Claude returned no text block", { content: message.content });
      return NextResponse.json({ error: "Claude returned an empty response" }, { status: 502 });
    }

    console.log("Estimate: raw response (first 500 chars)", rawResponse.slice(0, 500));
  } catch (aiError) {
    const e = aiError as Record<string, unknown>;
    const msg  = aiError instanceof Error ? aiError.message : String(aiError);
    const status  = e?.status;
    const errBody = e?.error;        // Anthropic SDK wraps the API error body here
    const errType = e?.type;
    console.error("Estimate: Claude API error", { message: msg, status, errType, errBody, full: String(aiError) });
    return NextResponse.json({ error: "AI estimation failed", detail: msg, status, errBody }, { status: 502 });
  }

  // Parse Claude's JSON — strip any markdown fences Claude may have added
  let estimate: Record<string, unknown>;
  try {
    const cleaned = rawResponse
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();
    estimate = JSON.parse(cleaned);
    const _totals = estimate.totals as Record<string, number> | undefined;
    console.log("Estimate: JSON parsed ok", { vehicle_type: estimate.vehicle_type, total_sqft: _totals?.total_sqft });
  } catch (parseError) {
    const msg = parseError instanceof Error ? parseError.message : String(parseError);
    console.error("Estimate: JSON parse failed", { message: msg, rawResponse });
    return NextResponse.json({ error: "Failed to parse AI response", detail: msg, rawResponse }, { status: 502 });
  }

  // Map new VinylSizer schema to DB columns
  const totals = estimate.totals as Record<string, number> | undefined;

  // Insert into estimates table
  const { data: estimateRow, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      session_id:      session.id,
      vehicle_type:    (estimate.vehicle_type as string) ?? null,
      panels:          estimate.panels ?? null,
      total_sqft:      totals?.total_sqft ?? null,
      sqft_low:        totals?.total_low ?? null,
      sqft_high:       totals?.total_high ?? null,
      confidence:      (estimate.confidence as string) ?? null,
      confidence_note: (estimate.confidence_note as string) ?? null,
      raw_response:    rawResponse,
    })
    .select("id")
    .single();

  if (estimateError) {
    console.error("Estimate: DB insert error", { message: estimateError.message, estimateError });
    // Non-fatal — return the estimate even if DB write fails
  } else {
    console.log("Estimate: saved to DB", { estimateId: estimateRow?.id });
  }

  // Mark session complete
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ status: "complete" })
    .eq("id", session.id);

  if (updateError) {
    console.error("Estimate: failed to mark session complete", { message: updateError.message });
  } else {
    console.log("Estimate: session marked complete", { sessionId: session.id });
  }

  // ── Email notification to AE ──────────────────────────────────────────────
  try {
    const resendKey = process.env.RESEND_API_KEY ?? "";
    if (resendKey && resendKey !== "re_PLACEHOLDER") {
      const resend = new Resend(resendKey);
      const aeEmail = session.created_by as string;
      const clientName = session.client_name as string;
      const vehicleDesc = (session.vehicle_description as string | null) ?? "";
      const subjectVehicle = vehicleDesc ? ` ${vehicleDesc}` : "";
      const sessionUrl = `https://wrapsnap.advertisingvehicles.com/ae/sessions/${session.id}`;
      const totalSqft = totals?.total_sqft;
      const low = totals?.total_low;
      const high = totals?.total_high;
      const printedWrap = totals?.printed_wrap_sqft;
      const cutVinyl = totals?.cut_vinyl_sqft;
      const confidence = (estimate.confidence as string) ?? "—";
      const confidenceNote = (estimate.confidence_note as string | null) ?? null;

      // ── Generate PDF attachment ──────────────────────────────────────────
      let pdfBuffer: Buffer | null = null;
      try {
        pdfBuffer = await generatePDF({
          clientName,
          vehicleDescription: vehicleDesc || null,
          vehicleType: (estimate.vehicle_type as string) ?? null,
          sessionDate: new Date().toISOString(),
          totalSqft: totalSqft ?? null,
          sqftLow: low ?? null,
          sqftHigh: high ?? null,
          confidence: confidence === "—" ? null : confidence,
          confidenceNote,
          panels: (estimate.panels ?? []) as PanelPDF[],
        });
        console.log("Estimate: PDF generated", { bytes: pdfBuffer.length });
      } catch (pdfError) {
        console.error("Estimate: PDF generation failed (email will send without attachment)", {
          error: pdfError instanceof Error ? pdfError.message : String(pdfError),
        });
      }

      // ── Build email HTML ─────────────────────────────────────────────────
      const hasMaterialBreakdown =
        (printedWrap != null && printedWrap > 0) || (cutVinyl != null && cutVinyl > 0);

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#004876;padding:20px 28px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">WrapSnap</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">by Advertising Vehicles</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Estimate ready</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your WrapSnap estimate has been completed.</p>

            <!-- Client details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:20px;">
              <!-- Client name + vehicle -->
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Client</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#111827;">${clientName}</p>
                  ${vehicleDesc ? `<p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${vehicleDesc}</p>` : ""}
                </td>
              </tr>
              <!-- Total sq ft + confidence -->
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
              <!-- Material breakdown -->
              <tr>
                <td style="padding:14px 20px;${confidenceNote ? "border-bottom:1px solid #e5e7eb;" : ""}">
                  <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Material breakdown</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${printedWrap != null && printedWrap > 0 ? `
                    <tr>
                      <td style="padding:3px 0;font-size:13px;color:#374151;">Printed Wrap</td>
                      <td style="padding:3px 0;font-size:13px;color:#111827;text-align:right;font-weight:600;">${printedWrap.toFixed(1)} sq ft</td>
                    </tr>` : ""}
                    ${cutVinyl != null && cutVinyl > 0 ? `
                    <tr>
                      <td style="padding:3px 0;font-size:13px;color:#374151;">Cut Vinyl</td>
                      <td style="padding:3px 0;font-size:13px;color:#111827;text-align:right;font-weight:600;">${cutVinyl.toFixed(1)} sq ft</td>
                    </tr>` : ""}
                  </table>
                </td>
              </tr>` : ""}
              ${confidenceNote ? `
              <!-- Confidence note -->
              <tr>
                <td style="padding:14px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Notes</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">${confidenceNote}</p>
                </td>
              </tr>` : ""}
            </table>

            ${pdfBuffer ? `
            <!-- PDF attachment notice -->
            <p style="margin:0 0 20px;font-size:13px;color:#6b7280;text-align:center;">
              &#128206; Full estimate attached as PDF
            </p>` : ""}

            <!-- CTA -->
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
      console.log("Estimate: email sent to", aeEmail, { hasAttachment: !!pdfBuffer });
    } else {
      console.log("Estimate: skipping email (RESEND_API_KEY not configured)");
    }
  } catch (emailError) {
    // Non-fatal — estimate response is not affected
    console.error("Estimate: email send failed", {
      error: emailError instanceof Error ? emailError.message : String(emailError),
    });
  }

  return NextResponse.json({ estimateId: estimateRow?.id ?? null, ...estimate });
}
