import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { generatePDF } from "@/lib/generate-pdf";
import type { Artboard1Data, Artboard2Data, Artboard3Data } from "@/components/EstimatePDF";

export const runtime = "nodejs";

// Claude only accepts these image types
const CLAUDE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function toClaudeMediaType(raw: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const t = raw.toLowerCase().split(";")[0].trim();
  if (CLAUDE_MEDIA_TYPES.has(t)) return t as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return "image/jpeg";
}

const ESTIMATION_PROMPT = `\
You are VinylSizer, an expert vinyl wrap estimator for Advertising Vehicles, a fleet graphics company.

MATERIAL SPECIFICATION: 3M 180CV3, 54" wide rolls. Usable width: 52" max. Length is unlimited. The cut vinyl artboard can be narrower than 52" if items lay out more efficiently at a smaller width.

Analyze the provided vehicle panel photos and classify every graphic element into THREE production artboards. Use the fiducial reference cards to calibrate measurements.

═══════════════════════════════════════════
STEP 1 — CALIBRATE EACH PHOTO
═══════════════════════════════════════════
Each photo should show TWO 12-inch diameter circular fiducial reference cards placed flat on the vehicle surface — one near the front edge, one near the rear edge.

Measure both cards independently:
  near_card_pixels_per_inch = near_card_diameter_pixels ÷ 12
  far_card_pixels_per_inch  = far_card_diameter_pixels  ÷ 12

If they differ by more than 5%, interpolate pixels_per_inch across the panel based on each element's position (perspective correction). Otherwise use the average.

If only one card is visible, use it as the sole reference and set confidence to "medium".

═══════════════════════════════════════════
VEHICLE ANATOMY — DO NOT ESTIMATE THESE
═══════════════════════════════════════════
Many vehicles have black or dark plastic body components that are NOT vinyl graphics and must NOT appear on any artboard:
  - Black plastic lower rocker panels / body cladding (ProMaster, Transit, Sprinter all have these)
  - Rubber bumpers and bumper fascia
  - Molded plastic wheel arch cladding
  - Door handles and mirror housings

These look dark/black in photos but have a distinctive plastic texture. EXCLUDE them from all artboards. When uncertain, note it in confidence_note.

═══════════════════════════════════════════
NO DOUBLE-COUNTING — STRICTLY ENFORCED
═══════════════════════════════════════════
Each panel must appear on EXACTLY ONE artboard. No panel name may appear in both artboard2.panels AND artboard3.panels.

When you assign a panel to A3, you MUST:
  1. Remove it from artboard2.panels entirely — it should NOT appear there at all
  2. Place it in artboard3.panels only
  3. Calculate grand_total_sqft AFTER all assignments are final
  4. BEFORE outputting JSON: scan all panel names — if any name appears in both artboard2
     AND artboard3, delete it from artboard2 before returning.

═══════════════════════════════════════════
STEP 2 — CLASSIFY INTO THREE ARTBOARDS
═══════════════════════════════════════════

ARTBOARD 1 — Cut Vinyl with Premask
────────────────────────────────────
All text of any size: company names, phone numbers, websites, DOT numbers, unit numbers, license plates.
All cut-able logos and icons (single or limited colors).

GROUPING RULE: Items appearing together as one visual unit = ONE group. Logo + name + stars = one group. Internal spacing preserved.

Items installed ON TOP of a printed wrap still go on Artboard 1 (second vinyl layer on vehicle).

ARTBOARD 2 — Large Cut Panels
───────────────────────────────
DEFINITION: A BOUNDED RECTANGLE that is printed or cut as a single unit and installed as one piece. The production method determines the artboard — not whether it's solid color or has minor graphic elements.

Goes here:
  - Solid-color body stripes, accent blocks, rocker stripes
  - Bounded accent panels that contain a design element (e.g. a starburst, gradient, logo within the panel) — the ENTIRE BOUNDED RECTANGLE is cut to size as one piece

Does NOT go here:
  - Full-coverage wraps that span large vehicle panel areas requiring multiple overlapping strip installations

ARTBOARD 3 — Printed Vinyl (full wraps only)
─────────────────────────────────────────────
Large-format full-coverage panels: full vehicle wraps, full rear door wraps, full hood wraps. These require printing multiple 52"-wide strips and installing them with overlap across a large surface.

Calculate the FULL PANEL rectangle — do NOT subtract where A1 items sit on top.

CLASSIFICATION DECISION GUIDE:
  Text of any size → Artboard 1
  Cut-able logo/icon → Artboard 1
  Bounded accent panel (stripe, block, even with starburst/gradient inside it) → Artboard 2
  Full-coverage vehicle surface wrap → Artboard 3
  Full rear door wrap → Artboard 3 + text/logos → Artboard 1
  Black plastic cladding/bumper → EXCLUDE entirely

KEY A2 vs A3 DISTINCTION:
  A2 = a bounded rectangle cut to specific dimensions (one piece, installed as a unit)
  A3 = a full-coverage printed surface requiring multiple 52"-wide strips installed with overlap

═══════════════════════════════════════════
STEP 3 — MEASURE DIMENSIONS (in inches)
═══════════════════════════════════════════
Artboard 1 groups: tight bounding box around the FULL GROUP including internal whitespace.
Artboard 2 panels: the complete bounded rectangle.
Artboard 3 panels: the full vehicle surface width and height.

═══════════════════════════════════════════
SQUARE FOOTAGE RULE — CRITICAL
═══════════════════════════════════════════
ALL square footage = GRAPHIC AREA = (width_in × height_in) ÷ 144.

NEVER multiply by strips_needed. NEVER use (strips × 52 × height) ÷ 144 as the reported sq ft.
strips_needed is INFORMATIONAL ONLY — shown for the design team, not used in sq ft.

CORRECT:
  74" wide × 80" tall rear door:  74 × 80 ÷ 144 = 41.1 sq ft  ✓
  191" wide × 29" tall side panel: 191 × 29 ÷ 144 = 38.5 sq ft  ✓

WRONG:
  2 strips × 52" × 80" ÷ 144 = 57.8 sq ft  ✗  (this is material waste, NOT the graphic area)
  4 strips × 52" × 29" ÷ 144 = 42.1 sq ft  ✗  (wrong — report 38.5 sq ft)

═══════════════════════════════════════════
STEP 4 — CALCULATE SQUARE FOOTAGE
═══════════════════════════════════════════

ARTBOARD 1 — full sheet rectangle:
  1. Lay all groups within a sheet no wider than 52". Choose width that fits most efficiently
     (can be narrower than 52" — e.g. 48" if items fit better at that width).
  2. Groups can be rotated 90° to fit better.
  3. Stack groups with ~2" spacing between groups, ~2" top/bottom margin.
  4. artboard_height_in = sum of group heights + (num_groups − 1) × 2" + 4" (margins)
  5. sqft = (artboard_width_in × artboard_height_in) ÷ 144
  Reports the full sheet ordered — not just the sum of individual group areas.

ARTBOARD 2 — graphic area per panel:
  sqft per entry = (width_in × height_in × quantity) ÷ 144
  total_sqft = sum of entries

ARTBOARD 3 — graphic area + material:
  panel_sqft     = (panel_width_in × panel_height_in) ÷ 144   ← USE THIS as sq ft
  strips_needed  = ceil(panel_width_in ÷ 52)                  ← informational only
  material_sqft  = (strips_needed × 52 × panel_height_in) ÷ 144  ← actual material with waste
  total_sqft     = sum of panel_sqft values
  total_material_sqft = sum of material_sqft values

grand_total_sqft = artboard1.sqft + artboard2.total_sqft + artboard3.total_sqft

═══════════════════════════════════════════
VERIFIED PRODUCTION EXAMPLES
═══════════════════════════════════════════

VERIFIED EXAMPLE 1 — Five Star Home Services ProMaster 136WB HighRoof (Partial Wrap)
Total: 128.43 sq ft

  Artboard 1 — Cut Vinyl with Premask:
    Sheet: 145" long × 48" wide = 145×48÷144 = 48.3 sq ft
    [Five Star logo groups both sides, services lists, website URLs, phone number, front text,
     rear logo group, rear services list — laid out 145" long × 48" wide because items fit
     more efficiently at 48" width than at 52". Width ≤ 52" is the rule — it need not be exactly 52".]

  Artboard 2 — Large Cut Panels:
    Side Panel: 191.1" × 29.4" = 191.1×29.4÷144 = 39.02 sq ft
    [Navy blue accent panel with starburst graphic — printed as ONE bounded rectangle,
     cut to 191.1"×29.4". LESSON: This panel contains a starburst graphic but is STILL A2
     because it is a single bounded rectangle cut to size. It is NOT A3.
     A3 is only for full-coverage vehicle wraps, not accent panels.]

  Artboard 3 — Printed Vinyl:
    Rear Panel: 74" × 80" = 74×80÷144 = 41.11 sq ft
    [74" wide needs 2 strips of 52" material — but sq ft = graphic rectangle = 74×80÷144 = 41.1.
     NOT 2×52×80÷144 = 57.8. The strips_needed=2 is informational only.]

VERIFIED EXAMPLE 2 — Impact Fire Express Short WB (Cut Vinyl only)
Total: 72.37 sq ft

  Artboard 1 — Cut Vinyl with Premask:
    Logo sheet:      54" × 30"   = 54×30÷144   = 11.25 sq ft  (flame logos, grouped)
    Text/info sheet: 58" × 35"   = 58×35÷144   = 14.10 sq ft  (text, contact, DOT numbers)
    Large text sheet: 86" × 21.2" = 86×21.2÷144 = 12.65 sq ft  (IMPACT FIRE text, both sides)
    Total A1: ~38.0 sq ft

  Artboard 2 — Large Cut Panels:
    Side Strip: 177" × 28" = 177×28÷144 = 34.42 sq ft
    [Two blue stripes laid as one 177"×28" rectangle, cut in half after printing.
     NOTE: black plastic lower cladding NOT included — that is vehicle body, not vinyl.]

  Artboard 3 — Nothing (no printed vinyl on this vehicle)

VERIFIED EXAMPLE 3 — Affordable Air Express Short WB (Full Wrap)
Total: 292.67 sq ft

  Artboard 1 — Cut Vinyl with Premask:
    Cut Vinyl Kit: 37" × 33" = 37×33÷144 = 8.48 sq ft  (phone numbers, websites, license numbers)
    Unit Numbers:  18" × 15" = 18×15÷144 = 1.88 sq ft
    Total A1: ~10.36 sq ft

  Artboard 2 — Nothing (full wrap vehicle, no bounded accent panels)

  Artboard 3 — Printed Vinyl (ALL sq ft = width×height÷144, NOT strips×52×height÷144):
    Driver Side:    222" × 72"  = 222×72÷144  = 111.0 sq ft
    Passenger Side: 222" × 72"  = 222×72÷144  = 111.0 sq ft
    Rear Panel:      78" × 60"  =  78×60÷144  =  32.5 sq ft
    Roof Strip:      57" × 15"  — per AVI production sheet = 7.81 sq ft
    Hood:            72" × 40"  =  72×40÷144  =  20.0 sq ft
    Total A3: 282.31 sq ft

═══════════════════════════════════════════
STEP 5 — OUTPUT JSON
═══════════════════════════════════════════
Return ONLY valid JSON — no markdown fences, no explanation, no trailing text:

{
  "vehicle_type": "cargo_van | box_truck | pickup_truck | sedan | suv | sprinter | other",
  "artboard1": {
    "label": "Cut Vinyl with Premask",
    "groups": [
      {
        "name": "<descriptive group name>",
        "items": ["<element 1>", "<element 2>"],
        "width_in": 0.0,
        "height_in": 0.0,
        "can_rotate": true
      }
    ],
    "artboard_width_in": 52,
    "artboard_height_in": 0.0,
    "sqft": 0.0
  },
  "artboard2": {
    "label": "Large Cut Panels",
    "panels": [
      {
        "name": "<descriptive name>",
        "width_in": 0.0,
        "height_in": 0.0,
        "quantity": 1,
        "sqft": 0.0
      }
    ],
    "total_sqft": 0.0
  },
  "artboard3": {
    "label": "Printed Vinyl",
    "panels": [
      {
        "name": "<e.g. Driver Side, Rear Doors>",
        "panel_width_in": 0.0,
        "panel_height_in": 0.0,
        "panel_sqft": 0.0,
        "strips_needed": 1,
        "material_sqft": 0.0
      }
    ],
    "total_sqft": 0.0,
    "total_material_sqft": 0.0
  },
  "groups_bbox": [
    {
      "label": "<e.g. A1: Logo + name + stars>",
      "artboard": 1,
      "bbox": { "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0 },
      "panel": "<driver_side | passenger_side | front | rear>"
    }
  ],
  "grand_total_sqft": 0.0,
  "confidence": "high | medium | low",
  "confidence_note": "<explanation of confidence level and any caveats>"
}`;

