using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace NetworkDiagramStudio;

internal static class StencilConversion
{
	private static readonly string[] Extensions = new string[3] { ".vss", ".vst", ".vsd" };

	private static string Root => Path.Combine(Policy.Home, "stencil-conversion");

	private static string Folder(string nonce)
	{
		if (!Regex.IsMatch(nonce, "^[a-f0-9]{32}$"))
		{
			throw new InvalidDataException("Invalid conversion request.");
		}
		return Path.Combine(Root, nonce);
	}

	internal static async Task<(string Name, string Data)> Convert(string name, string data)
	{
		string extension = Path.GetExtension(name).ToLowerInvariant();
		if (!Extensions.Contains(extension) || data.Length > 234881024)
		{
			throw new InvalidDataException("Choose a legacy VSS, VST or VSD file under 160 MB.");
		}
		byte[] array = System.Convert.FromBase64String(data);
		if (array.Length > 167772160 || array.Length < 8 || !array.AsSpan(0, 8).SequenceEqual(new byte[8] { 208, 207, 17, 224, 161, 177, 26, 225 }))
		{
			throw new InvalidDataException("The legacy Visio file has an invalid binary header.");
		}
		string nonce = Guid.NewGuid().ToString("N");
		string folder = Folder(nonce);
		Directory.CreateDirectory(folder);
		try
		{
			await File.WriteAllBytesAsync(Path.Combine(folder, "source" + extension), array);
			ProcessStartInfo processStartInfo = new ProcessStartInfo(Environment.ProcessPath ?? throw new IOException("Could not locate the application executable."))
			{
				UseShellExecute = false,
				CreateNoWindow = true
			};
			processStartInfo.ArgumentList.Add("--convert-stencil");
			processStartInfo.ArgumentList.Add(nonce);
			processStartInfo.ArgumentList.Add(extension);
			using Process process = Process.Start(processStartInfo) ?? throw new IOException("Could not start the Visio converter.");
			try
			{
				await process.WaitForExitAsync().WaitAsync(TimeSpan.FromMinutes(2.0));
			}
			catch (TimeoutException)
			{
				if (!process.HasExited)
				{
					process.Kill(entireProcessTree: true);
				}
				throw new IOException("Visio conversion timed out. Open the stencil in desktop Visio and save a VSSX copy.");
			}
			string text = Path.Combine(folder, "converted" + ((extension == ".vss") ? ".vssx" : ((extension == ".vst") ? ".vstx" : ".vsdx")));
			if (process.ExitCode != 0 || !File.Exists(text))
			{
				string message = ((!File.Exists(Path.Combine(folder, "error.txt"))) ? "Visio could not convert this file." : (await File.ReadAllTextAsync(Path.Combine(folder, "error.txt"))));
				throw new IOException(message);
			}
			if (new FileInfo(text).Length > 167772160)
			{
				throw new IOException("Converted stencil exceeds 160 MB.");
			}
			string item = Path.GetFileNameWithoutExtension(name) + Path.GetExtension(text);
			return (Name: item, Data: System.Convert.ToBase64String(await File.ReadAllBytesAsync(text)));
		}
		finally
		{
			try
			{
				Directory.Delete(folder, recursive: true);
			}
			catch (IOException)
			{
			}
		}
	}

	internal static int Run(string nonce, string extension)
	{
		string path = Folder(nonce);
		if (!Extensions.Contains(extension))
		{
			return 2;
		}
		dynamic? val = null;
		dynamic? val2 = null;
		dynamic? val3 = null;
		try
		{
			val = Activator.CreateInstance(Type.GetTypeFromProgID("Visio.InvisibleApp") ?? throw new IOException("Legacy stencil conversion requires desktop Microsoft Visio installed on this Windows computer.")) ?? throw new IOException("Could not start desktop Microsoft Visio.");
			dynamic val4 = val!;
			val4.EventsEnabled = false;
			val4.AlertResponse = 1;
			val2 = val4.Documents;
			val3 = val2.OpenEx(Path.Combine(path, "source" + extension), (short)1482);
			string text = Path.Combine(path, "converted" + ((extension == ".vss") ? ".vssx" : ((extension == ".vst") ? ".vstx" : ".vsdx")));
			val3.SaveAsEx(text, (short)0);
			return 0;
		}
		catch (Exception ex)
		{
			File.WriteAllText(Path.Combine(path, "error.txt"), "Stencil conversion: " + ex.Message);
			return 1;
		}
		finally
		{
			if ((object)val3 != null)
			{
				try
				{
					val3.Close();
				}
				catch
				{
				}
				Marshal.FinalReleaseComObject((object)val3);
			}
			if ((object)val2 != null)
			{
				Marshal.FinalReleaseComObject((object)val2);
			}
			if ((object)val != null)
			{
				try
				{
					val.Quit();
				}
				catch
				{
				}
				Marshal.FinalReleaseComObject((object)val);
			}
		}
	}
}
