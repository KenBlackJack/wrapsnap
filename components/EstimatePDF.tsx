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

export interface Artboard1Group {
  name: string;
  items?: string[] | null;
  width_in?: number | null;
  height_in?: number | null;
  can_rotate?: boolean | null;
}

export interface Artboard1Data {
  label?: string | null;
  groups?: Artboard1Group[] | null;
  artboard_width_in?: number | null;
  artboard_height_in?: number | null;
  sqft?: number | null;
}

export interface Artboard2Panel {
  name: string;
  width_in?: number | null;
  height_in?: number | null;
  quantity?: number | null;
  sqft?: number | null;
}

export interface Artboard2Data {
  label?: string | null;
  panels?: Artboard2Panel[] | null;
  total_sqft?: number | null;
}

export interface Artboard3Panel {
  name: string;
  panel_width_in?: number | null;
  panel_height_in?: number | null;
  panel_sqft?: number | null;       // graphic area = width × height ÷ 144
  strips_needed?: number | null;    // informational: ceil(width ÷ 52)
  material_sqft?: number | null;    // actual material = strips × 52 × height ÷ 144
  // backward compat
  sqft_per_strip?: number | null;
  total_sqft?: number | null;
}

export interface Artboard3Data {
  label?: string | null;
  panels?: Artboard3Panel[] | null;
  total_sqft?: number | null;          // sum of panel_sqft (graphic areas)
  total_material_sqft?: number | null; // sum of material_sqft (actual material)
}

