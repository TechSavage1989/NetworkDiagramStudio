# Third-party notices

## Browser distribution

- **jsPDF 4.2.1.** The locally bundled PDF writer creates vector drawing and switchport exports without a service request. Distributed under the MIT license. [Source and release](https://github.com/parallax/jsPDF/releases/tag/v4.2.1) | [Bundled license](../src/web/vendor/JSPDF-LICENSE.txt)
- **DejaVu Sans.** Regular and bold fonts are embedded in switchport PNG/PDF exports. [Bundled font license](../src/web/vendor/REPORT-FONTS-LICENSE.txt)
- **Switchport Diagram Builder 1.18.5.** The owner's report parsers, verified hardware catalog, palette semantics, report layouts and output workflows are integrated from commit 2327083bcd4301db1cc7c162a764540190c5d7ad. The browser catalog and report modules retain the source attribution; the Windows library contains the reusable source engine. [Provenance and local changes](../desktop/SwitchportReports/UPSTREAM.md) | [Integration coverage](SWITCHPORT_INTEGRATION.md)

- **EMFJS, from rtf.js 3.0.9.** The browser includes the pinned renderer locally to display eligible EMF artwork from a user-selected stencil. Copyright Thomas Bluemel and Tom Zoehner. Distributed under the MIT license. [Upstream](https://github.com/tbluemel/rtf.js) · [License](../src/web/vendor/EMFJS-LICENSE.txt) · [Distribution notice](../src/web/vendor/NOTICE.txt)
- **NetBox Community Device Type Library.** Selected model, manufacturer, SKU and interface facts were derived from snapshot 7530643cb38decaa1cba31e901892b9131315239 under CC0 1.0 Universal. [Source](https://github.com/netbox-community/devicetype-library/tree/7530643cb38decaa1cba31e901892b9131315239/device-types) · [CC0 notice](../src/web/imports/NETBOX-LICENSE.txt)
- The owner’s Switchport Diagram Builder hardware facts (85a4673a5a08c45d1f0e65218b4865d25ea4ecfc) and Configuration Inspector bank facts/legacy picture reader (675a806eeb893a55b2272be9fb7e914bac06ee03) informed the new catalog and binary import subset. Manufacturer references remain with the data. Binary format descriptions were checked against [Document Liberation Project libvisio](https://github.com/LibreOffice/libvisio). Manufacturer artwork is not bundled.
- Additional inventory identifiers and their provenance are documented in the hardware reference. Manufacturer artwork supplied by a user remains subject to its original terms. [Hardware support](HARDWARE_SUPPORT.md)

## Windows distribution

The switchport report library uses **SkiaSharp 3.119.4** and its matching Windows native renderer. Its MIT license and native component notices are embedded in the portable application. [Managed license](../desktop/SwitchportReports/Notices/SkiaSharp-LICENSE.txt) | [Native license](../desktop/SwitchportReports/Notices/SkiaSharp-Native-Windows-LICENSE.txt) | [Native component notices](../desktop/SwitchportReports/Notices/SkiaSharp-Native-Windows-THIRD-PARTY-NOTICES.txt)

The Windows application uses the Microsoft .NET 8 runtime and Windows Forms. Parts of .NET are distributed under additional component licenses. The desktop build also includes the Microsoft WebView2 SDK and loader. The Evergreen Edge WebView2 browser runtime is supplied separately on Windows. [Microsoft .NET license](https://github.com/dotnet/runtime/blob/main/LICENSE.TXT) · [.NET third-party notices](https://github.com/dotnet/runtime/blob/main/THIRD-PARTY-NOTICES.TXT) · [Windows Forms license](https://github.com/dotnet/winforms/blob/main/LICENSE.TXT) · [WebView2 SDK package](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4314.35)

Select **Help**, then **Third-party notices**, in the Windows window to read the bundled component licenses and third-party notices. The offline HTML carries the browser notices within the file.
