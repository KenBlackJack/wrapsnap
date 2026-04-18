import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VinylZonePDF {
  type: string;
  name?: string | null;
  sqft?: number | null;
  sqft_low?: number | null;
  sqft_high?: number | null;
}

export interface PanelPDF {
  panel?: string | null;
  name?: string | null;
  coverage_type?: string | null;
  panel_sqft?: number | null;
  panel_sqft_low?: number | null;
  panel_sqft_high?: number | null;
  /** Legacy field names kept for old estimates */
  sqft?: number | null;
  sqft_low?: number | null;
  sqft_high?: number | null;
  vinyl_zones?: VinylZonePDF[] | null;
}

export interface EstimatePDFProps {
  logoUrl: string;
  clientName: string;
  vehicleDescription?: string | null;
  vehicleType?: string | null;
  sessionDate: string;
  totalSqft?: number | null;
  sqftLow?: number | null;
  sqftHigh?: number | null;
  confidence?: string | null;
  confidenceNote?: string | null;
  panels: PanelPDF[];
  /** Map of panel slug → photo URL (signed Supabase URL or base64 data URI) */
  photosByPanel?: Record<string, string> | null;
}

// ─── Colour tokens ────────────────────────────────────────────────────────────

const BLUE      = "#007BBA";
const DARK_BLUE = "#004876";
const GRAY_TEXT = "#6B7280";
const LIGHT_BG  = "#F9FAFB";
const BORDER    = "#E5E7EB";

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
  },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  logo:   { width: 150, height: 44 },
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: 15, color: DARK_BLUE, marginBottom: 3 },
  dateText:  { fontSize: 8, color: GRAY_TEXT, marginBottom: 1 },
  poweredBy: { fontSize: 7, color: GRAY_TEXT },

  // Divider
  divider: { borderBottomWidth: 2, borderBottomColor: BLUE, marginBottom: 16 },

  // Section title
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, color: DARK_BLUE, marginBottom: 7, letterSpacing: 0.8 },

  // Client
  clientRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  clientName:   { fontFamily: "Helvetica-Bold", fontSize: 18, color: "#111827", marginBottom: 3 },
  clientSub:    { fontSize: 9, color: GRAY_TEXT, marginBottom: 1 },
  clientRight:  { alignItems: "flex-end" },
  clientLabel:  { fontSize: 7, color: GRAY_TEXT, marginBottom: 2 },
  clientDate:   { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#111827" },

  // Summary box
  summaryBox:  { backgroundColor: "#EBF5FB", borderRadius: 8, padding: 16, marginBottom: 16, flexDirection: "row", alignItems: "center" },
  summaryLeft: { flexGrow: 1 },
  totalLabel:  { fontSize: 7, color: GRAY_TEXT, marginBottom: 3, letterSpacing: 0.6 },
  totalNum:    { fontFamily: "Helvetica-Bold", fontSize: 34, color: BLUE, lineHeight: 1 },
  totalUnit:   { fontFamily: "Helvetica-Bold", fontSize: 12, color: BLUE, marginLeft: 4, marginBottom: 4, alignSelf: "flex-end" },
  totalRow:    { flexDirection: "row", alignItems: "flex-end" },
  rangeText:   { fontSize: 8, color: GRAY_TEXT, marginTop: 4 },
  summaryRight: { alignItems: "flex-end" },
  confLabel:   { fontSize: 7, color: GRAY_TEXT, marginBottom: 5 },
  confBadge:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  confText:    { fontFamily: "Helvetica-Bold", fontSize: 9 },

  // Panel blocks
  panelBlock:  { marginBottom: 7, borderWidth: 1, borderColor: BORDER, borderRadius: 6 },
  panelHead:   { flexDirection: "row", justifyContent: "space-between", backgroundColor: LIGHT_BG, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  panelName:   { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#111827" },
  panelTotal:  { fontFamily: "Helvetica-Bold", fontSize: 9, color: BLUE },
  zoneRow:     { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingLeft: 20, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  zoneRowLast: { borderBottomWidth: 0 },
  zoneLabel:   { fontSize: 8, color: GRAY_TEXT },
  zoneValue:   { fontSize: 8, color: "#374151" },

  // Totals table
  totalsBox:     { borderWidth: 1, borderColor: BORDER, borderRadius: 6, marginBottom: 14 },
  totalsRow:     { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BORDER },
  totalsSumRow:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: LIGHT_BG, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  totalsLabel:   { fontSize: 9, color: "#374151" },
  totalsValue:   { fontSize: 9, color: "#111827" },
  totalsBoldLbl: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#111827" },
  totalsBoldVal: { fontFamily: "Helvetica-Bold", fontSize: 10, color: BLUE },

  // Notes
  notesBox:  { backgroundColor: LIGHT_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 16 },
  notesText: { fontSize: 8, color: GRAY_TEXT, lineHeight: 1.6 },

  // Footer
  footer:           { position: "absolute", bottom: 20, left: 40, right: 40, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerDisclaimer: { fontSize: 7, color: "#9CA3AF", flexGrow: 1, marginRight: 12 },
  footerUrl:        { fontSize: 7, color: GRAY_TEXT },

  // Vehicle photos grid
  photosGrid:  { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  photoCell:   { width: "48.5%", marginBottom: 8 },
  photoImg:    { width: "100%", height: 118, objectFit: "cover" },
  photoEmpty:  { width: "100%", height: 118, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  photoLabel:  { fontSize: 7, color: GRAY_TEXT, marginTop: 3, textAlign: "center" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function toLabel(slug: string) {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function zoneLabel(type: string, name?: string | null) {
  if (name) return name;
  const map: Record<string, string> = {
    printed_wrap: "Printed Wrap",
    cut_vinyl:    "Cut Vinyl",
    review:       "Needs Review",
  };
  return map[type] ?? toLabel(type);
}

function confColors(c?: string | null): { bg: string; color: string } {
  if (c === "high")   return { bg: "#DCFCE7", color: "#16A34A" };
  if (c === "medium") return { bg: "#FEF3C7", color: "#D97706" };
  if (c === "low")    return { bg: "#FEE2E2", color: "#DC2626" };
  return { bg: LIGHT_BG, color: GRAY_TEXT };
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

const PHOTO_PANELS: { slug: string; label: string }[] = [
  { slug: "driver_side",    label: "Driver Side" },
  { slug: "passenger_side", label: "Passenger Side" },
  { slug: "front",          label: "Front" },
  { slug: "rear",           label: "Rear" },
];

export default function EstimatePDFDocument({
  logoUrl,
  clientName,
  vehicleDescription,
  vehicleType,
  sessionDate,
  totalSqft,
  sqftLow,
  sqftHigh,
  confidence,
  confidenceNote,
  panels,
  photosByPanel,
}: EstimatePDFProps) {
  // Derive production totals from zone data
  let printedWrap = 0;
  let cutVinyl    = 0;
  for (const p of panels) {
    for (const z of p.vinyl_zones ?? []) {
      if (z.type === "printed_wrap") printedWrap += z.sqft ?? 0;
      else if (z.type === "cut_vinyl") cutVinyl  += z.sqft ?? 0;
    }
  }
  const hasMaterialBreakdown = printedWrap > 0 || cutVinyl > 0;

  const { bg: confBg, color: confColor } = confColors(confidence);
  const generatedOn = fmtDate(new Date().toISOString());
  const sessionOn   = fmtDate(sessionDate);

  return (
    <Document
      title={`WrapSnap Estimate — ${clientName}`}
      author="WrapSnap by Advertising Vehicles"
    >
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <Image src={logoUrl} style={s.logo} />
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Vinyl Graphics Estimate</Text>
            <Text style={s.dateText}>Generated {generatedOn}</Text>
            <Text style={s.poweredBy}>Powered by Advertising Vehicles</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── CLIENT INFO ── */}
        <View style={s.clientRow}>
          <View>
            <Text style={s.clientName}>{clientName}</Text>
            {vehicleDescription ? <Text style={s.clientSub}>{vehicleDescription}</Text> : null}
            {vehicleType ? <Text style={s.clientSub}>{toLabel(vehicleType)}</Text> : null}
          </View>
          <View style={s.clientRight}>
            <Text style={s.clientLabel}>SESSION DATE</Text>
            <Text style={s.clientDate}>{sessionOn}</Text>
          </View>
        </View>

        {/* ── ESTIMATE SUMMARY ── */}
        <View style={s.summaryBox}>
          <View style={s.summaryLeft}>
            <Text style={s.totalLabel}>TOTAL SQUARE FOOTAGE</Text>
            <View style={s.totalRow}>
              <Text style={s.totalNum}>{totalSqft != null ? totalSqft.toFixed(1) : "—"}</Text>
              <Text style={s.totalUnit}>sq ft</Text>
            </View>
            {sqftLow != null && sqftHigh != null && (
              <Text style={s.rangeText}>
                Range: {sqftLow.toFixed(1)} – {sqftHigh.toFixed(1)} sq ft
              </Text>
            )}
          </View>
          <View style={s.summaryRight}>
            <Text style={s.confLabel}>CONFIDENCE</Text>
            <View style={[s.confBadge, { backgroundColor: confBg }]}>
              <Text style={[s.confText, { color: confColor }]}>
                {confidence ? confidence.charAt(0).toUpperCase() + confidence.slice(1) : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── PANEL BREAKDOWN ── */}
        {panels.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>PANEL BREAKDOWN</Text>
            {panels.map((p, pi) => {
              const slug   = p.panel ?? p.name ?? `panel-${pi}`;
              const total  = p.panel_sqft  ?? p.sqft;
              const low    = p.panel_sqft_low  ?? p.sqft_low;
              const high   = p.panel_sqft_high ?? p.sqft_high;
              const zones  = p.vinyl_zones ?? [];

              return (
                <View key={slug} style={s.panelBlock}>
                  <View style={s.panelHead}>
                    <Text style={s.panelName}>{toLabel(slug)}</Text>
                    <Text style={s.panelTotal}>
                      {total != null ? `${total.toFixed(1)} sq ft` : "—"}
                      {low != null && high != null ? `  (${low.toFixed(1)} – ${high.toFixed(1)})` : ""}
                    </Text>
                  </View>
                  {zones.length > 0 ? (
                    zones.map((z, zi) => (
                      <View
                        key={zi}
                        style={[
                          s.zoneRow,
                          zi === zones.length - 1 ? s.zoneRowLast : {},
                          { backgroundColor: zi % 2 === 0 ? "#FFFFFF" : "#FAFAFA" },
                        ]}
                      >
                        <Text style={s.zoneLabel}>{zoneLabel(z.type, z.name)}</Text>
                        <Text style={s.zoneValue}>
                          {z.sqft != null ? `${z.sqft.toFixed(1)} sq ft` : "—"}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={[s.zoneRow, s.zoneRowLast]}>
                      <Text style={s.zoneLabel}>No zones recorded</Text>
                      <Text style={s.zoneValue}>—</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── VEHICLE PHOTOS ── */}
        {photosByPanel && PHOTO_PANELS.some((p) => !!photosByPanel[p.slug]) && (
          <View style={{ marginBottom: 14 }} break>
            <Text style={s.sectionTitle}>VEHICLE PHOTOS</Text>
            <View style={s.photosGrid}>
              {PHOTO_PANELS.map(({ slug, label }) => {
                const url = photosByPanel[slug];
                return (
                  <View key={slug} style={s.photoCell}>
                    {url ? (
                      <Image src={url} style={s.photoImg} />
                    ) : (
                      <View style={s.photoEmpty}>
                        <Text style={{ fontSize: 8, color: "#9CA3AF" }}>No photo</Text>
                      </View>
                    )}
                    <Text style={s.photoLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── PRODUCTION TOTALS ── */}
        <View style={{ marginBottom: 14 }}>
          <Text style={s.sectionTitle}>PRODUCTION TOTALS</Text>
          <View style={s.totalsBox}>
            {hasMaterialBreakdown ? (
              <>
                <View style={s.totalsRow}>
                  <Text style={s.totalsLabel}>Printed Wrap</Text>
                  <Text style={s.totalsValue}>{printedWrap.toFixed(1)} sq ft</Text>
                </View>
                <View style={s.totalsRow}>
                  <Text style={s.totalsLabel}>Cut Vinyl</Text>
                  <Text style={s.totalsValue}>{cutVinyl.toFixed(1)} sq ft</Text>
                </View>
              </>
            ) : (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>Material breakdown not available for this estimate</Text>
                <Text style={s.totalsValue}>—</Text>
              </View>
            )}
            <View style={s.totalsSumRow}>
              <Text style={s.totalsBoldLbl}>Combined Total</Text>
              <Text style={s.totalsBoldVal}>
                {totalSqft != null ? `${totalSqft.toFixed(1)} sq ft` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── NOTES ── */}
        {confidenceNote ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>NOTES</Text>
            <View style={s.notesBox}>
              <Text style={s.notesText}>{confidenceNote}</Text>
            </View>
          </View>
        ) : null}

        {/* ── FOOTER ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerDisclaimer}>
            This estimate was generated by WrapSnap AI and is intended as a starting point for
            quoting purposes. Final measurements should be verified before production.
          </Text>
          <Text style={s.footerUrl}>advertisingvehicles.com</Text>
        </View>

      </Page>
    </Document>
  );
}
