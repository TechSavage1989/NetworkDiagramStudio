using System.Text;
using System.Text.RegularExpressions;
using SwitchportGenerator;

static class ReportPaperChecks
{
    static int checks;
    static void Require(bool pass,string message){checks++;if(!pass)throw new Exception(message);}
    static void CheckPdf(string name,string orientation,double widthMm,double heightMm)
    {
        var paper=ReportPaper.Parse(name,orientation);
        Require(Math.Abs(paper.WidthPt-widthMm*72/25.4)<.01&&Math.Abs(paper.HeightPt-heightMm*72/25.4)<.01,"Media size is incorrect.");
        string path=Path.Combine(Path.GetTempPath(),"nds-paper-"+Guid.NewGuid().ToString("N")+".pdf");
        try
        {
            Pdf.Save(new(){new Scene{Width=805.89,Height=559.28}},path,paper);
            string source=Encoding.Latin1.GetString(File.ReadAllBytes(path));
            var box=Regex.Match(source,@"/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]");
            Require(box.Success,"PDF is missing a MediaBox.");
            Require(Math.Abs(double.Parse(box.Groups[1].Value,System.Globalization.CultureInfo.InvariantCulture)-paper.WidthPt)<.2,"PDF printed width mismatched.");
            Require(Math.Abs(double.Parse(box.Groups[2].Value,System.Globalization.CultureInfo.InvariantCulture)-paper.HeightPt)<.2,"PDF printed height mismatched.");
        }
        finally { File.Delete(path); }
    }
    static void Main()
    {
        Require(ReportPaper.Parse(null,null).Preset=="a4","Old workspaces default to A4.");
        Require(ReportPaper.Parse(null,null).Stem=="a4","Default filenames remain unchanged.");
        CheckPdf("a4","landscape",297,210);
        CheckPdf("letter","landscape",279.4,215.9);
        CheckPdf("letter","portrait",215.9,279.4);
        CheckPdf("legal","landscape",355.6,215.9);
        CheckPdf("tabloid","landscape",431.8,279.4);
        CheckPdf("a5","portrait",148,210);
        CheckPdf("a3","landscape",420,297);
        CheckPdf("a2","landscape",594,420);
        var letter=ReportPaper.Parse("letter","landscape");
        Require(letter.PixelWidth==3300&&letter.PixelHeight==2550,"Letter 300 DPI raster dimensions");
        Require(letter.Stem=="letter-landscape","Non-A4 export filenames identify paper.");
        bool invalid=false;try{ReportPaper.Parse("giant","landscape");}catch(InvalidOperationException){invalid=true;}
        Require(invalid,"Invalid paper size rejected.");
        invalid=false;try{ReportPaper.Parse("letter","upside-down");}catch(InvalidOperationException){invalid=true;}
        Require(invalid,"Invalid orientation rejected.");
        Console.WriteLine("PASS "+checks+" native report paper assertions.");
    }
}