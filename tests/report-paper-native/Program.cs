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
            // Skia PDF MediaBox can serialize dimensions to whole PDF points.
            // Half a point is the maximum conversion rounding error.
            double actualWidth=double.Parse(box.Groups[1].Value,System.Globalization.CultureInfo.InvariantCulture);
            double actualHeight=double.Parse(box.Groups[2].Value,System.Globalization.CultureInfo.InvariantCulture);
            Require(Math.Abs(actualWidth-paper.WidthPt)<=.51,"PDF printed width mismatched: "+actualWidth+" versus "+paper.WidthPt);
            Require(Math.Abs(actualHeight-paper.HeightPt)<=.51,"PDF printed height mismatched: "+actualHeight+" versus "+paper.HeightPt);
        }
        finally { File.Delete(path); }
    }
    static void CheckRasterFit()
    {
        foreach (string orientation in new[] { "portrait", "landscape" })
        {
            var paper=ReportPaper.Parse("letter",orientation);
            string path=Path.Combine(Path.GetTempPath(),"nds-fit-"+Guid.NewGuid().ToString("N")+".png");
            try
            {
                var scene=new Scene { Width=100,Height=50 };
                scene.Rect(0,0,100,50,"#000000","#000000",0);
                Png.Save(scene,path,paper.PixelWidth,paper.PixelHeight,true);
                using var bitmap=SkiaSharp.SKBitmap.Decode(path);
                Require(bitmap.Width==paper.PixelWidth&&bitmap.Height==paper.PixelHeight,"Raster has selected paper dimensions.");
                int left=bitmap.Width,right=-1,top=bitmap.Height,bottom=-1;
                for(int x=0;x<bitmap.Width;x++)if(bitmap.GetPixel(x,bitmap.Height/2).Red<128){left=Math.Min(left,x);right=x;}
                for(int y=0;y<bitmap.Height;y++)if(bitmap.GetPixel(bitmap.Width/2,y).Red<128){top=Math.Min(top,y);bottom=y;}
                Require(Math.Abs(left-(bitmap.Width-1-right))<=1&&Math.Abs(top-(bitmap.Height-1-bottom))<=1,"PNG content is centered in both axes, like PDF.");
                Require(Math.Abs(Math.Min(left,top)-75)<=1,"PNG uses a physical quarter-inch minimum margin at 300 DPI.");
                byte[] png=File.ReadAllBytes(path);
                int physical=-1;
                for(int offset=8;offset+12<=png.Length;)
                {
                    int length=System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(offset,4));
                    Require(length>=0&&length<=png.Length-offset-12,"PNG chunk length is valid.");
                    if(png.AsSpan(offset+4,4).SequenceEqual("pHYs"u8)){physical=offset+8;break;}
                    offset+=length+12;
                }
                Require(physical>=0&&System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(physical,4))==11811&&System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(physical+4,4))==11811&&png[physical+8]==1,"PNG retains numeric 300 DPI metadata.");
            }
            finally { File.Delete(path); }
        }
    }
    static void Main()
    {
        Require(ReportPaper.Parse(null,null).Preset=="a4","Old workspaces default to A4.");
        Require(ReportPaper.Parse(null,null).Stem=="a4","Default filenames remain unchanged.");
        CheckRasterFit();
        foreach(var (name,width,height) in new[]{("letter",215.9,279.4),("legal",215.9,355.6),("tabloid",279.4,431.8),("a5",148.0,210.0),("a4",210.0,297.0),("a3",297.0,420.0),("a2",420.0,594.0)})
        { CheckPdf(name,"portrait",width,height); CheckPdf(name,"landscape",height,width); }
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