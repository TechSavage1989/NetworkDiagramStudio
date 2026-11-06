using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;

namespace NetworkDiagramStudio;

internal sealed record InstallPlan(int Parent, string Target, string PreviousHash, Release Release, string Nonce);
internal static class Installer
{
    static string Root => Path.Combine(Policy.Home, "updates");
    static string Candidate => Path.Combine(Root, "candidate.exe");
    static string Helper => Path.Combine(Root, "update-helper.exe");
    static string PlanFile => Path.Combine(Root, "pending.json");
    static string Backup => Path.Combine(Root, "previous.exe");
    static string Hash(string path) { using var s = File.OpenRead(path); return Convert.ToHexString(SHA256.HashData(s)); }
    static Process Start(string path, params string[] args)
    {
        var info = new ProcessStartInfo(path) { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(path)! };
        foreach (var a in args) info.ArgumentList.Add(a);
        return Process.Start(info) ?? throw new IOException("Could not start the application.");
    }
    internal static void Begin(Release release)
    {
        var target = Path.GetFullPath(Environment.ProcessPath!);
        if (Path.GetDirectoryName(target)!.Equals(Root, StringComparison.OrdinalIgnoreCase)) throw new IOException("Move the application outside its update staging directory first.");
        Policy.Verify(Candidate, release);
        File.Copy(target, Helper, true);
        var plan = new InstallPlan(Environment.ProcessId, target, Hash(target), release, Guid.NewGuid().ToString("N"));
        File.WriteAllText(PlanFile, JsonSerializer.Serialize(plan));
        using var helper = Start(Helper, "--apply-update", plan.Nonce);
    }
    internal static int Apply(string nonce)
    {
        if (!Path.GetFullPath(Environment.ProcessPath!).Equals(Helper, StringComparison.OrdinalIgnoreCase)) return 2;
        var plan = JsonSerializer.Deserialize<InstallPlan>(File.ReadAllText(PlanFile)) ?? throw new IOException("Invalid update plan.");
        if (!Guid.TryParseExact(nonce, "N", out _) || plan.Nonce != nonce || !Path.IsPathFullyQualified(plan.Target)) return 2;
        var target = Path.GetFullPath(plan.Target);
        if (Path.GetExtension(target).ToLowerInvariant() != ".exe" || FileVersionInfo.GetVersionInfo(target).ProductName != "NetworkDiagramStudio" || Hash(target) != plan.PreviousHash ||
            FileVersionInfo.GetVersionInfo(target).CompanyName != "TechSavage1989" || Hash(Helper) != plan.PreviousHash) return 2;
        try { using var parent = Process.GetProcessById(plan.Parent); if (!parent.WaitForExit(30000)) throw new IOException("The previous application is still open."); } catch (ArgumentException) { }
        Policy.Verify(Candidate, plan.Release);
        var folder = Path.GetDirectoryName(target)!;
        // These two temporary siblings keep the atomic replace and restore on the target volume.
        string stage = Path.Combine(folder, ".nds-" + nonce + ".tmp"), old = Path.Combine(folder, ".nds-" + nonce + ".bak");
        bool replaced = false, healthy = false;
        try
        {
            File.Copy(Candidate, stage, false); Policy.Verify(stage, plan.Release);
            File.Replace(stage, target, old); replaced = true;
            using var signal = new EventWaitHandle(false, EventResetMode.ManualReset, "Local\\NetworkDiagramStudio-" + nonce);
            using var replacement = Start(target, "--confirm-update", nonce);
            for (int i = 0; i < 120 && !replacement.HasExited; i++) if (signal.WaitOne(500)) { healthy = true; break; }
            if (!healthy)
            {
                if (!replacement.HasExited) { replacement.CloseMainWindow(); if (!replacement.WaitForExit(5000)) { replacement.Kill(); replacement.WaitForExit(5000); } }
                throw new IOException("The replacement did not show a healthy working window.");
            }
            File.Copy(old, Backup, true); File.Delete(old);
            File.Delete(Candidate); File.Delete(PlanFile);
            return 0;
        }
        catch
        {
            if (replaced && !healthy) { File.Replace(old, target, null); using var previous = Start(target); }
            throw;
        }
        finally { if (File.Exists(stage)) File.Delete(stage); }
    }
    internal static void Healthy(string? nonce)
    {
        if (nonce == null || !Guid.TryParseExact(nonce, "N", out _)) return;
        try { using var signal = EventWaitHandle.OpenExisting("Local\\NetworkDiagramStudio-" + nonce); signal.Set(); } catch (WaitHandleCannotBeOpenedException) { }
    }
    internal static void CleanupHelper()
    {
        if (!File.Exists(PlanFile)) { try { File.Delete(Helper); } catch (IOException) { } }
    }
}
