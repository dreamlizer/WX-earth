// Rebuild with: swift -module-cache-path /tmp/go-west-swift-cache
// tools/model-build/prepare-go-west-outlines.swift > miniprogram/assets/data/go-west-title-shapes.js
// Extracts only six Avenir Next Demi Bold outlines from the local system font.
import Foundation
import CoreText
import CoreGraphics
let font = CTFontCreateWithName("AvenirNext-DemiBold" as CFString, 1000, nil)
let cap = CTFontGetCapHeight(font)
var result: [[String: Any]] = []
for ch in "GOWEST".utf16 {
    var character = ch
    var glyph = CGGlyph()
    CTFontGetGlyphsForCharacters(font, &character, &glyph, 1)
    guard let path = CTFontCreatePathForGlyph(font, glyph, nil) else { fatalError("Missing glyph") }
    var advance = CGSize()
    CTFontGetAdvancesForGlyphs(font, .horizontal, &glyph, &advance, 1)
    var commands: [[Any]] = []
    path.applyWithBlock { pointer in
        let e = pointer.pointee
        let n: Int
        let op: String
        switch e.type {
        case .moveToPoint: op = "m"; n = 1
        case .addLineToPoint: op = "l"; n = 1
        case .addQuadCurveToPoint: op = "q"; n = 2
        case .addCurveToPoint: op = "b"; n = 3
        case .closeSubpath: op = "z"; n = 0
        @unknown default: fatalError("Unknown outline command")
        }
        var c: [Any] = [op]
        for i in 0..<n {
            c.append((e.points[i].x / cap * 10000).rounded() / 10000)
            c.append((e.points[i].y / cap * 10000).rounded() / 10000)
        }
        commands.append(c)
    }
    result.append(["char": String(UnicodeScalar(character)!), "advance": advance.width / cap, "path": commands])
}
let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print("// Six local font outlines only; no font loading or raster title at runtime.\nexport const GO_WEST_TITLE_SHAPES = " + String(data: data, encoding: .utf8)! + ";")
