using System.Text.Json;

namespace NetworkDiagramStudio;

// The main window reopens at its last size and position (and maximized state).
// The placement is a local preference in %LOCALAPPDATA%\NetworkDiagramStudio,
// never project data. A saved position that is no longer on a connected
// screen keeps its size but is centered on the primary screen instead.
internal static class WindowPlacement
{
    internal sealed record Saved(int X, int Y, int Width, int Height, bool Maximized);
    static string Location => Path.Combine(Policy.Home, "window.json");

    internal static void Restore(Form form)
    {
        try
        {
            if (!System.IO.File.Exists(Location) || new FileInfo(Location).Length > 4096) return;
            var saved = JsonSerializer.Deserialize<Saved>(System.IO.File.ReadAllText(Location));
            if (saved == null || saved.Width < form.MinimumSize.Width || saved.Height < form.MinimumSize.Height) return;
            var bounds = new Rectangle(saved.X, saved.Y, saved.Width, saved.Height);
            var screen = Screen.AllScreens.FirstOrDefault(s =>
            {
                var overlap = Rectangle.Intersect(s.WorkingArea, bounds);
                return overlap.Width >= Math.Min(240, bounds.Width) && overlap.Height >= Math.Min(160, bounds.Height);
            });
            var area = (screen ?? Screen.PrimaryScreen)?.WorkingArea ?? bounds;
            var size = new Size(Math.Min(bounds.Width, area.Width), Math.Min(bounds.Height, area.Height));
            form.StartPosition = FormStartPosition.Manual;
            form.Bounds = screen != null
                ? new Rectangle(Math.Clamp(bounds.X, area.Left, area.Right - size.Width), Math.Clamp(bounds.Y, area.Top, area.Bottom - size.Height), size.Width, size.Height)
                : new Rectangle(area.Left + (area.Width - size.Width) / 2, area.Top + (area.Height - size.Height) / 2, size.Width, size.Height);
            if (saved.Maximized) form.WindowState = FormWindowState.Maximized;
        }
        catch (Exception) { /* A damaged preference falls back to the default window. */ }
    }

    internal static void Save(Form form)
    {
        try
        {
            var bounds = form.WindowState == FormWindowState.Normal ? form.Bounds : form.RestoreBounds;
            if (bounds.Width < form.MinimumSize.Width || bounds.Height < form.MinimumSize.Height) return;
            Directory.CreateDirectory(Policy.Home);
            System.IO.File.WriteAllText(Location + ".tmp", JsonSerializer.Serialize(new Saved(bounds.X, bounds.Y, bounds.Width, bounds.Height, form.WindowState == FormWindowState.Maximized)));
            System.IO.File.Move(Location + ".tmp", Location, true);
        }
        catch (Exception) { /* Placement is a convenience; closing never fails over it. */ }
    }
}
