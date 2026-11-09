namespace SwitchportGenerator;

/// <summary>Chosen physical report sheet. The existing A4-native diagram is
/// fitted uniformly, never cropped, when the Windows report exporter writes a
/// different media box. Browser reports reflow against the chosen sheet.</summary>
public readonly record struct ReportPaper(
    string Preset, string Orientation, double WidthPt, double HeightPt,
    int PixelWidth, int PixelHeight, string Label, string Stem)
{
    public static ReportPaper Normalize(ReportPaper? value) => Parse(value?.Preset, value?.Orientation);

    public static ReportPaper Default => Parse("a4", "landscape");

    public static ReportPaper Parse(string? preset, string? orientation)
    {
        string key=(string.IsNullOrWhiteSpace(preset)?"a4":preset).Trim().ToLowerInvariant();
        string direction=(string.IsNullOrWhiteSpace(orientation)?"landscape":orientation).Trim().ToLowerInvariant();
        if (direction is not ("landscape" or "portrait"))
            throw new InvalidOperationException("Report orientation must be portrait or landscape.");
        var size=key switch
        {
            "letter" => (Name:"Letter", W:215.9, H:279.4),
            "legal" => (Name:"Legal", W:215.9, H:355.6),
            "tabloid" => (Name:"Tabloid / Ledger", W:279.4, H:431.8),
            "a5" => (Name:"A5", W:148.0, H:210.0),
            "a4" => (Name:"A4", W:210.0, H:297.0),
            "a3" => (Name:"A3", W:297.0, H:420.0),
            "a2" => (Name:"A2", W:420.0, H:594.0),
            _ => throw new InvalidOperationException("Unsupported report paper size.")
        };
        double shortSide=Math.Min(size.W,size.H),longSide=Math.Max(size.W,size.H);
        double widthMm=direction=="portrait"?shortSide:longSide;
        double heightMm=direction=="portrait"?longSide:shortSide;
        int widthPx=checked((int)Math.Round(widthMm*300/25.4));
        int heightPx=checked((int)Math.Round(heightMm*300/25.4));
        if ((long)widthPx*heightPx>50_000_000)
            throw new InvalidOperationException("This report size exceeds the 300 DPI raster limit.");
        string stem=key=="a4"&&direction=="landscape"?"a4":key+"-"+direction;
        return new ReportPaper(key,direction,widthMm*72/25.4,heightMm*72/25.4,
            widthPx,heightPx,size.Name+" "+direction,stem);
    }
}