// PanelPDF kept for backward compatibility with old estimates
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
  confidence?: string | null;
  confidenceNote?: string | null;
  artboard1?: Artboard1Data | null;
  artboard2?: Artboard2Data | null;
  artboard3?: Artboard3Data | null;
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

  // Artboard blocks
  artboardBlock:   { marginBottom: 10, borderWidth: 1, borderColor: BORDER, borderRadius: 6 },
  artboardHead:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#EBF5FB", paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BORDER, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  artboardHeadAlt: { backgroundColor: "#F0FDF4" },
  artboardHeadAlt2:{ backgroundColor: "#FFF7ED" },
  artboardLabel:   { fontFamily: "Helvetica-Bold", fontSize: 9, color: DARK_BLUE },
  artboardDims:    { fontSize: 8, color: GRAY_TEXT, marginTop: 1 },
  artboardSqft:    { fontFamily: "Helvetica-Bold", fontSize: 10, color: BLUE },

  // Row inside artboard
  itemRow:     { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingLeft: 16, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemRowLast: { borderBottomWidth: 0 },
  itemName:    { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#111827", marginBottom: 1 },
  itemSub:     { fontSize: 7, color: GRAY_TEXT },
  itemRight:   { alignItems: "flex-end" },
  itemDims:    { fontSize: 8, color: "#374151" },
  itemQty:     { fontSize: 7, color: GRAY_TEXT },
  itemSqft:    { fontSize: 8, color: BLUE, fontFamily: "Helvetica-Bold" },

  // Artboard footer (dimension summary)
  artboardFooter: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: LIGHT_BG, borderTopWidth: 1, borderTopColor: BORDER, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  artboardFooterText: { fontSize: 8, color: GRAY_TEXT },
  artboardFooterSqft: { fontFamily: "Helvetica-Bold", fontSize: 8, color: BLUE },

  // Production summary bar
  summaryBar:  { flexDirection: "row", borderWidth: 1, borderColor: BORDER, borderRadius: 6, marginBottom: 14, overflow: "hidden" },
  summaryCell: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRightWidth: 1, borderRightColor: BORDER },
  summaryCellLast: { borderRightWidth: 0 },
  summaryCellLabel: { fontSize: 7, color: GRAY_TEXT, marginBottom: 3 },
  summaryCellVal:   { fontFamily: "Helvetica-Bold", fontSize: 10, color: BLUE },

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
  confidence,
  confidenceNote,
  artboard1,
  artboard2,
  artboard3,
  photosByPanel,
}: EstimatePDFProps) {
  const { bg: confBg, color: confColor } = confColors(confidence);
  const generatedOn = fmtDate(new Date().toISOString());
  const sessionOn   = fmtDate(sessionDate);

  const a1sqft = artboard1?.sqft ?? 0;
  const a2sqft = artboard2?.total_sqft ?? 0;
  const a3sqft = artboard3?.total_sqft ?? 0;
  const hasArtboards = a1sqft > 0 || a2sqft > 0 || a3sqft > 0;

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

        {/* ── ARTBOARD SUMMARY BAR ── */}
        {hasArtboards && (
          <View style={[s.summaryBar, { marginBottom: 14 }]}>
            <View style={s.summaryCell}>
              <Text style={s.summaryCellLabel}>CUT VINYL (A1)</Text>
              <Text style={s.summaryCellVal}>{a1sqft.toFixed(1)} sq ft</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryCellLabel}>LARGE CUT (A2)</Text>
              <Text style={s.summaryCellVal}>{a2sqft.toFixed(1)} sq ft</Text>
            </View>
            <View style={[s.summaryCell, s.summaryCellLast]}>
              <Text style={s.summaryCellLabel}>PRINTED (A3)</Text>
              <Text style={s.summaryCellVal}>{a3sqft.toFixed(1)} sq ft</Text>
            </View>
          </View>
        )}

        {/* ── ARTBOARD 1 — CUT VINYL WITH PREMASK ── */}
        {artboard1 && (
          <View>
            <Text style={s.sectionTitle}>ARTBOARD 1 — CUT VINYL WITH PREMASK</Text>
            <View style={s.artboardBlock}>
              <View style={s.artboardHead}>
                <View>
                  <Text style={s.artboardLabel}>Cut Vinyl with Premask</Text>
                  {artboard1.artboard_height_in != null && (
                    <Text style={s.artboardDims}>
                      Artboard: 52" × {artboard1.artboard_height_in}"  (3M 180CV3, 52" usable width)
                    </Text>
                  )}
                </View>
                <Text style={s.artboardSqft}>
                  {artboard1.sqft != null ? `${artboard1.sqft.toFixed(1)} sq ft` : "—"}
                </Text>
              </View>
              {(artboard1.groups ?? []).map((group, gi) => {
                const isLast = gi === (artboard1.groups?.length ?? 0) - 1;
                return (
                  <View key={gi} style={[s.itemRow, isLast ? s.itemRowLast : {}]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={s.itemName}>{group.name}</Text>
                      {group.items && group.items.length > 0 && (
                        <Text style={s.itemSub}>{group.items.join(", ")}</Text>
                      )}
                    </View>
                    <View style={s.itemRight}>
                      {group.width_in != null && group.height_in != null && (
                        <Text style={s.itemDims}>{group.width_in}" × {group.height_in}"</Text>
                      )}
                      {group.can_rotate && (
                        <Text style={s.itemQty}>can rotate 90°</Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {(artboard1.groups ?? []).length === 0 && (
                <View style={[s.itemRow, s.itemRowLast]}>
                  <Text style={s.itemSub}>No cut vinyl groups</Text>
                </View>
              )}
            </View>
            {/* Layout diagram */}
            {(artboard1.groups ?? []).length > 0 && (
              <View style={{ marginTop: 6, marginBottom: 2 }}>
                <Text style={[s.sectionTitle, { fontSize: 7, color: GRAY_TEXT, marginBottom: 4 }]}>
                  ARTBOARD LAYOUT — 52" wide × {artboard1.artboard_height_in ?? "?"}" tall
                </Text>
                <View style={{ backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 4, padding: 4 }}>
                  {(artboard1.groups ?? []).map((group, gi) => {
                    const pct = group.width_in ? Math.min(Math.round((group.width_in / 52) * 100), 100) : 40;
                    const hPts = group.height_in ? Math.max(group.height_in * 2.5, 11) : 11;
                    return (
                      <View key={gi} style={{ marginBottom: gi < (artboard1.groups?.length ?? 0) - 1 ? 3 : 0 }}>
                        <View style={{ width: `${pct}%`, minWidth: 30, height: hPts, backgroundColor: "#DBEAFE", borderWidth: 0.75, borderColor: "#3B82F6", borderRadius: 2, justifyContent: "center", paddingHorizontal: 3 }}>
                          <Text style={{ fontSize: 6, color: "#1D4ED8" }}>
                            {group.name}{group.width_in && group.height_in ? `  ${group.width_in}"×${group.height_in}"` : ""}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ marginTop: 4, borderTopWidth: 0.5, borderTopColor: "#D1D5DB", paddingTop: 2 }}>
                    <Text style={{ fontSize: 6, color: "#9CA3AF", textAlign: "center" }}>
                      ← 52" usable width (3M 180CV3) →
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── ARTBOARD 2 — LARGE CUT PANELS ── */}
        {artboard2 && (
          <View>
            <Text style={s.sectionTitle}>ARTBOARD 2 — LARGE CUT PANELS</Text>
            <View style={s.artboardBlock}>
              <View style={[s.artboardHead, s.artboardHeadAlt]}>
                <View>
                  <Text style={[s.artboardLabel, { color: "#166534" }]}>Large Cut Panels</Text>
                  <Text style={s.artboardDims}>Single-color shapes, no gradients</Text>
                </View>
                <Text style={[s.artboardSqft, { color: "#16A34A" }]}>
                  {artboard2.total_sqft != null ? `${artboard2.total_sqft.toFixed(1)} sq ft` : "—"}
                </Text>
              </View>
              {(artboard2.panels ?? []).map((panel, pi) => {
                const isLast = pi === (artboard2.panels?.length ?? 0) - 1;
                return (
                  <View key={pi} style={[s.itemRow, isLast ? s.itemRowLast : {}]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={s.itemName}>{panel.name}</Text>
                    </View>
                    <View style={s.itemRight}>
                      {panel.width_in != null && panel.height_in != null && (
                        <Text style={s.itemDims}>{panel.width_in}" × {panel.height_in}"</Text>
                      )}
                      {(panel.quantity ?? 1) > 1 && (
                        <Text style={s.itemQty}>qty: {panel.quantity}</Text>
                      )}
                      {panel.sqft != null && (
                        <Text style={s.itemSqft}>{panel.sqft.toFixed(1)} sq ft</Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {(artboard2.panels ?? []).length === 0 && (
                <View style={[s.itemRow, s.itemRowLast]}>
                  <Text style={s.itemSub}>No large cut panels</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── ARTBOARD 3 — PRINTED VINYL ── */}
        {artboard3 && (
          <View>
            <Text style={s.sectionTitle}>ARTBOARD 3 — PRINTED VINYL</Text>
            <View style={s.artboardBlock}>
              <View style={[s.artboardHead, s.artboardHeadAlt2]}>
                <View>
                  <Text style={[s.artboardLabel, { color: "#9A3412" }]}>Printed Vinyl</Text>
                  <Text style={s.artboardDims}>
                    Graphic area: {artboard3.total_sqft != null ? `${artboard3.total_sqft.toFixed(1)} sq ft` : "—"}
                    {artboard3.total_material_sqft != null ? `  ·  Material (incl. waste): ${artboard3.total_material_sqft.toFixed(1)} sq ft` : ""}
                  </Text>
                </View>
                <Text style={[s.artboardSqft, { color: "#EA580C" }]}>
                  {artboard3.total_sqft != null ? `${artboard3.total_sqft.toFixed(1)} sq ft` : "—"}
                </Text>
              </View>
              {(artboard3.panels ?? []).map((panel, pi) => {
                const isLast = pi === (artboard3.panels?.length ?? 0) - 1;
                const graphicSqft = panel.panel_sqft ?? panel.total_sqft;
                return (
                  <View key={pi} style={[s.itemRow, isLast ? s.itemRowLast : {}]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={s.itemName}>{panel.name}</Text>
                      {panel.panel_width_in != null && panel.panel_height_in != null && (
                        <Text style={s.itemSub}>
                          {panel.panel_width_in}" × {panel.panel_height_in}"
                          {panel.strips_needed != null ? `  ·  ${panel.strips_needed} strip${panel.strips_needed !== 1 ? "s" : ""}` : ""}
                        </Text>
                      )}
                      {panel.material_sqft != null && (
                        <Text style={[s.itemSub, { color: "#9CA3AF" }]}>
                          material: {panel.material_sqft.toFixed(1)} sq ft
                        </Text>
                      )}
                    </View>
                    <View style={s.itemRight}>
                      {graphicSqft != null && (
                        <Text style={s.itemSqft}>{graphicSqft.toFixed(1)} sq ft</Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {(artboard3.panels ?? []).length === 0 && (
                <View style={[s.itemRow, s.itemRowLast]}>
                  <Text style={s.itemSub}>No printed panels</Text>
                </View>
              )}
            </View>
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