// ─── Artboard types ───────────────────────────────────────────────────────────

interface GroupBBox {
  label: string;
  artboard: number;
  bbox: { x: number; y: number; w: number; h: number };
  panel: string;
}

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

  const grandTotal = (estimate.grand_total_sqft as number) ?? null;
  const artboardData = {
    artboard1:   (estimate.artboard1   as Artboard1Data) ?? null,
    artboard2:   (estimate.artboard2   as Artboard2Data) ?? null,
    artboard3:   (estimate.artboard3   as Artboard3Data) ?? null,
    groups_bbox: (estimate.groups_bbox as GroupBBox[])   ?? null,
  };

  // ── Save estimate to DB ───────────────────────────────────────────────────
  const { data: estimateRow, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      session_id:      session.id,
      vehicle_type:    (estimate.vehicle_type as string) ?? null,
      panels:          artboardData,
      total_sqft:      grandTotal,
      sqft_low:        null,
      sqft_high:       null,
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
    const totalSqft  = grandTotal;
    const cutVinylSqft   = artboardData.artboard1?.sqft ?? null;
    const largeCutSqft   = artboardData.artboard2?.total_sqft ?? null;
    const printedSqft    = artboardData.artboard3?.total_sqft ?? null;
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
        confidence:    confidence === "—" ? null : confidence,
        confidenceNote,
        artboard1:     artboardData.artboard1,
        artboard2:     artboardData.artboard2,
        artboard3:     artboardData.artboard3,
        photosByPanel: Object.keys(photosByPanel).length > 0 ? photosByPanel : null,
      });
      console.log("Estimate[bg]: PDF generated", { bytes: pdfBuffer.length });
    } catch (pdfError) {
      console.error("Estimate[bg]: PDF generation failed", {
        error: pdfError instanceof Error ? pdfError.message : String(pdfError),
      });
    }

    const hasMaterialBreakdown =
      (cutVinylSqft != null && cutVinylSqft > 0) ||
      (largeCutSqft != null && largeCutSqft > 0) ||
      (printedSqft  != null && printedSqft  > 0);

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
                  <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Artboard breakdown</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${cutVinylSqft != null && cutVinylSqft > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">Cut Vinyl with Premask</td><td style="padding:3px 0;font-size:13px;color:#111827;text-align:right;font-weight:600;">${cutVinylSqft.toFixed(1)} sq ft</td></tr>` : ""}
                    ${largeCutSqft != null && largeCutSqft > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">Large Cut Panels</td><td style="padding:3px 0;font-size:13px;color:#111827;text-align:right;font-weight:600;">${largeCutSqft.toFixed(1)} sq ft</td></tr>` : ""}
                    ${printedSqft != null && printedSqft > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">Printed Vinyl</td><td style="padding:3px 0;font-size:13px;color:#111827;text-align:right;font-weight:600;">${printedSqft.toFixed(1)} sq ft</td></tr>` : ""}
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
